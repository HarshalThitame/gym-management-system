import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  checkFeatureAccess,
  canCreateResource,
  getOrganizationEntitlements,
  isFeatureKey,
  isLimitKey,
} from "@/features/entitlement";
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
  const snapshot = await getOrganizationEntitlements(organizationId);

  if (!snapshot.subscriptionId) {
    return { ok: false, status: "none", error: "No subscription found", code: "no_subscription" };
  }

  const status = snapshot.subscriptionStatus as SubscriptionStatus;
  if (snapshot.isActive && (status === "active" || status === "trial")) {
    return { ok: true, status };
  }

  // Non-active statuses
  const messages: Record<string, string> = {
    expired: "Your subscription has expired. Please renew to continue.",
    suspended: "Your subscription has been suspended. Contact support.",
    cancelled: "Your subscription has been cancelled. Please reactivate.",
    paused: "Your subscription is paused.",
    grace_period: "Your subscription is in grace period.",
    none: "No subscription found",
  };

  return {
    ok: false,
    status,
    error: snapshot.message ?? messages[status] ?? "Subscription is not active",
    code: snapshot.reason ? `subscription_${snapshot.reason.toLowerCase()}` : `subscription_${status}`,
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

  if (!isFeatureKey(featureCode)) {
    return { ok: false, error: `Unknown feature "${featureCode}".` };
  }

  const result = await checkFeatureAccess(organizationId, featureCode);
  if (!result.allowed) {
    await writeAuditLog({
      actorId: null,
      action: `feature_gate.blocked.${featureCode}` as const,
      entityType: "organization_subscription",
      entityId: organizationId,
      metadata: { featureCode, actionName } as never,
    });

    return { ok: false as const, error: result.message ?? `Feature "${featureCode}" is not available on your current plan.` };
  }

  return { ok: true };
}

/**
 * Checks if an organization is within a specific limit.
 * Use before creating resources.
 */
export async function requireWithinLimit(
  organizationId: string,
  limitCode: string,
  currentUsage: number,
): Promise<{ ok: boolean; error?: string; limit?: number }> {
  if (!isLimitKey(limitCode)) {
    return {
      ok: false,
      error: `Unknown limit "${limitCode}".`,
    };
  }

  const result = await canCreateResource(organizationId, limitCode, 1);
  if (!result.allowed && currentUsage >= result.limitValue) {
    const label = limitCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      ok: false,
      error: `Your plan limits ${label} to ${result.limitValue}. You currently have ${currentUsage}. Upgrade your plan to increase this limit.`,
      limit: result.limitValue,
    };
  }
  return { ok: true, limit: result.limitValue };
}
