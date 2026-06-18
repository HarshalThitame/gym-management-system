import "server-only";

import { cache } from "react";

import { getSubscriptionWithPackageFeatures, getOrganizationCurrentSubscription } from "./entitlement-repository";
import {
  evaluateFeatureAccess,
  evaluateEntitlementSnapshot,
  type SubscriptionInput,
  type PackageInput,
} from "./entitlement-evaluate";
import {
  EntitlementError,
  createEntitlementAllowedResult,
  createEntitlementDeniedResult,
  entitlementUserMessage,
  type EntitlementCheckResult,
  type EntitlementSnapshot,
  type PlanSummary,
  type SubscriptionRef,
} from "./entitlement-errors";
import type { FeatureKey, LimitKey, SubscriptionStatus } from "./feature-registry";

// ─── Internal: map repository types to evaluation input ────────────────────

function toSubscriptionInput(
  sub: Awaited<ReturnType<typeof getOrganizationCurrentSubscription>>,
): SubscriptionInput | null {
  if (!sub) return null;
  return {
    id: sub.id,
    organizationId: sub.organizationId,
    packageId: sub.packageId,
    status: sub.status,
    startedAt: sub.startedAt,
    expiresAt: sub.expiresAt,
    trialEndsAt: sub.trialEndsAt,
    cancelledAt: sub.cancelledAt,
    replacedAt: sub.replacedAt,
    scheduledStartDate: sub.scheduledStartDate,
  };
}

// ─── Core: getOrganizationEntitlements ─────────────────────────────────────

/**
 * Returns the full entitlement snapshot for an organization.
 * This is the canonical "what is this org entitled to" lookup.
 *
 * Uses React cache() for per-request deduplication — safe, no cross-request
 * staleness. For cross-request caching, see revalidateOrganizationEntitlements.
 */
export const getOrganizationEntitlements = cache(
  async (organizationId: string): Promise<EntitlementSnapshot> => {
    const combined = await getSubscriptionWithPackageFeatures(organizationId);

    if (!combined) {
      // No active/trial subscription — check if any subscription row exists
      // (for accurate status reporting in the snapshot).
      const sub = await getOrganizationCurrentSubscription(organizationId);

      return evaluateEntitlementSnapshot({
        organizationId,
        subscription: toSubscriptionInput(sub),
        package: null,
        packageFeatureKeys: [],
        packageLimits: {},
      });
    }

    const subInput: SubscriptionInput = {
      id: combined.subscription.id,
      organizationId: combined.subscription.organizationId,
      packageId: combined.subscription.packageId,
      status: combined.subscription.status,
      startedAt: combined.subscription.startedAt,
      expiresAt: combined.subscription.expiresAt,
      trialEndsAt: combined.subscription.trialEndsAt,
      cancelledAt: combined.subscription.cancelledAt,
      replacedAt: combined.subscription.replacedAt,
      scheduledStartDate: combined.subscription.scheduledStartDate,
    };

    const pkgInput: PackageInput = {
      id: combined.package.id,
      name: combined.package.name,
      slug: combined.package.slug,
      isActive: combined.package.isActive,
    };

    return evaluateEntitlementSnapshot({
      organizationId,
      subscription: subInput,
      package: pkgInput,
      packageFeatureKeys: combined.features,
      packageLimits: combined.limits as Record<string, number>,
    });
  },
);

// ─── hasFeatureAccess ──────────────────────────────────────────────────────

/**
 * Returns true if the organization has access to the given feature.
 * Does NOT throw — use requireFeatureAccess for that.
 */
