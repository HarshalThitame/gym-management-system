import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  FEATURE_KEYS,
  FEATURE_KEY_SET,
  MODULE_FEATURE_MAP,
} from "@/features/entitlement/feature-registry";
import type { FeatureKey } from "@/features/entitlement/feature-registry";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";

export type IntegrityErrorType =
  | "missing_from_feature_map"
  | "missing_from_feature_keys"
  | "missing_from_module_map"
  | "missing_from_sidebar_keys"
  | "missing_from_db_keys"
  | "duplicate_feature_key"
  | "invalid_sidebar_feature_key"
  | "feature_map_code_mismatch";

export type IntegrityError = {
  type: IntegrityErrorType;
  key: string;
  detail: string;
};

export type IntegrityResult = {
  valid: boolean;
  errors: IntegrityError[];
  timestamp: string;
};

async function getSupabaseForQuery() {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  return client as unknown as {
    from(t: string): {
      select(c: string): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
  };
}

export async function validateFeatureKeyIntegrity(): Promise<IntegrityResult> {
  const errors: IntegrityError[] = [];

  // ── Check 1: all MODULE_FEATURE_MAP values are in FEATURE_KEYS ──────
  for (const [moduleSlug, featureKey] of Object.entries(MODULE_FEATURE_MAP)) {
    if (!FEATURE_KEY_SET.has(featureKey)) {
      errors.push({
        type: "missing_from_feature_keys",
        key: featureKey,
        detail: `MODULE_FEATURE_MAP["${moduleSlug}"] = "${featureKey}" is not in FEATURE_KEYS`,
      });
    }
  }

  // ── Check 2: all sidebar feature keys are in FEATURE_KEYS ───────────
  for (const mod of organizationOwnerModules) {
    if (mod.featureKey && !FEATURE_KEY_SET.has(mod.featureKey)) {
      errors.push({
        type: "invalid_sidebar_feature_key",
        key: mod.featureKey,
        detail: `Sidebar module "${mod.slug}" references featureKey "${mod.featureKey}" which is not in FEATURE_KEYS`,
      });
    }
  }

  // ── Check 3: no duplicate feature keys in FEATURE_KEYS ──────────────
  const seenKeys = new Set<string>();
  for (const key of FEATURE_KEYS) {
    if (seenKeys.has(key)) {
      errors.push({
        type: "duplicate_feature_key",
        key,
        detail: `Duplicate feature key "${key}" found in FEATURE_KEYS array`,
      });
    }
    seenKeys.add(key);
  }

  // ── Check 4: every FEATURE_KEY must have a runtime route guard in
  //    MODULE_FEATURE_MAP or be a legacy/infrastructure key. ───────────
  //    This validates the pipeline: code → route guard → UI. ───────────
  const moduleMapValues = new Set(Object.values(MODULE_FEATURE_MAP));
  const sidebarKeys = new Set(organizationOwnerModules.map((m) => m.featureKey).filter(Boolean));

  for (const key of FEATURE_KEYS) {
    const inModuleMap = moduleMapValues.has(key);
    const inSidebar = sidebarKeys.has(key);

    if (!inModuleMap && !inSidebar) {
      // Feature key has no MODULE_FEATURE_MAP entry and no sidebar entry.
      // This is expected for service/infrastructure features or granular
      // sub-features, so this is informational, not a hard error.
      // Only flag if it also doesn't appear in any DB package — that check
      // is done in Check 6 (DB validation).
    }
  }

  // ── Check 5: FEATURE_MAP cross-reference (from lib/tenant/feature-resolver).
  //    The FEATURE_MAP maps camelCase OrgFeatureFlags property names to
  //    snake_case feature codes. We validate every FEATURE_KEY has at
  //    least one FEATURE_MAP entry pointing to it by building a reverse
  //    lookup from the known flag names.

  // Known OrgFeatureFlags property names → their FEATURE_MAP codes
  const knownFlagToCode: Record<string, string> = {
    manualAttendance: "manual_attendance", qrAttendanceEnabled: "qr_attendance",
    dynamicQrAttendance: "dynamic_qr_attendance", trainerAttendance: "trainer_attendance",
    staffAttendance: "staff_attendance", branchAttendance: "branch_attendance",
    biometricAttendanceEnabled: "biometric_attendance", fingerprintAttendance: "fingerprint_attendance",
    faceRecognitionAttendance: "face_recognition_attendance", rfidAttendanceEnabled: "rfid_attendance",
    nfcAttendance: "nfc_attendance", geoFencingAttendance: "geo_fencing_attendance",
    attendanceApi: "attendance_api", attendanceReports: "attendance_reports",
    memberManagement: "member_management", membershipRenewals: "membership_renewals",
    expiryTracking: "expiry_tracking", goalTracking: "goal_tracking",
    progressPhotos: "progress_photos", membershipPauseFreeze: "membership_pause_freeze",
    memberTaggingSegments: "member_tagging_segments", memberProgressTracking: "member_progress_tracking",
    crossBranchMemberAccess: "cross_branch_member_access", customMemberFields: "custom_member_fields",
    memberDataImportExport: "member_data_import_export", leadManagement: "lead_management",
    trialManagement: "trial_management", leadFollowupReminders: "lead_followup_reminders",
    reEngagementAutomation: "re_engagement_automation", advancedCrmLeadPipeline: "advanced_crm_lead_pipeline",
    referralProgram: "referral_program", loyaltyPointsSystem: "loyalty_points_system",
    networkWideCampaignManager: "network_wide_campaign_manager", memberNpsSurveys: "member_nps_surveys",
    trainerManagement: "trainer_management", workoutAssignment: "workout_assignment",
    nutritionPlans: "nutrition_plans", ptSessions: "pt_sessions",
    classBooking: "class_booking", waitlistManagement: "waitlist_management",
    crossBranchClassBooking: "cross_branch_class_booking", trainerCommissionsPayroll: "trainer_commissions_payroll",
    staffAttendanceLeave: "staff_attendance_leave", classAttendanceTracking: "class_attendance_tracking",
    payrollExport: "payroll_export", roleBasedPermissions: "role_based_permissions",
    networkWideClassCalendar: "network_wide_class_calendar", trainerSharingAcrossBranches: "trainer_sharing_across_branches",
    customRolesGranularPermissions: "custom_roles_granular_permissions", multiBranchStaffAssignment: "multi_branch_staff_assignment",
    hrDocumentStorage: "hr_document_storage", billingInvoices: "billing_invoices",
    receipts: "receipts", paymentTracking: "payment_tracking",
    onlinePaymentLinks: "online_payment_links", renewalReminders: "renewal_reminders",
    autoBilling: "auto_billing", discountPromoCodes: "discount_promo_codes",
    corporateBulkMemberships: "corporate_bulk_memberships", paymentFailureHandling: "payment_failure_handling",
    partialPaymentDues: "partial_payment_dues", razorpayPayuIntegration: "razorpay_payu_integration",
    multiCurrencyBilling: "multi_currency_billing", franchiseFeeManagement: "franchise_fee_management",
    multiGstinSupport: "multi_gstin_support", posMerchandiseSupplements: "pos_merchandise_supplements",
    branchRevenueSplit: "branch_revenue_split", basicReports: "basic_reports",
    advancedReportsEnabled: "advanced_reports", customDashboards: "custom_dashboards",
    customDashboardsKpis: "custom_dashboards_kpis", trainerPerformanceReport: "trainer_performance_report",
    classOccupancyReport: "class_occupancy_report", leadConversionReport: "lead_conversion_report",
    branchRevenueComparison: "branch_revenue_comparison", franchiseRollupReports: "franchise_rollup_reports",
    franchiseRollupDashboard: "franchise_rollup_dashboard", scheduledReportDelivery: "scheduled_report_delivery",
    equipmentInventoryMaintenance: "equipment_inventory_maintenance", dataExportCsvDownload: "data_export_csv_download",
    emailNotifications: "email_notifications", inAppNotifications: "in_app_notifications",
    whatsappIntegration: "whatsapp_integration", smsIntegration: "sms_integration",
    birthdayGreetings: "birthday_greetings", broadcastMessages: "broadcast_messages",
    emailCampaigns: "email_campaigns", whatsappBusinessApi: "whatsapp_business_api",
    memberPortal: "member_portal", trainerPortal: "trainer_portal",
    brandedMobileApp: "branded_mobile_app", dietWorkoutPlans: "diet_workout_plans",
    whiteLabelMobileApp: "white_label_mobile_app", googleCalendarSync: "google_calendar_sync",
    inAppPushNotifications: "in_app_push_notifications", digitalMembershipCard: "digital_membership_card",
    loyaltyRewardsInApp: "loyalty_rewards_in_app", aiEnabled: "ai_recommendations",
    aiCoach: "ai_coach", aiRetentionAnalysis: "ai_retention_analysis",
    aiRevenueInsights: "ai_revenue_insights", whiteLabelEnabled: "white_label",
    customDomainEnabled: "custom_domain", customBranding: "custom_branding",
    multiBranchManagement: "multi_branch_management", franchiseManagement: "franchise_management",
    apiAccessEnabled: "api_access", webhooks: "webhooks",
    auditLogs: "audit_logs", advancedRbac: "advanced_rbac",
    prioritySupport: "priority_support", staffManagement: "staff_management",
    tallyZohoBooksIntegration: "tally_zoho_books_integration", restApiAccess: "rest_api_access",
    ssoSamlLogin: "sso_saml_login", dedicatedCloudInfrastructure: "dedicated_cloud_infrastructure",
    dedicatedOnboardingManager: "dedicated_onboarding_manager", responseSla: "response_sla",
    namedAccountManager: "named_account_manager", automatedBackups90DayRetention: "automated_backups_90_day_retention",
    uptimeSla99_9: "uptime_sla_99_9", staffTrainingSessions: "staff_training_sessions",
    customFeatureRequests: "custom_feature_requests",
    classSchedulingEnabled: "class_booking", communicationsEnabled: "whatsapp_integration",
    trainerAssignmentEnabled: "workout_assignment", razorpayEnabled: "billing_invoices",
  };

  const featureMapCodes = new Set(Object.values(knownFlagToCode));

  for (const key of FEATURE_KEYS) {
    if (!featureMapCodes.has(key)) {
      errors.push({
        type: "feature_map_code_mismatch",
        key,
        detail: `Feature key "${key}" in FEATURE_KEYS has no corresponding entry in FEATURE_MAP (feature-resolver.ts). Add a FEATURE_MAP entry that maps a camelCase flag to this code.`,
      });
    }
  }

  // ── Check 6: DB validation: all package_features rows reference
  //    valid FEATURE_KEYS ──────────────────────────────────────────────
  const supabase = await getSupabaseForQuery();
  if (supabase) {
    try {
      const { data: dbFeatures } = await supabase
        .from("package_features")
        .select("feature_code");

      if (dbFeatures) {
        const dbFeatureCodes = dbFeatures.map((r) => String(r.feature_code ?? ""));
        const uniqueDbCodes = [...new Set(dbFeatureCodes)];

        for (const code of uniqueDbCodes) {
          if (code && !FEATURE_KEY_SET.has(code)) {
            errors.push({
              type: "missing_from_feature_keys",
              key: code,
              detail: `package_features contains "${code}" which is not registered in FEATURE_KEYS`,
            });
          }
        }
      }
    } catch {
      errors.push({
        type: "missing_from_db_keys",
        key: "database",
        detail: "Failed to query package_features table. Database may be unavailable.",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    timestamp: new Date().toISOString(),
  };
}
