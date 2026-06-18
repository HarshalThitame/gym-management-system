/**
 * Pure entitlement evaluation logic — no DB access, no side effects.
 * Fully testable. The async entitlement-service.ts wraps these with DB queries.
 */

import type { FeatureKey, SubscriptionStatus } from "./feature-registry";
import { FEATURE_KEY_SET } from "./feature-registry";
import type {
  EntitlementDeniedReason,
  EntitlementSnapshot,
  SubscriptionRef,
} from "./entitlement-errors";

// ─── Input types (data the async service fetches) ──────────────────────────

export type SubscriptionInput = {
  id: string;
  organizationId: string;
  packageId: string;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  replacedAt: string | null;
  scheduledStartDate: string | null;
};

export type PackageInput = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type EntitlementEvalInput = {
  organizationId: string;
  subscription: SubscriptionInput | null;
  package: PackageInput | null;
  packageFeatureKeys: FeatureKey[];
  packageLimits: Record<string, number>;
  warnings?: string[];
};

// ─── Effective subscription evaluation ─────────────────────────────────────

export type EffectiveSubscriptionResult = {
  effective: boolean;
  status: SubscriptionStatus | "none";
  denialReason: EntitlementDeniedReason | null;
  message: string | null;
};

/**
 * Determines whether a subscription is currently effective (grants access).
 *
 * Phase 2 business rules:
 *   - active + (expires_at null or >= now) → effective
 *   - active + expires_at < now → denied (PLAN_EXPIRED)
 *   - trial + (trial_ends_at null or >= now) → effective
 *   - trial + trial_ends_at < now → denied (PLAN_EXPIRED)
 *   - cancelled → denied immediately (cancel-immediate, per Phase 2)
 *   - suspended → denied
 *   - expired → denied
 *   - replaced → denied
 *   - payment_failed / payment_pending → denied (PAYMENT_REQUIRED)
 *   - pending_activation → denied (PLAN_NOT_STARTED)
 *   - scheduled + start_date > now → denied (PLAN_NOT_STARTED)
 *   - scheduled + start_date <= now → denied (must be activated by cron first)
 *   - no subscription → denied (NO_SUBSCRIPTION)
 */
export function evaluateEffectiveSubscription(
  sub: SubscriptionInput | null,
  now: number = Date.now(),
): EffectiveSubscriptionResult {
  if (!sub) {
    return {
      effective: false,
      status: "none",
      denialReason: "NO_SUBSCRIPTION",
      message: "Your organization does not have an active subscription. Please choose a plan to continue.",
    };
  }

  const status = sub.status;

  // ── Active ──
  if (status === "active") {
    if (sub.expiresAt && new Date(sub.expiresAt).getTime() < now) {
      return {
        effective: false,
        status,
        denialReason: "PLAN_EXPIRED",
        message: "Your current plan has expired. Please renew or upgrade your plan.",
      };
    }
    return { effective: true, status, denialReason: null, message: null };
  }

  // ── Trial ──
  if (status === "trial") {
    if (sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() < now) {
      return {
        effective: false,
        status,
        denialReason: "PLAN_EXPIRED",
        message: "Your trial has expired. Please choose a plan to continue.",
      };
    }
    return { effective: true, status, denialReason: null, message: null };
  }

  // ── Cancelled (cancel-immediate per Phase 2) ──
  if (status === "cancelled") {
    return {
      effective: false,
      status,
      denialReason: "PLAN_CANCELLED",
      message: "Your subscription has been cancelled. Reactivate your plan to restore access.",
    };
  }

  // ── Suspended ──
  if (status === "suspended") {
    return {
      effective: false,
      status,
      denialReason: "PLAN_SUSPENDED",
      message: "Your subscription has been suspended. Contact support to restore access.",
    };
  }

  // ── Expired ──
  if (status === "expired") {
    return {
      effective: false,
      status,
      denialReason: "PLAN_EXPIRED",
      message: "Your current plan has expired. Please renew or upgrade your plan.",
    };
  }

  // ── Replaced ──
  if (status === "replaced") {
    return {
      effective: false,
      status,
      denialReason: "PLAN_REPLACED",
      message: "Your previous plan was replaced and is no longer active.",
    };
  }

  // ── Payment failed / pending ──
  if (status === "payment_failed" || status === "payment_pending") {
    return {
      effective: false,
      status,
      denialReason: "PAYMENT_REQUIRED",
      message: "Payment is required before this feature can be used.",
    };
  }

  // ── Pending activation / scheduled (future) ──
  if (status === "pending_activation" || status === "scheduled") {
    return {
      effective: false,
      status,
      denialReason: "PLAN_NOT_STARTED",
      message: "This plan is scheduled but has not started yet.",
    };
  }

  // Unknown status — deny safely
  return {
    effective: false,
    status,
    denialReason: "PLAN_EXPIRED",
    message: "Your subscription is not active.",
  };
}

