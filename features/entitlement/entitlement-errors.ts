import "server-only";

import type { FeatureKey, SubscriptionStatus } from "./feature-registry";

// ─── Denied reasons ────────────────────────────────────────────────────────

export type EntitlementDeniedReason =
  | "NO_SUBSCRIPTION"
  | "PLAN_EXPIRED"
  | "PLAN_CANCELLED"
  | "PLAN_SUSPENDED"
  | "PLAN_NOT_STARTED"
  | "PLAN_REPLACED"
  | "PAYMENT_REQUIRED"
  | "FEATURE_NOT_INCLUDED"
  | "FEATURE_DISABLED"
  | "FEATURE_UNKNOWN"
  | "ORGANIZATION_NOT_FOUND"
  | "UNAUTHORIZED_ORG_ACCESS";

// ─── Result types ──────────────────────────────────────────────────────────

export type SubscriptionRef = {
  id: string;
  packageId: string;
  packageName: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
};

export type EntitlementCheckResult = {
  allowed: boolean;
  organizationId: string;
  featureKey: FeatureKey;
  reason?: EntitlementDeniedReason | undefined;
  message?: string | undefined;
  subscription?: SubscriptionRef | undefined;
};

export type EntitlementSnapshot = {
  organizationId: string;
  subscriptionId: string | null;
  packageId: string | null;
  packageName: string;
  subscriptionStatus: SubscriptionStatus | "none";
  startDate: string | null;
  endDate: string | null;
  activeFeatureKeys: FeatureKey[];
  limits: Record<string, number>;
  isActive: boolean;
  isExpired: boolean;
  isScheduled: boolean;
  isCancelled: boolean;
  reason: EntitlementDeniedReason | null;
  message: string | null;
  warnings: string[];
};

export type PlanSummary = {
  organizationId: string;
  subscription: SubscriptionRef | null;
  package: {
    id: string;
    name: string;
    slug: string;
  } | null;
  status: SubscriptionStatus | "none";
  startDate: string | null;
  endDate: string | null;
  trialEndsAt: string | null;
  activeFeatureKeys: FeatureKey[];
  limits: Record<string, number>;
  nextPlan?: {
    packageId: string;
    packageName: string;
    startDate: string;
  } | null;
};

// ─── Error class ───────────────────────────────────────────────────────────

export class EntitlementError extends Error {
  readonly reason: EntitlementDeniedReason;
  readonly organizationId: string;
  readonly featureKey: FeatureKey | null;
  readonly statusCode: number;

  constructor(
    reason: EntitlementDeniedReason,
    organizationId: string,
    featureKey: FeatureKey | null = null,
  ) {
    super(entitlementUserMessage(reason));
    this.name = "EntitlementError";
    this.reason = reason;
    this.organizationId = organizationId;
    this.featureKey = featureKey;
    this.statusCode = entitlementHttpStatusCode(reason);
  }
}

// ─── Result helpers ────────────────────────────────────────────────────────

export function createEntitlementDeniedResult(
  organizationId: string,
  featureKey: FeatureKey,
  reason: EntitlementDeniedReason,
  subscription?: SubscriptionRef,
): EntitlementCheckResult {
  return {
    allowed: false,
    organizationId,
    featureKey,
    reason,
    message: entitlementUserMessage(reason),
    subscription,
  };
}

export function createEntitlementAllowedResult(
  organizationId: string,
  featureKey: FeatureKey,
  subscription?: SubscriptionRef,
): EntitlementCheckResult {
  return {
    allowed: true,
    organizationId,
    featureKey,
    subscription,
  };
}

export function isEntitlementError(value: unknown): value is EntitlementError {
  return value instanceof EntitlementError;
}

// ─── HTTP mapping ──────────────────────────────────────────────────────────

export function entitlementHttpStatusCode(reason: EntitlementDeniedReason): number {
  switch (reason) {
    case "UNAUTHORIZED_ORG_ACCESS":
      return 403;
    case "ORGANIZATION_NOT_FOUND":
      return 404;
    case "NO_SUBSCRIPTION":
    case "PAYMENT_REQUIRED":
      return 402;
    case "PLAN_EXPIRED":
    case "PLAN_CANCELLED":
    case "PLAN_SUSPENDED":
    case "PLAN_NOT_STARTED":
    case "PLAN_REPLACED":
    case "FEATURE_NOT_INCLUDED":
    case "FEATURE_DISABLED":
    case "FEATURE_UNKNOWN":
      return 403;
    default:
      return 403;
  }
}

export function mapEntitlementErrorToHttpResponse(
  error: EntitlementError,
): { status: number; body: Record<string, unknown> } {
  return {
    status: error.statusCode,
    body: {
      error: "FEATURE_LOCKED",
      reason: error.reason,
      message: error.message,
      featureKey: error.featureKey,
    },
  };
}

// ─── User-facing messages ──────────────────────────────────────────────────

export function entitlementUserMessage(reason: EntitlementDeniedReason): string {
  switch (reason) {
    case "NO_SUBSCRIPTION":
      return "Your organization does not have an active subscription. Please choose a plan to continue.";
    case "PLAN_EXPIRED":
      return "Your current plan has expired. Please renew or upgrade your plan.";
    case "PLAN_CANCELLED":
      return "Your subscription has been cancelled. Reactivate your plan to restore access.";
    case "PLAN_SUSPENDED":
      return "Your subscription has been suspended. Contact support to restore access.";
    case "PLAN_NOT_STARTED":
      return "This plan is scheduled but has not started yet.";
    case "PLAN_REPLACED":
      return "Your previous plan was replaced and is no longer active.";
    case "PAYMENT_REQUIRED":
      return "Payment is required before this feature can be used.";
    case "FEATURE_NOT_INCLUDED":
      return "This feature is not included in your current plan. Please upgrade to access it.";
    case "FEATURE_DISABLED":
      return "This feature is currently unavailable.";
    case "FEATURE_UNKNOWN":
      return "This feature is not recognized. Contact support if you believe this is an error.";
    case "ORGANIZATION_NOT_FOUND":
      return "Organization not found.";
    case "UNAUTHORIZED_ORG_ACCESS":
      return "You do not have access to this organization.";
    default:
      return "Access denied.";
  }
}
