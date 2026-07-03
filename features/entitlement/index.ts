// ─── Registry (Phase 2) ────────────────────────────────────────────────────
export type {
  FeatureKey,
  LimitKey,
  SubscriptionStatus,
  FeatureCategoryCode,
  FeatureCategoryMeta,
} from "./feature-registry";

export {
  FEATURE_KEYS,
  FEATURE_KEY_SET,
  isFeatureKey,
  LIMIT_KEYS,
  LIMIT_KEY_SET,
  isLimitKey,
  SUBSCRIPTION_STATUSES,
  ACTIVE_ENTITLEMENT_STATUSES,
  PENDING_FUTURE_STATUSES,
  REVOKED_STATUSES,
  FEATURE_CATEGORIES,
  FEATURE_CATEGORY_BY_CODE,
  MODULE_FEATURE_MAP,
} from "./feature-registry";

// ─── Repository (Phase 2) ──────────────────────────────────────────────────
export {
  getPackageFeatures,
  getPackageFeatureRows,
  getPackageLimits,
  getPackageLimitRows,
  getOrganizationCurrentSubscription,
  getOrganizationPurchasedPackage,
  getSubscriptionWithPackageFeatures,
  getPackageEntitlementsAdmin,
  syncOrganizationEntitlements,
  syncOrganizationUsageLimits,
} from "./entitlement-repository";

export type {
  PackageFeatureRow,
  PackageLimitRow,
  PackageSummary,
  SubscriptionSummary,
  SubscriptionWithPackageFeatures,
} from "./entitlement-repository";

// ─── Errors (Phase 3) ──────────────────────────────────────────────────────
export {
  EntitlementError,
  createEntitlementDeniedResult,
  createEntitlementAllowedResult,
  isEntitlementError,
  entitlementHttpStatusCode,
  mapEntitlementErrorToHttpResponse,
  entitlementUserMessage,
} from "./entitlement-errors";

export type {
  EntitlementDeniedReason,
  EntitlementCheckResult,
  EntitlementSnapshot,
  PlanSummary,
  SubscriptionRef,
} from "./entitlement-errors";

// ─── Evaluation logic (Phase 3 — pure, testable) ───────────────────────────
export {
  evaluateEffectiveSubscription,
  evaluateFeatureAccess,
  evaluateEntitlementSnapshot,
  toSubscriptionRef,
} from "./entitlement-evaluate";

export type {
  SubscriptionInput,
  PackageInput,
  EntitlementEvalInput,
  EffectiveSubscriptionResult,
  FeatureAccessResult,
} from "./entitlement-evaluate";

// ─── Entitlement service (Phase 3 — async, server-only) ────────────────────
export {
  getOrganizationEntitlements,
  hasFeatureAccess,
  requireFeatureAccess,
  checkFeatureAccess,
  getCurrentEffectiveSubscription,
  getFeatureLockReason,
  getOrganizationPlanSummary,
  getOrganizationEffectiveLimits,
  revalidateOrganizationEntitlements,
} from "./entitlement-service";

export {
  buildPortalNavFromEntitlements,
  canAccessPortalHref,
  denyHiddenFeatureRoute,
  getPortalRouteGate,
  mapHiddenFeatureApiDenial,
  PORTAL_NAV_REGISTRY,
  PORTAL_ROUTE_REGISTRY,
  requirePortalFeatureAccess,
  validatePortalRegistryFeatureKeys,
} from "./portal-gates";

export type { PortalKey, PortalVisibilityMode } from "./portal-gates";

export {
  CANONICAL_PACKAGE_TIERS,
  normalizePackageTier,
  normalizePackageTierOrFallback,
} from "./package-tier";

export type { CanonicalPackageTier } from "./package-tier";

// ─── Auth context (Phase 3 — tenant safety) ────────────────────────────────
export {
  getAuthenticatedUser,
  getOrganizationForCurrentUser,
  assertUserBelongsToOrganization,
  getCurrentUserOrganizationContext,
  isSuperAdminContext,
} from "./auth-context";

export type { OrganizationAuthContext, AuthenticatedContext } from "./auth-context";

// ─── Limits service (Phase 3) ──────────────────────────────────────────────
export {
  getOrganizationLimits,
  getPlanLimit,
  hasUnlimitedLimit,
  getUsageLimitSummary,
  canCreateResource,
  requireResourceLimit,
  getOrganizationUsage,
} from "./limits-service";

export type { LimitResult, UsageLimitSummary, ResourceCheckResult } from "./limits-service";

// ─── Action guards (Phase 4 — server action protection) ────────────────────
export {
  requireOrganizationFeatureAccess,
  requireOrgFeatureAccess,
  requireOrgFeatureAccessAll,
  entitlementActionCatch,
  entitlementSimpleCatch,
} from "./action-guards";

export type { RequireOrganizationFeatureAccessInput } from "./action-guards";

// ─── API guards (Phase 4 — API route protection) ───────────────────────────
export {
  requireApiFeatureAccess,
  requireApiFeatureAccessAll,
  withEntitlementErrorHandling,
} from "./api-guards";

// ─── Audit events + service (Phase 9) ──────────────────────────────────────
export { AUDIT } from "./audit-events";
export type { AuditEventType } from "./audit-events";
export {
  logFeatureAccessDenied,
  logRouteAccessDenied,
  logLimitReached,
  logSubscriptionActivated,
  logSubscriptionCancelled,
  logSecurityEvent,
  logWebhookEvent,
} from "./audit-service";
