import { requireFeature, requireWithinLimit, checkSubscriptionStatus } from "@/lib/tenant/subscription-guard";
import { getOrgOwnerContext } from "@/features/organization-owner/actions/action-utils";

export type GuardResult = { ok: true } | { ok: false; error: string };

/**
 * Checks that the current org owner has a valid subscription (active or trial).
 * Must be called at the start of every org-owner server action.
 */
export async function requireOrgSubscription(): Promise<GuardResult & { organizationId?: string; userId?: string }> {
  let ctx;
  try {
    ctx = await getOrgOwnerContext("/organization");
  } catch {
    return { ok: false, error: "Authentication required." };
  }

  const status = await checkSubscriptionStatus(ctx.organizationId);
  if (!status.ok) {
    return { ok: false as const, error: status.error ?? "No active subscription." };
  }

  return { ok: true as const, organizationId: ctx.organizationId as string, userId: ctx.userId as string };
}

/**
 * Checks that the org owner's subscription enables a specific feature.
 */
export async function requireOrgFeature(
  organizationId: string,
  featureCode: string,
  actionName: string,
): Promise<GuardResult> {
  const result = await requireFeature(organizationId, featureCode, actionName);
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Feature not available on your plan." };
  }
  return { ok: true };
}

/**
 * Checks that the org owner is within a specific resource limit.
 */
export async function requireOrgWithinLimit(
  organizationId: string,
  limitCode: string,
  currentUsage: number,
): Promise<GuardResult> {
  const result = await requireWithinLimit(organizationId, limitCode, currentUsage);
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Resource limit exceeded." };
  }
  return { ok: true };
}

/**
 * Combined guard: checks subscription + feature in one call.
 */
export async function requireOrgSubscriptionAndFeature(
  featureCode: string,
  actionName: string,
): Promise<GuardResult & { organizationId?: string; userId?: string }> {
  const sub = await requireOrgSubscription();
  if (!sub.ok) return sub;

  const feature = await requireOrgFeature(sub.organizationId!, featureCode, actionName);
  if (!feature.ok) return feature;

  return sub;
}

/**
 * Combined guard: checks subscription + feature + limit in one call.
 */
export async function requireOrgSubscriptionFeatureAndLimit(
  featureCode: string,
  limitCode: string,
  currentUsage: number,
  actionName: string,
): Promise<GuardResult & { organizationId?: string; userId?: string }> {
  const sub = await requireOrgSubscriptionAndFeature(featureCode, actionName);
  if (!sub.ok) return sub;

  const limit = await requireOrgWithinLimit(sub.organizationId!, limitCode, currentUsage);
  if (!limit.ok) return limit;

  return sub;
}
