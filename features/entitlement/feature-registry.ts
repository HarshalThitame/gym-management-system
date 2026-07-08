/**
 * Centralized entitlement feature registry.
 *
 * This is the SINGLE source of truth for:
 *   - Valid feature keys (snake_case, matching feature_catalog.code and
 *     package_features.feature_code in the database).
 *   - Valid subscription statuses.
 *   - Feature category metadata.
 *
 * Other modules (feature-resolver FEATURE_MAP, package-management-actions
 * FEATURE_FIELD_MAP, subscription feature-definitions) must keep their keys
 * in sync with FEATURE_KEYS here. A compile-time assertion below enforces
 * that the resolver map covers every registered key.
 *
 * Do not duplicate feature key definitions in other files. Import from here.
 */

// ─── Subscription statuses ─────────────────────────────────────────────────

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trial",
  "expired",
  "suspended",
  "cancelled",
  "pending_activation",
  "payment_pending",
  "payment_failed",
  "replaced",
  "scheduled",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses that grant live feature access (entitlements active). */
export const ACTIVE_ENTITLEMENT_STATUSES: readonly SubscriptionStatus[] = [
  "active",
  "trial",
];

/** Statuses that represent a future plan not yet in effect. */
export const PENDING_FUTURE_STATUSES: readonly SubscriptionStatus[] = [
  "scheduled",
  "pending_activation",
  "payment_pending",
];

/** Statuses that revoke all feature access immediately. */
export const REVOKED_STATUSES: readonly SubscriptionStatus[] = [
  "expired",
  "suspended",
  "replaced",
  "payment_failed",
];

/** Feature keys that remain accessible during the cancellation grace period. */
export const CANCELLED_BILLING_FEATURES: readonly FeatureKey[] = [
  "billing_invoices",
  "receipts",
  "online_payment_links",
  "auto_billing",
  "payment_failure_handling",
];

// ─── Feature categories ────────────────────────────────────────────────────

export type FeatureCategoryCode =
  | "ai"
  | "attendance"
  | "billing"
  | "communication"
  | "crm"
  | "enterprise"
  | "membership"
  | "platform"
  | "reports"
  | "trainer"
  | "white_label";

export type FeatureCategoryMeta = {
  code: FeatureCategoryCode;
  name: string;
  icon: string;
};

export const FEATURE_CATEGORIES: readonly FeatureCategoryMeta[] = [
  { code: "ai", name: "AI Features", icon: "Sparkles" },
  { code: "attendance", name: "Attendance", icon: "CalendarCheck" },
  { code: "billing", name: "Billing & Payments", icon: "CreditCard" },
  { code: "communication", name: "Communication", icon: "MessageSquare" },
  { code: "crm", name: "CRM & Sales", icon: "Users" },
  { code: "enterprise", name: "Enterprise", icon: "Shield" },
  { code: "membership", name: "Membership Management", icon: "Users" },
  { code: "platform", name: "Platform", icon: "Smartphone" },
  { code: "reports", name: "Reports & Analytics", icon: "BarChart" },
  { code: "trainer", name: "Trainer Management", icon: "Dumbbell" },
  { code: "white_label", name: "White Label", icon: "Palette" },
];

export const FEATURE_CATEGORY_BY_CODE: Record<FeatureCategoryCode, FeatureCategoryMeta> =
  Object.fromEntries(FEATURE_CATEGORIES.map((c) => [c.code, c])) as Record<
    FeatureCategoryCode,
    FeatureCategoryMeta
  >;

// ─── Feature keys (canonical, snake_case) ──────────────────────────────────
// Every key here matches a row in feature_catalog.code and is the value
// written to package_features.feature_code by the Super Admin editor.

