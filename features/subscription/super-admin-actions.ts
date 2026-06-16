"use server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import {
  approveRejectRequestSchema,
  markUnderReviewSchema,
  type ApproveRejectRequestInput,
  type MarkUnderReviewInput,
} from "./schemas";
import type { SubscriptionRequest, SubscriptionRequestWithDetails } from "./types";

function db() {
  const c = getSupabaseAdminClient();
  if (!c) throw new Error("Database connection failed.");
  return c as any;
}

export async function approveRequestAction(input: ApproveRejectRequestInput) {
  await requireRole(["super_admin"], "/super-admin");

  const parsed = approveRejectRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await db().rpc("approve_subscription_request", {
    p_request_id: parsed.data.requestId,
    p_admin_note: parsed.data.adminNote ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function rejectRequestAction(input: ApproveRejectRequestInput) {
  await requireRole(["super_admin"], "/super-admin");

  const parsed = approveRejectRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await db().rpc("reject_subscription_request", {
    p_request_id: parsed.data.requestId,
    p_rejection_reason: parsed.data.rejectionReason ?? parsed.data.adminNote ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function markRequestUnderReviewAction(input: MarkUnderReviewInput) {
  await requireRole(["super_admin"], "/super-admin");

  const parsed = markUnderReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await db().rpc("mark_subscription_request_reviewing", {
    p_request_id: parsed.data.requestId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function getAllSubscriptionRequestsAction(): Promise<{
  ok: boolean;
  data?: SubscriptionRequestWithDetails[];
  error?: string;
}> {
  await requireRole(["super_admin"], "/super-admin");

  const { data, error } = await db()
    .from("subscription_requests")
    .select(`
      *,
      current_package:current_package_id(name),
      requested_package:requested_package_id(name)
    `)
    .order("requested_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const typed = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    current_package_name: (r as any).current_package?.name ?? null,
    requested_package_name: (r as any).requested_package?.name ?? null,
  })) as unknown as SubscriptionRequestWithDetails[];

  return { ok: true, data: typed };
}

export async function getPendingRequestsCountAction(): Promise<{
  ok: boolean;
  data?: { count: number };
  error?: string;
}> {
  await requireRole(["super_admin"], "/super-admin");

  const { count, error } = await db()
    .from("subscription_requests")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "under_review"]);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { count: count ?? 0 } };
}

export async function syncEntitlementsAction(
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["super_admin"], "/super-admin");

  const { data: subscription } = await db()
    .from("organization_subscriptions")
    .select("id, package_id")
    .eq("organization_id", organizationId)
    .single();

  if (!subscription) {
    return { ok: false, error: "No subscription found." };
  }

  // Fetch all features for this package and upsert into org_entitlements
  const { data: features } = await db()
    .from("package_features")
    .select("feature_code, value, min_value, max_value")
    .eq("package_id", subscription.package_id);

  if (features && features.length > 0) {
    for (const f of features) {
      await db()
        .from("organization_entitlements")
        .upsert(
          {
            organization_id: organizationId,
            feature_code: f.feature_code,
            value: f.value,
            min_value: f.min_value,
            max_value: f.max_value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, feature_code" }
        );
    }
  }

  // Audit
  await db().from("subscription_events").insert({
    organization_id: organizationId,
    subscription_id: subscription.id,
    event_type: "plan_changed",
    new_state: { entitlementsSyncedAt: new Date().toISOString() },
    actor_id: null,
    reason: "Entitlements manually synced by Super Admin.",
  });

  return { ok: true };
}

export async function syncUsageLimitsAction(
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["super_admin"], "/super-admin");

  const { data: subscription } = await db()
    .from("organization_subscriptions")
    .select("id, package_id")
    .eq("organization_id", organizationId)
    .single();

  if (!subscription) {
    return { ok: false, error: "No subscription found." };
  }

  // Fetch all limits for this package and upsert into org_usage_limits
  const { data: limits } = await db()
    .from("package_limits")
    .select("limit_code, value, label, description")
    .eq("package_id", subscription.package_id);

  if (limits && limits.length > 0) {
    for (const l of limits) {
      await db()
        .from("organization_usage_limits")
        .upsert(
          {
            organization_id: organizationId,
            limit_code: l.limit_code,
            value: l.value,
            label: l.label,
            description: l.description,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, limit_code" }
        );
    }
  }

  await db().from("subscription_events").insert({
    organization_id: organizationId,
    subscription_id: subscription.id,
    event_type: "plan_changed",
    new_state: { usageLimitsSyncedAt: new Date().toISOString() },
    actor_id: null,
    reason: "Usage limits manually synced by Super Admin.",
  });

  return { ok: true };
}
