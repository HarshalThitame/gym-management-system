import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getOrganizationEntitlements } from "./entitlement-service";
import { getPackageLimits } from "./entitlement-repository";
import { logLimitReached } from "./audit-service";
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

// ─── Resource check types ──────────────────────────────────────────────────

export type ResourceCheckResult = {
  allowed: boolean;
  limitKey: string;
  currentUsage: number;
  limitValue: number;
  isUnlimited: boolean;
  remaining: number | null;
  reason?: string;
  message?: string;
};

// ─── Usage counters (server-only DB queries) ───────────────────────────────

async function countBranches(organizationId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { count } = await (supabase as any)
      .from("branches")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["active"]);
    return count ?? 0;
  } catch { return 0; }
}

async function countMembers(organizationId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { count } = await (supabase as any)
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["active"]);
    return count ?? 0;
  } catch { return 0; }
}

async function countTrainers(organizationId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { count } = await (supabase as any)
      .from("trainers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["active"]);
    return count ?? 0;
  } catch { return 0; }
}

async function countStaff(organizationId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { count } = await (supabase as any)
      .from("branch_users")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("role_name", "in", '("member","trainer")');
    return count ?? 0;
  } catch { return 0; }
}

const USAGE_COUNTERS: Record<string, (orgId: string) => Promise<number>> = {
  max_branches: countBranches,
  max_members: countMembers,
  max_trainers: countTrainers,
  max_staff: countStaff,
};

// ─── getOrganizationUsage ──────────────────────────────────────────────────

export async function getOrganizationUsage(
  organizationId: string,
): Promise<Record<string, number>> {
  const usage: Record<string, number> = {};
  for (const [key, counter] of Object.entries(USAGE_COUNTERS)) {
    usage[key] = await counter(organizationId);
  }
  return usage;
}

// ─── canCreateResource ─────────────────────────────────────────────────────

// ─── canCreateResource ─────────────────────────────────────────────────────
//
// Concurrency safety note:
// This function reads the current usage count and checks it against the plan
// limit in two separate DB queries. In high-concurrency scenarios (e.g., two
// simultaneous member creations when 1 slot remains), a race condition is
// possible. The recommended approach for production hardening:
//
//   1. Use a PostgreSQL function that atomically checks count + inserts
//      within a single transaction (SELECT FOR UPDATE + INSERT).
//   2. Or use pg_advisory_lock(hashtext(org_id || limit_key)) before the
//      check+insert sequence and release it after.
//   3. The existing create actions in member/branch/trainer/staff already
//      do a count-check-then-insert pattern — same race condition window.
//
// For most gym management use cases (low concurrent creation volume), the
// current two-query approach is acceptable. If/when an atomic RPC is created,
// replace this function's implementation with a call to that RPC.
// ────────────────────────────────────────────────────────────────────────────

export async function canCreateResource(
  organizationId: string,
  limitKey: LimitKey,
  increment = 1,
): Promise<ResourceCheckResult> {
  const limit = await getPlanLimit(organizationId, limitKey);
  if (!limit) {
    return {
      allowed: false, limitKey, currentUsage: 0, limitValue: 0,
      isUnlimited: false, remaining: 0,
      reason: "NO_ACTIVE_SUBSCRIPTION",
      message: "Your organization does not have an active subscription.",
    };
  }

  if (limit.isUnlimited) {
    return {
      allowed: true, limitKey, currentUsage: 0, limitValue: -1,
      isUnlimited: true, remaining: null,
    };
  }

  const currentUsage = USAGE_COUNTERS[limitKey]
    ? await USAGE_COUNTERS[limitKey]!(organizationId)
    : 0;

  const remaining = Math.max(0, limit.limitValue - currentUsage);
  const allowed = currentUsage + increment <= limit.limitValue;

  if (!allowed) {
    // Audit the denial (fire-and-forget, never blocks)
    logLimitReached({
      actorId: null, organizationId, limitKey,
      currentUsage, limitValue: limit.limitValue, attemptedIncrement: increment,
    }).catch(() => {});
  }

  return {
    allowed,
    limitKey,
    currentUsage,
    limitValue: limit.limitValue,
    isUnlimited: false,
    remaining,
    ...(!allowed ? {
      reason: "LIMIT_REACHED",
      message: `Your current plan allows only ${limit.limitValue} ${limitKey.replace("max_", "")}. You have ${currentUsage}. Please upgrade to add more.`,
    } : {}),
  };
}

// ─── requireResourceLimit ──────────────────────────────────────────────────

export async function requireResourceLimit(
  organizationId: string,
  limitKey: LimitKey,
  increment = 1,
): Promise<ResourceCheckResult> {
  const result = await canCreateResource(organizationId, limitKey, increment);
  if (!result.allowed) {
    throw new Error(result.message ?? "Resource limit reached. Please upgrade your plan.");
  }
  return result;
}