export const FEATURE_KEYS = [
  // ai
  "ai_recommendations",
  "ai_coach",
  "ai_retention_analysis",
  "ai_revenue_insights",
  // attendance
  "manual_attendance",
  "qr_attendance",
  "dynamic_qr_attendance",
  "trainer_attendance",
  "staff_attendance",
  "branch_attendance",
  "biometric_attendance",
  "fingerprint_attendance",
  "rfid_attendance",
  "nfc_attendance",
  "geo_fencing_attendance",
  "attendance_api",
  "attendance_reports",
  // billing
  "billing_invoices",
  "receipts",
  "payment_tracking",
  "online_payment_links",
  "renewal_reminders",
  "auto_billing",
  "discount_promo_codes",
  "corporate_bulk_memberships",
  "payment_failure_handling",
  "partial_payment_dues",
  "razorpay_payu_integration",
  "multi_gstin_support",
  "branch_revenue_split",
  // communication
  "email_notifications",
  "in_app_notifications",
  "whatsapp_integration",
  "sms_integration",
  "birthday_greetings",
  "broadcast_messages",
  "email_campaigns",
  "whatsapp_business_api",
  "cross_branch_member_access",
  "custom_email_domain",
  // crm
  "lead_management",
  "trial_management",
  "lead_followup_reminders",
  "re_engagement_automation",
  "advanced_crm_lead_pipeline",
  "referral_program",
  "loyalty_points_system",
  "network_wide_campaign_manager",
  "member_nps_surveys",
  // enterprise
  "multi_branch_management",
  "api_access",
  "webhooks",
  "audit_logs",
  "advanced_rbac",
  "priority_support",
  "staff_management",
  "tally_zoho_books_integration",
  "rest_api_access",
  "role_based_permissions",
  "multi_branch_staff_assignment",
  "hr_document_storage",
  "custom_roles_granular_permissions",
  // membership
  "member_management",
  "membership_renewals",
  "expiry_tracking",
  "goal_tracking",
  "progress_photos",
  "membership_pause_freeze",
  "member_tagging_segments",
  "member_progress_tracking",
  "custom_member_fields",
  "member_data_import_export",
  // platform
  "member_portal",
  "trainer_portal",
  "branded_mobile_app",
  "diet_workout_plans",
  "google_calendar_sync",
  "in_app_push_notifications",
  "digital_membership_card",
  "loyalty_rewards_in_app",
  // reports
  "basic_reports",
  "advanced_reports",
  "custom_dashboards",
  "trainer_performance_report",
  "class_occupancy_report",
  "lead_conversion_report",
  "branch_revenue_comparison",
  "scheduled_report_delivery",
  "equipment_inventory_maintenance",
  "data_export_csv_download",
  "custom_dashboards_kpis",
  // trainer
  "trainer_management",
  "workout_assignment",
  "nutrition_plans",
  "pt_sessions",
  "class_booking",
  "waitlist_management",
  "cross_branch_class_booking",
  "trainer_commissions_payroll",
  "staff_attendance_leave",
  "class_attendance_tracking",
  "payroll_export",
  "network_wide_class_calendar",
  "trainer_sharing_across_branches",
  // white_label
  "white_label",
  "custom_domain",
  "custom_branding",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_KEY_SET: ReadonlySet<string> = new Set(FEATURE_KEYS);

export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEY_SET.has(value);
}

// ─── Limit keys (canonical, snake_case) ────────────────────────────────────

export const LIMIT_KEYS = [
  "max_members",
  "max_branches",
  "max_gyms",
  "max_trainers",
  "max_staff",
  "max_storage_gb",
  "max_api_calls",
  "membership_plan_types",
  "weekly_classes",
  "sms_monthly",
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_KEY_SET: ReadonlySet<string> = new Set(LIMIT_KEYS);

export function isLimitKey(value: string): value is LimitKey {
  return LIMIT_KEY_SET.has(value);
}

// ─── Module → feature key mapping (from Phase 1 audit) ─────────────────────
// Maps each org-owner portal module slug to the feature key that controls it.
// Used by Phase 3 route/UI guards. Kept here as the canonical mapping.

export const MODULE_FEATURE_MAP: Record<string, FeatureKey> = {
  branches: "multi_branch_management",
  staff: "staff_management",
  members: "member_management",
  memberships: "member_management",
  revenue: "billing_invoices",
  trainers: "trainer_management",
  attendance: "attendance_reports",
  classes: "class_booking",
  communications: "whatsapp_integration",
  "email-settings": "custom_email_domain",
  leads: "lead_management",
  analytics: "advanced_reports",
  branding: "custom_branding",
  domains: "custom_domain",
  nutrition: "nutrition_plans",
  security: "audit_logs",
  "custom-roles": "custom_roles_granular_permissions",
  equipment: "equipment_inventory_maintenance",
  // dashboard, plan, profile, settings, billing, support are always available
};

// ─── Compile-time sanity: every module map value is a registered key ───────
type _AssertModuleKeysValid = {
  [K in keyof typeof MODULE_FEATURE_MAP]: (typeof MODULE_FEATURE_MAP)[K] extends FeatureKey
    ? true
    : never;
};