export async function hasFeatureAccess(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<boolean> {
  const snapshot = await getOrganizationEntitlements(organizationId);
  return snapshot.activeFeatureKeys.includes(featureKey);
}

// ─── requireFeatureAccess ──────────────────────────────────────────────────

/**
 * Throws an EntitlementError if the organization does not have access
 * to the given feature. Returns void on success.
 *
 * This is the primary function Phase 4 should call at the top of server
 * actions and API routes:
 *
 *   await requireFeatureAccess(organizationId, "member_management");
 */
export async function requireFeatureAccess(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<void> {
  const snapshot = await getOrganizationEntitlements(organizationId);

  // Check feature unknown first
  const access = evaluateFeatureAccess(
    featureKey,
    { effective: snapshot.isActive, status: snapshot.subscriptionStatus, denialReason: snapshot.reason, message: snapshot.message },
    snapshot.activeFeatureKeys,
    snapshot.packageId ? { id: snapshot.packageId, name: snapshot.packageName, slug: "", isActive: true } : null,
  );

  if (!access.allowed) {
    throw new EntitlementError(
      access.reason ?? "FEATURE_NOT_INCLUDED",
      organizationId,
      featureKey,
    );
  }
}

// ─── checkFeatureAccess (non-throwing version) ─────────────────────────────

/**
 * Returns a typed EntitlementCheckResult without throwing.
 * Use in UI components or when you want to handle denial gracefully.
 */
export async function checkFeatureAccess(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<EntitlementCheckResult> {
  const snapshot = await getOrganizationEntitlements(organizationId);

  const subRef: SubscriptionRef | undefined = snapshot.subscriptionId
    ? {
        id: snapshot.subscriptionId,
        packageId: snapshot.packageId ?? "",
        packageName: snapshot.packageName,
        status: snapshot.subscriptionStatus as SubscriptionStatus,
        startDate: snapshot.startDate ?? "",
        endDate: snapshot.endDate,
      }
    : undefined;

  const access = evaluateFeatureAccess(
    featureKey,
    { effective: snapshot.isActive, status: snapshot.subscriptionStatus, denialReason: snapshot.reason, message: snapshot.message },
    snapshot.activeFeatureKeys,
    snapshot.packageId ? { id: snapshot.packageId, name: snapshot.packageName, slug: "", isActive: true } : null,
  );

  if (!access.allowed) {
    return createEntitlementDeniedResult(
      organizationId,
      featureKey,
      access.reason ?? "FEATURE_NOT_INCLUDED",
      subRef,
    );
  }

  return createEntitlementAllowedResult(organizationId, featureKey, subRef);
}

// ─── getCurrentEffectiveSubscription ───────────────────────────────────────

/**
 * Returns the currently effective subscription, or null if none is effective.
 * "Effective" means it grants access right now (active or valid trial).
 */
export async function getCurrentEffectiveSubscription(
  organizationId: string,
): Promise<SubscriptionRef | null> {
  const snapshot = await getOrganizationEntitlements(organizationId);
  if (!snapshot.isActive) return null;
  if (!snapshot.subscriptionId) return null;

  return {
    id: snapshot.subscriptionId,
    packageId: snapshot.packageId ?? "",
    packageName: snapshot.packageName,
    status: snapshot.subscriptionStatus as SubscriptionStatus,
    startDate: snapshot.startDate ?? "",
    endDate: snapshot.endDate,
  };
}

// ─── getFeatureLockReason ──────────────────────────────────────────────────

/**
 * Returns a user-friendly lock reason for a feature, or null if the feature
 * is accessible. Used by UI locked-state components.
 */
export async function getFeatureLockReason(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<{ reason: string; message: string } | null> {
  const result = await checkFeatureAccess(organizationId, featureKey);
  if (result.allowed) return null;
  return {
    reason: result.reason ?? "FEATURE_NOT_INCLUDED",
    message: result.message ?? entitlementUserMessage("FEATURE_NOT_INCLUDED"),
  };
}

// ─── getOrganizationPlanSummary ────────────────────────────────────────────

/**
 * Returns a plan summary suitable for dashboard display.
 * Includes current plan, dates, features, limits, and status.
 */
export async function getOrganizationPlanSummary(
  organizationId: string,
): Promise<PlanSummary> {
  const snapshot = await getOrganizationEntitlements(organizationId);

  const subscription: SubscriptionRef | null = snapshot.subscriptionId
    ? {
        id: snapshot.subscriptionId,
        packageId: snapshot.packageId ?? "",
        packageName: snapshot.packageName,
        status: snapshot.subscriptionStatus as SubscriptionStatus,
        startDate: snapshot.startDate ?? "",
        endDate: snapshot.endDate,
      }
    : null;

  return {
    organizationId,
    subscription,
    package: snapshot.packageId
      ? { id: snapshot.packageId, name: snapshot.packageName, slug: "" }
      : null,
    status: snapshot.subscriptionStatus,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    trialEndsAt: null, // populated below if available
    activeFeatureKeys: snapshot.activeFeatureKeys,
    limits: snapshot.limits,
    nextPlan: null, // Phase 7: scheduled_plan_changes lookup
  };
}

// ─── revalidateOrganizationEntitlements ────────────────────────────────────

/**
 * Revalidation hook. React cache() deduplicates within a single request only,
 * so this is currently a no-op — each new request fetches fresh data.
 *
 * Phase 7: if cross-request caching (unstable_cache with tags) is added,
 * call this after payment success, webhook activation, plan change,
 * cancellation, replacement, or package feature edit to bust the cache.
 */
export function revalidateOrganizationEntitlements(_organizationId: string): void {
  // Intentionally a no-op for now.
  // React cache() is per-request — no stale data persists across requests.
  // Documented for Phase 7 cross-request cache implementation.
}

// ─── Limits convenience ────────────────────────────────────────────────────

/**
 * Returns the organization's effective limits (from the active package).
 * Empty object if no active subscription.
 */
export async function getOrganizationEffectiveLimits(
  organizationId: string,
): Promise<Record<LimitKey, number>> {
  const snapshot = await getOrganizationEntitlements(organizationId);
  return snapshot.limits as Record<LimitKey, number>;
}
