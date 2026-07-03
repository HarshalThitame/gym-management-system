import {
  getOrganizationEntitlements,
  hasFeatureAccess as hasCanonicalFeatureAccess,
} from "@/features/entitlement";
import type { FeatureKey } from "@/features/entitlement/feature-registry";
import type { OrgFeatureFlags, FeatureFlagKey } from "./feature-flags";

const SAFE_DEFAULT: OrgFeatureFlags = {
  maxMembers: 0, maxBranches: 0, maxTrainers: 0, maxStaff: 0, maxStorageGb: 0, maxApiCalls: 0,
  membershipPlanTypes: 0, weeklyClasses: 0, smsMonthly: 0,
  manualAttendance: false, qrAttendanceEnabled: false, dynamicQrAttendance: false,
  trainerAttendance: false, staffAttendance: false, branchAttendance: false,
  biometricAttendanceEnabled: false, fingerprintAttendance: false, rfidAttendanceEnabled: false,
  nfcAttendance: false, geoFencingAttendance: false, attendanceApi: false, attendanceReports: false,
  memberManagement: false, membershipRenewals: false, expiryTracking: false, goalTracking: false,
  progressPhotos: false, membershipPauseFreeze: false, memberTaggingSegments: false, memberProgressTracking: false,
  crossBranchMemberAccess: false, customMemberFields: false, memberDataImportExport: false,
  leadManagement: false, trialManagement: false, leadFollowupReminders: false, reEngagementAutomation: false,
  advancedCrmLeadPipeline: false, referralProgram: false, loyaltyPointsSystem: false,
  networkWideCampaignManager: false, memberNpsSurveys: false,
  trainerManagement: false, workoutAssignment: false, nutritionPlans: false, ptSessions: false,
  classBooking: false, waitlistManagement: false, crossBranchClassBooking: false,
  trainerCommissionsPayroll: false, staffAttendanceLeave: false, classAttendanceTracking: false,
  payrollExport: false, roleBasedPermissions: false, networkWideClassCalendar: false,
  trainerSharingAcrossBranches: false, customRolesGranularPermissions: false,
  multiBranchStaffAssignment: false, hrDocumentStorage: false,
  billingInvoices: false, receipts: false, paymentTracking: false, onlinePaymentLinks: false,
  renewalReminders: false, autoBilling: false, discountPromoCodes: false, corporateBulkMemberships: false,
  paymentFailureHandling: false, partialPaymentDues: false, razorpayPayuIntegration: false,
  multiGstinSupport: false, branchRevenueSplit: false,
  basicReports: false, advancedReportsEnabled: false, customDashboards: false, customDashboardsKpis: false,
  trainerPerformanceReport: false, classOccupancyReport: false, leadConversionReport: false,
  branchRevenueComparison: false, scheduledReportDelivery: false, equipmentInventoryMaintenance: false,
  dataExportCsvDownload: false,
  emailNotifications: false, inAppNotifications: false, whatsappIntegration: false, smsIntegration: false,
  birthdayGreetings: false, broadcastMessages: false, emailCampaigns: false, whatsappBusinessApi: false,
  customEmailDomain: false,
  memberPortal: false, trainerPortal: false, brandedMobileApp: false, dietWorkoutPlans: false,
  googleCalendarSync: false, inAppPushNotifications: false, digitalMembershipCard: false, loyaltyRewardsInApp: false,
  aiEnabled: false, aiCoach: false, aiRetentionAnalysis: false, aiRevenueInsights: false,
  whiteLabelEnabled: false, customDomainEnabled: false, customBranding: false,
  multiBranchManagement: false, apiAccessEnabled: false, webhooks: false, auditLogs: false,
  advancedRbac: false, prioritySupport: false, staffManagement: false, tallyZohoBooksIntegration: false,
  restApiAccess: false,
  classSchedulingEnabled: false, communicationsEnabled: false, trainerAssignmentEnabled: false, razorpayEnabled: false,
};

