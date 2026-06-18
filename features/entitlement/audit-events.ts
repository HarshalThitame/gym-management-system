/**
 * Canonical audit event type constants.
 *
 * Every entitlement, payment, subscription, and security audit event
 * must use one of these constants as the `action` field in writeAuditLog.
 * This ensures consistent naming, searchability, and reporting.
 */

// ─── Feature access events ─────────────────────────────────────────────────

export const AUDIT = {
  // Feature access
  FEATURE_ACCESS_ALLOWED: "entitlement.feature_allowed",
  FEATURE_ACCESS_DENIED: "entitlement.feature_denied",
  ROUTE_ACCESS_DENIED: "entitlement.route_denied",

  // Limit events
  LIMIT_CHECK_ALLOWED: "entitlement.limit_allowed",
  LIMIT_REACHED_DENIED: "entitlement.limit_denied",
  BULK_IMPORT_BLOCKED: "entitlement.bulk_import_blocked",

  // Subscription lifecycle
  PLAN_PURCHASE_STARTED: "subscription.purchase_started",
  PAYMENT_PENDING_CREATED: "subscription.payment_pending",
  PAYMENT_VERIFIED_CLIENT: "subscription.payment_verified_client",
  WEBHOOK_PAYMENT_CAPTURED: "subscription.webhook_captured",
  WEBHOOK_PAYMENT_FAILED: "subscription.webhook_failed",
  WEBHOOK_DUPLICATE_IGNORED: "subscription.webhook_duplicate",
  WEBHOOK_SIGNATURE_INVALID: "subscription.webhook_signature_invalid",
  SUBSCRIPTION_ACTIVATED: "subscription.activated",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SUBSCRIPTION_REPLACED: "subscription.replaced",
  SUBSCRIPTION_SCHEDULED: "subscription.scheduled",
  SUBSCRIPTION_EXPIRED: "subscription.expired",

  // Package admin
  PACKAGE_CREATED: "package.created",
  PACKAGE_UPDATED: "package.updated",
  PACKAGE_DELETED: "package.deleted",
  PACKAGE_ARCHIVED: "package.archived",
  PACKAGE_FEATURE_ADDED: "package.feature_added",
  PACKAGE_FEATURE_REMOVED: "package.feature_removed",
  PACKAGE_LIMIT_UPDATED: "package.limit_updated",

  // Security
  CROSS_TENANT_ACCESS_DENIED: "security.cross_tenant_denied",
  PRICE_TAMPERING_DETECTED: "security.price_tampering",
  AMOUNT_MISMATCH_DETECTED: "security.amount_mismatch",
  PACKAGE_TAMPERING_DETECTED: "security.package_tampering",
  UNAUTHORIZED_PLAN_ACTION: "security.unauthorized_plan_action",
  DUPLICATE_SUBSCRIPTION_DETECTED: "security.duplicate_subscription",
  ORG_MISMATCH_DETECTED: "security.org_mismatch",

  // Org owner actions
  ORG_CANCEL_SUBSCRIPTION: "organization_owner.cancel_subscription",
  ORG_AUTO_RENEW_TOGGLE: "organization_owner.auto_renew_toggle",
  ORG_ADDON_ASSIGNED: "organization_owner.addon_assigned",
  ORG_ADDON_REMOVED: "organization_owner.addon_removed",
} as const;

export type AuditEventType = (typeof AUDIT)[keyof typeof AUDIT];
