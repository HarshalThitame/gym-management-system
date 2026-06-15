import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizationHasFeature, checkOrganizationLimit } from "@/features/super-admin/services/entitlement-service";
import { writeAuditLog } from "@/lib/audit";

export type SubscriptionStatus = "active" | "trial" | "expired" | "suspended" | "cancelled" | "none" | "grace_period" | "paused";

export type SubscriptionCheckResult = {
  ok: boolean;
  status: SubscriptionStatus;
  error?: string;
  code?: string;
};

/**
 * Checks an organization's subscription status.
 * Returns ok: false with appropriate error if the subscription is not active/trial.
 */
export async function checkSubscriptionStatus(organizationId: string): Promise<SubscriptionCheckResult> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          in(k: string, v: string[]): {
            order(k: string, o: { ascending: boolean }): {
              limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };

  const { data: subs } = await s
    .from("organization_subscriptions")
    .select("status, expires_at, trial_ends_at")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial", "expired", "suspended", "cancelled"])
    .order("started_at", { ascending: false })
    .limit(1);

  const sub = (subs ?? [])[0];
  if (!sub) {
    return { ok: false, status: "none", error: "No subscription found", code: "no_subscription" };
  }

  const status = sub.status as SubscriptionStatus;
  const expiresAt = sub.expires_at as string | null;
  const trialEndsAt = sub.trial_ends_at as string | null;

  // Check active/trial
  if (status === "active") {
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return { ok: false, status: "expired", error: "Subscription has expired", code: "subscription_expired" };
    }
    return { ok: true, status: "active" };
  }

  if (status === "trial") {
    if (trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
      return { ok: false, status: "expired", error: "Trial has expired", code: "trial_expired" };
    }
    return { ok: true, status: "trial" };
  }

  // Non-active statuses
  const messages: Record<string, string> = {
    expired: "Your subscription has expired. Please renew to continue.",
    suspended: "Your subscription has been suspended. Contact support.",
    cancelled: "Your subscription has been cancelled. Please reactivate.",
  };

  return {
    ok: false,
    status,
    error: messages[status] ?? "Subscription is not active",
    code: `subscription_${status}`,
  };
}

/**
 * Requires an active subscription. Returns an API error response if not active.
 * Use in API routes.
 */
export async function requireActiveSubscriptionApi(
  organizationId: string,
  context: { roles: readonly string[] },
): Promise<NextResponse | null> {
  // Super admins bypass subscription checks
  if (context.roles.includes("super_admin")) return null;

  const result = await checkSubscriptionStatus(organizationId);
  if (result.ok) return null;

  await writeAuditLog({
    actorId: null,
    action: `subscription_gate.blocked.${result.code}`,
    entityType: "organization_subscription",
    entityId: organizationId,
    metadata: { status: result.status, error: result.error },
  });

  return NextResponse.json(
    { error: result.error, code: result.code, status: result.status },
    { status: 403 },
  );
}

/**
 * Requires an active subscription. Redirects if not active.
 * Use in server components and layouts.
 */
export async function requireActiveSubscriptionPage(organizationId: string): Promise<void> {
  const result = await checkSubscriptionStatus(organizationId);
  if (result.ok) return;

  await writeAuditLog({
    actorId: null,
    action: `subscription_gate.redirect.${result.code}`,
    entityType: "organization_subscription",
    entityId: organizationId,
    metadata: { status: result.status },
  });

  redirect(`/unauthorized?reason=${result.code}`);
}

/**
 * Checks if a specific feature is available for an organization.
 * Use in server actions and API routes.
 */
export async function requireFeature(
  organizationId: string,
  featureCode: string,
  actionName: string,
): Promise<{ ok: boolean; error?: string | undefined }> {
  const subCheck = await checkSubscriptionStatus(organizationId);
  if (!subCheck.ok) {
    return { ok: false, error: subCheck.error };
  }

  const hasFeature = await organizationHasFeature(organizationId, featureCode);
  if (!hasFeature) {
    await writeAuditLog({
      actorId: null,
      action: `feature_gate.blocked.${featureCode}` as const,
      entityType: "organization_subscription",
      entityId: organizationId,
      metadata: { featureCode, actionName } as never,
    });

    return { ok: false as const, error: `Feature "${featureCode}" is not available on your current plan.` };
  }

  return { ok: true };
}

const UPGRADE_MAP: Record<string, string> = {
  max_members: "Upgrade to Growth for 5,000 members or Enterprise for unlimited.",
  max_trainers: "Upgrade to Growth for 100 trainers or Enterprise for unlimited.",
  max_staff: "Upgrade to Growth for 50 staff or Enterprise for unlimited.",
  max_gyms: "Upgrade to Growth for 5 gyms or Enterprise for unlimited.",
  max_branches: "Upgrade to Growth for 10 branches or Enterprise for unlimited.",
};

/**
 * Checks if an organization is within a specific limit.
 * Use before creating resources. Provides upgrade suggestions.
 */
export async function requireWithinLimit(
  organizationId: string,
  limitCode: string,
  currentUsage: number,
): Promise<{ ok: boolean; error?: string; limit?: number }> {
  const result = await checkOrganizationLimit(organizationId, limitCode, currentUsage);
  if (!result.withinLimit) {
    const label = limitCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const upgrade = UPGRADE_MAP[limitCode] ?? "Upgrade your plan to increase this limit.";
    return {
      ok: false,
      error: `Your plan limits ${label} to ${result.limit}. You currently have ${result.usage}. ${upgrade}`,
      limit: result.limit,
    };
  }
  return { ok: true, limit: result.limit };
}
