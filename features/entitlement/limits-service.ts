import "server-only";

import { cache } from "react";

import { getOrganizationEntitlements } from "./entitlement-service";
import { getPackageLimits } from "./entitlement-repository";
import type { LimitKey } from "./feature-registry";
import { LIMIT_KEY_SET } from "./feature-registry";

// ─── Types ─────────────────────────────────────────────────────────────────

export type LimitResult = {
  limitKey: LimitKey;
  limitValue: number;
  isUnlimited: boolean;
  sourcePackageId: string | null;
  hasSubscription: boolean;
};

export type UsageLimitSummary = {
  organizationId: string;
  limits: Record<LimitKey, LimitResult>;
  hasActiveSubscription: boolean;
};

// ─── getOrganizationLimits ─────────────────────────────────────────────────

/**
 * Returns all effective limits for an organization from its active package.
 * Returns empty record if no active subscription.
 */
export const getOrganizationLimits = cache(
  async (organizationId: string): Promise<Record<string, number>> => {
    const snapshot = await getOrganizationEntitlements(organizationId);
    if (!snapshot.isActive) return {};
    return snapshot.limits;
  },
);

// ─── getPlanLimit ──────────────────────────────────────────────────────────

/**
 * Returns a specific limit for an organization's active plan.
 * Returns null if the limit is not defined or no active subscription.
 */
export async function getPlanLimit(
  organizationId: string,
  limitKey: LimitKey,
): Promise<LimitResult | null> {
  const snapshot = await getOrganizationEntitlements(organizationId);

  if (!snapshot.isActive) {
    return {
      limitKey,
      limitValue: 0,
      isUnlimited: false,
      sourcePackageId: null,
      hasSubscription: false,
    };
  }

  const rawValue = snapshot.limits[limitKey];
  if (rawValue === undefined) {
    // Limit not defined for this package — treat as unlimited (no restriction)
    return {
      limitKey,
      limitValue: -1,
      isUnlimited: true,
      sourcePackageId: snapshot.packageId,
      hasSubscription: true,
    };
  }

  return {
    limitKey,
    limitValue: rawValue,
    isUnlimited: rawValue === -1,
    sourcePackageId: snapshot.packageId,
    hasSubscription: true,
  };
}

// ─── hasUnlimitedLimit ─────────────────────────────────────────────────────

/**
 * Returns true if the organization's plan has unlimited (-1) for the given
 * limit key, or if the limit is not defined (no restriction).
 */
export async function hasUnlimitedLimit(
  organizationId: string,
  limitKey: LimitKey,
): Promise<boolean> {
  const limit = await getPlanLimit(organizationId, limitKey);
  return limit?.isUnlimited ?? false;
}

// ─── getUsageLimitSummary ──────────────────────────────────────────────────

/**
 * Returns a summary of all limits for the organization's active plan.
 * Usage counts are placeholders (null) — actual usage counting is Phase 9.
 */
export async function getUsageLimitSummary(
  organizationId: string,
): Promise<UsageLimitSummary> {
  const snapshot = await getOrganizationEntitlements(organizationId);
  const hasActive = snapshot.isActive;

  const limits = {} as Record<LimitKey, LimitResult>;

  // Only return limits if subscription is active
  if (hasActive && snapshot.packageId) {
    const rawLimits = await getPackageLimits(snapshot.packageId);
    for (const [code, value] of Object.entries(rawLimits)) {
      if (LIMIT_KEY_SET.has(code)) {
        const key = code as LimitKey;
        limits[key] = {
          limitKey: key,
          limitValue: value,
          isUnlimited: value === -1,
          sourcePackageId: snapshot.packageId,
          hasSubscription: true,
        };
      }
    }
  }

  return {
    organizationId,
    limits,
    hasActiveSubscription: hasActive,
  };
}