const FEATURE_MAP: Record<string, { type: "feature"; code: FeatureKey } | { type: "limit"; code: string }> = {
  maxMembers: { type: "limit", code: "max_members" },
  maxBranches: { type: "limit", code: "max_branches" },
  maxTrainers: { type: "limit", code: "max_trainers" },
  maxStaff: { type: "limit", code: "max_staff" },
  maxStorageGb: { type: "limit", code: "max_storage_gb" },
  maxApiCalls: { type: "limit", code: "max_api_calls" },
  membershipPlanTypes: { type: "limit", code: "membership_plan_types" },
  weeklyClasses: { type: "limit", code: "weekly_classes" },
  smsMonthly: { type: "limit", code: "sms_monthly" },
  manualAttendance: { type: "feature", code: "manual_attendance" },
  qrAttendanceEnabled: { type: "feature", code: "qr_attendance" },
  dynamicQrAttendance: { type: "feature", code: "dynamic_qr_attendance" },
  trainerAttendance: { type: "feature", code: "trainer_attendance" },
  staffAttendance: { type: "feature", code: "staff_attendance" },
  branchAttendance: { type: "feature", code: "branch_attendance" },
  biometricAttendanceEnabled: { type: "feature", code: "biometric_attendance" },
  fingerprintAttendance: { type: "feature", code: "fingerprint_attendance" },
  rfidAttendanceEnabled: { type: "feature", code: "rfid_attendance" },
  nfcAttendance: { type: "feature", code: "nfc_attendance" },
  geoFencingAttendance: { type: "feature", code: "geo_fencing_attendance" },
  attendanceApi: { type: "feature", code: "attendance_api" },
  attendanceReports: { type: "feature", code: "attendance_reports" },
  memberManagement: { type: "feature", code: "member_management" },
  membershipRenewals: { type: "feature", code: "membership_renewals" },
  expiryTracking: { type: "feature", code: "expiry_tracking" },
  goalTracking: { type: "feature", code: "goal_tracking" },
  progressPhotos: { type: "feature", code: "progress_photos" },
  membershipPauseFreeze: { type: "feature", code: "membership_pause_freeze" },
  memberTaggingSegments: { type: "feature", code: "member_tagging_segments" },
  memberProgressTracking: { type: "feature", code: "member_progress_tracking" },
  crossBranchMemberAccess: { type: "feature", code: "cross_branch_member_access" },
  customMemberFields: { type: "feature", code: "custom_member_fields" },
  memberDataImportExport: { type: "feature", code: "member_data_import_export" },
  leadManagement: { type: "feature", code: "lead_management" },
  trialManagement: { type: "feature", code: "trial_management" },
  leadFollowupReminders: { type: "feature", code: "lead_followup_reminders" },
  reEngagementAutomation: { type: "feature", code: "re_engagement_automation" },
  advancedCrmLeadPipeline: { type: "feature", code: "advanced_crm_lead_pipeline" },
  referralProgram: { type: "feature", code: "referral_program" },
  loyaltyPointsSystem: { type: "feature", code: "loyalty_points_system" },
  networkWideCampaignManager: { type: "feature", code: "network_wide_campaign_manager" },
  memberNpsSurveys: { type: "feature", code: "member_nps_surveys" },
  trainerManagement: { type: "feature", code: "trainer_management" },
  trainerAssignmentEnabled: { type: "feature", code: "workout_assignment" },
  workoutAssignment: { type: "feature", code: "workout_assignment" },
  nutritionPlans: { type: "feature", code: "nutrition_plans" },
  ptSessions: { type: "feature", code: "pt_sessions" },
  classBooking: { type: "feature", code: "class_booking" },
  classSchedulingEnabled: { type: "feature", code: "class_booking" },
  waitlistManagement: { type: "feature", code: "waitlist_management" },
  crossBranchClassBooking: { type: "feature", code: "cross_branch_class_booking" },
  trainerCommissionsPayroll: { type: "feature", code: "trainer_commissions_payroll" },
  staffAttendanceLeave: { type: "feature", code: "staff_attendance_leave" },
  classAttendanceTracking: { type: "feature", code: "class_attendance_tracking" },
  payrollExport: { type: "feature", code: "payroll_export" },
  roleBasedPermissions: { type: "feature", code: "role_based_permissions" },
  networkWideClassCalendar: { type: "feature", code: "network_wide_class_calendar" },
  trainerSharingAcrossBranches: { type: "feature", code: "trainer_sharing_across_branches" },
  customRolesGranularPermissions: { type: "feature", code: "custom_roles_granular_permissions" },
  multiBranchStaffAssignment: { type: "feature", code: "multi_branch_staff_assignment" },
  hrDocumentStorage: { type: "feature", code: "hr_document_storage" },
  billingInvoices: { type: "feature", code: "billing_invoices" },
  razorpayEnabled: { type: "feature", code: "billing_invoices" },
  receipts: { type: "feature", code: "receipts" },
  paymentTracking: { type: "feature", code: "payment_tracking" },
  onlinePaymentLinks: { type: "feature", code: "online_payment_links" },
  renewalReminders: { type: "feature", code: "renewal_reminders" },
  autoBilling: { type: "feature", code: "auto_billing" },
  discountPromoCodes: { type: "feature", code: "discount_promo_codes" },
  corporateBulkMemberships: { type: "feature", code: "corporate_bulk_memberships" },
  paymentFailureHandling: { type: "feature", code: "payment_failure_handling" },
  partialPaymentDues: { type: "feature", code: "partial_payment_dues" },
  razorpayPayuIntegration: { type: "feature", code: "razorpay_payu_integration" },
  multiGstinSupport: { type: "feature", code: "multi_gstin_support" },
  branchRevenueSplit: { type: "feature", code: "branch_revenue_split" },
  basicReports: { type: "feature", code: "basic_reports" },
  advancedReportsEnabled: { type: "feature", code: "advanced_reports" },
  customDashboards: { type: "feature", code: "custom_dashboards" },
  customDashboardsKpis: { type: "feature", code: "custom_dashboards_kpis" },
  trainerPerformanceReport: { type: "feature", code: "trainer_performance_report" },
  classOccupancyReport: { type: "feature", code: "class_occupancy_report" },
  leadConversionReport: { type: "feature", code: "lead_conversion_report" },
  branchRevenueComparison: { type: "feature", code: "branch_revenue_comparison" },
  scheduledReportDelivery: { type: "feature", code: "scheduled_report_delivery" },
  equipmentInventoryMaintenance: { type: "feature", code: "equipment_inventory_maintenance" },
  dataExportCsvDownload: { type: "feature", code: "data_export_csv_download" },
  customEmailDomain: { type: "feature", code: "custom_email_domain" },
  emailNotifications: { type: "feature", code: "email_notifications" },
  inAppNotifications: { type: "feature", code: "in_app_notifications" },
  whatsappIntegration: { type: "feature", code: "whatsapp_integration" },
  smsIntegration: { type: "feature", code: "sms_integration" },
  communicationsEnabled: { type: "feature", code: "whatsapp_integration" },
  birthdayGreetings: { type: "feature", code: "birthday_greetings" },
  broadcastMessages: { type: "feature", code: "broadcast_messages" },
  emailCampaigns: { type: "feature", code: "email_campaigns" },
  whatsappBusinessApi: { type: "feature", code: "whatsapp_business_api" },
  memberPortal: { type: "feature", code: "member_portal" },
  trainerPortal: { type: "feature", code: "trainer_portal" },
  brandedMobileApp: { type: "feature", code: "branded_mobile_app" },
  dietWorkoutPlans: { type: "feature", code: "diet_workout_plans" },
  googleCalendarSync: { type: "feature", code: "google_calendar_sync" },
  inAppPushNotifications: { type: "feature", code: "in_app_push_notifications" },
  digitalMembershipCard: { type: "feature", code: "digital_membership_card" },
  loyaltyRewardsInApp: { type: "feature", code: "loyalty_rewards_in_app" },
  aiEnabled: { type: "feature", code: "ai_recommendations" },
  aiCoach: { type: "feature", code: "ai_coach" },
  aiRetentionAnalysis: { type: "feature", code: "ai_retention_analysis" },
  aiRevenueInsights: { type: "feature", code: "ai_revenue_insights" },
  whiteLabelEnabled: { type: "feature", code: "white_label" },
  customDomainEnabled: { type: "feature", code: "custom_domain" },
  customBranding: { type: "feature", code: "custom_branding" },
  multiBranchManagement: { type: "feature", code: "multi_branch_management" },
  apiAccessEnabled: { type: "feature", code: "api_access" },
  webhooks: { type: "feature", code: "webhooks" },
  auditLogs: { type: "feature", code: "audit_logs" },
  advancedRbac: { type: "feature", code: "advanced_rbac" },
  prioritySupport: { type: "feature", code: "priority_support" },
  staffManagement: { type: "feature", code: "staff_management" },
  tallyZohoBooksIntegration: { type: "feature", code: "tally_zoho_books_integration" },
  restApiAccess: { type: "feature", code: "rest_api_access" },
};