// ─── Feature access evaluation ─────────────────────────────────────────────

export type FeatureAccessResult = {
  allowed: boolean;
  reason: EntitlementDeniedReason | null;
  message: string | null;
};

/**
 * Evaluates whether a specific feature should be accessible.
 *
 * Rules:
 *   1. Unknown feature key (not in registry) → deny (FEATURE_UNKNOWN)
 *   2. Subscription not effective → deny with the subscription's denial reason
 *   3. Feature not in package's enabled features → deny (FEATURE_NOT_INCLUDED)
 *   4. Package is archived/inactive → deny (FEATURE_DISABLED) — defensive even
 *      for effective subscriptions, since a deleted package should not grant
 *      access. (Phase 2 keeps purchased packages valid via on delete restrict,
 *      but an archived is_active=false package is flagged here.)
 *   5. Otherwise → allow
 */
export function evaluateFeatureAccess(
  featureKey: FeatureKey,
  effective: EffectiveSubscriptionResult,
  packageFeatureKeys: FeatureKey[],
  pkg: PackageInput | null,
): FeatureAccessResult {
  // 1. Unknown feature key
  if (!FEATURE_KEY_SET.has(featureKey)) {
    return {
      allowed: false,
      reason: "FEATURE_UNKNOWN",
      message: "This feature is not recognized. Contact support if you believe this is an error.",
    };
  }

  // 2. Subscription not effective
  if (!effective.effective) {
    return {
      allowed: false,
      reason: effective.denialReason,
      message: effective.message,
    };
  }

  // 3. Package archived (defensive)
  if (pkg && !pkg.isActive) {
    return {
      allowed: false,
      reason: "FEATURE_DISABLED",
      message: "This feature is currently unavailable.",
    };
  }

  // 4. Feature not included in package
  if (!packageFeatureKeys.includes(featureKey)) {
    return {
      allowed: false,
      reason: "FEATURE_NOT_INCLUDED",
      message: "This feature is not included in your current plan. Please upgrade to access it.",
    };
  }

  // 5. Allowed
  return { allowed: true, reason: null, message: null };
}

// ─── Full snapshot evaluation ──────────────────────────────────────────────

/**
 * Produces the full entitlement snapshot for an organization.
 * Combines subscription effectiveness + feature list + limits.
 */
export function evaluateEntitlementSnapshot(input: EntitlementEvalInput): EntitlementSnapshot {
  const { organizationId, subscription, package: pkg, packageFeatureKeys, packageLimits } = input;
  const warnings = input.warnings ?? [];

  const effective = evaluateEffectiveSubscription(subscription);

  const isActive = effective.effective;
  const isExpired =
    effective.denialReason === "PLAN_EXPIRED" ||
    effective.denialReason === "PLAN_CANCELLED";
  const isScheduled = effective.denialReason === "PLAN_NOT_STARTED";
  const isCancelled = subscription?.status === "cancelled";

  const activeFeatureKeys: FeatureKey[] =
    isActive && pkg?.isActive !== false ? packageFeatureKeys : [];

  return {
    organizationId,
    subscriptionId: subscription?.id ?? null,
    packageId: pkg?.id ?? null,
    packageName: pkg?.name ?? "No Plan",
    subscriptionStatus: effective.status,
    startDate: subscription?.startedAt ?? null,
    endDate: subscription?.expiresAt ?? null,
    activeFeatureKeys,
    limits: isActive ? packageLimits : {},
    isActive,
    isExpired,
    isScheduled,
    isCancelled,
    reason: effective.denialReason,
    message: effective.message,
    warnings,
  };
}

// ─── Subscription ref helper ───────────────────────────────────────────────

export function toSubscriptionRef(
  sub: SubscriptionInput,
  packageName: string,
): SubscriptionRef {
  return {
    id: sub.id,
    packageId: sub.packageId,
    packageName,
    status: sub.status,
    startDate: sub.startedAt,
    endDate: sub.expiresAt,
  };
}