export async function getOrgFeatureFlags(organizationId: string): Promise<OrgFeatureFlags> {
  try {
    const snapshot = await getOrganizationEntitlements(organizationId);
    const featureSet = new Set(snapshot.activeFeatureKeys);

    const result: Record<string, unknown> = {};
    for (const [key, mapping] of Object.entries(FEATURE_MAP)) {
      result[key] = mapping.type === "feature"
        ? featureSet.has(mapping.code)
        : snapshot.limits[mapping.code] ?? 0;
    }

    return { ...SAFE_DEFAULT, ...result } as OrgFeatureFlags;
  } catch (error) {
    console.error("Feature resolver failed:", error instanceof Error ? error.message : "Unknown error");
    return { ...SAFE_DEFAULT };
  }
}

export async function hasFeature(organizationId: string, feature: FeatureFlagKey): Promise<boolean> {
  const mapping = FEATURE_MAP[feature];
  if (!mapping) {
    console.error(`[feature-resolver] Unknown feature key: "${feature}". Add it to FEATURE_MAP.`);
    return false;
  }
  if (mapping.type !== "feature") {
    return false;
  }
  return hasCanonicalFeatureAccess(organizationId, mapping.code);
}

export async function assertFeature(organizationId: string, feature: FeatureFlagKey): Promise<void> {
  const enabled = await hasFeature(organizationId, feature);
  if (!enabled) throw new Error("Feature not available on your current plan.");
}

export async function isWithinMemberLimit(organizationId: string, currentMemberCount: number): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);
  if (flags.maxMembers === -1) return true;
  return currentMemberCount < flags.maxMembers;
}

export async function isWithinBranchLimit(organizationId: string, currentBranchCount: number): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);
  if (flags.maxBranches === -1) return true;
  return currentBranchCount < flags.maxBranches;
}
