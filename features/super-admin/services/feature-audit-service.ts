import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { FEATURE_KEYS, FEATURE_CATEGORIES, MODULE_FEATURE_MAP } from "@/features/entitlement/feature-registry";
import type { FeatureKey, FeatureCategoryCode } from "@/features/entitlement/feature-registry";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import type { ImplementationStatus, GapSeverity, FeatureAuditRow, PlanAudit, FeatureAuditReport } from "./feature-audit-types";

type RawRow = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

type FeatureImplInfo = {
  hasSidebar: boolean;
  sidebarModule: string | null;
  hasRoute: boolean;
  hasActions: boolean;
  hasUI: boolean;
  status: ImplementationStatus;
  gapSeverity: GapSeverity;
};

const FEATURE_IMPLEMENTATION_MAP: Record<string, FeatureImplInfo> = {
  // AI features — configured in plan, no direct UI for each
  ai_recommendations:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  ai_coach:                 { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  ai_retention_analysis:    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  ai_revenue_insights:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },

  // Attendance — core module (attendance_reports) is fully implemented; sub-features are partial
  manual_attendance:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: true,  status: "PARTIAL", gapSeverity: "P2" },
  qr_attendance:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: true,  status: "PARTIAL", gapSeverity: "P2" },
  dynamic_qr_attendance:     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  trainer_attendance:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: true,  status: "PARTIAL", gapSeverity: "P2" },
  staff_attendance:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: true,  status: "PARTIAL", gapSeverity: "P2" },
  branch_attendance:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  biometric_attendance:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  fingerprint_attendance:    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  face_recognition_attendance: { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  rfid_attendance:           { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  nfc_attendance:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  geo_fencing_attendance:    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  attendance_api:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  attendance_reports:        { hasSidebar: true,  sidebarModule: "attendance", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },

  // Billing — core module (billing_invoices) is fully implemented; sub-features are partial or not implemented
  billing_invoices:               { hasSidebar: true,  sidebarModule: "revenue",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  receipts:                        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: true,  status: "PARTIAL", gapSeverity: "P2" },
  payment_tracking:                { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: true,  status: "PARTIAL", gapSeverity: "P2" },
  online_payment_links:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  renewal_reminders:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  auto_billing:                    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P0" },
  discount_promo_codes:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  corporate_bulk_memberships:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  payment_failure_handling:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P0" },
  partial_payment_dues:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  razorpay_payu_integration:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P0" },
  multi_currency_billing:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  franchise_fee_management:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  multi_gstin_support:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  pos_merchandise_supplements:     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  branch_revenue_split:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },

  // Communication — core module is implemented; sub-features partial
  email_notifications:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  in_app_notifications:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  whatsapp_integration:        { hasSidebar: true,  sidebarModule: "communications", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  sms_integration:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  birthday_greetings:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  broadcast_messages:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  email_campaigns:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  whatsapp_business_api:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  cross_branch_member_access:  { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },

  // CRM — lead_management is fully implemented; others are partial or not
  lead_management:                { hasSidebar: true,  sidebarModule: "leads",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  trial_management:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  lead_followup_reminders:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  re_engagement_automation:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  advanced_crm_lead_pipeline:     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  referral_program:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  loyalty_points_system:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  network_wide_campaign_manager:  { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  member_nps_surveys:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },

  // Enterprise — some are fully implemented, others are service/infra
  franchise_management:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  multi_branch_management:            { hasSidebar: true,  sidebarModule: "branches", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  api_access:                         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  webhooks:                           { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  audit_logs:                         { hasSidebar: true,  sidebarModule: "security",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  advanced_rbac:                      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: true,  hasUI: false, status: "PARTIAL", gapSeverity: "P1" },
  priority_support:                   { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  staff_management:                   { hasSidebar: true,  sidebarModule: "staff",    hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  tally_zoho_books_integration:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  rest_api_access:                    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  role_based_permissions:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: true,  hasUI: false, status: "PARTIAL", gapSeverity: "P1" },
  multi_branch_staff_assignment:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  hr_document_storage:                { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  custom_roles_granular_permissions:  { hasSidebar: true,  sidebarModule: "custom-roles", hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  sso_saml_login:                     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  dedicated_cloud_infrastructure:     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  dedicated_onboarding_manager:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  response_sla:                       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  named_account_manager:              { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  automated_backups_90_day_retention: { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  uptime_sla_99_9:                    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  staff_training_sessions:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  custom_feature_requests:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },

  // Membership — core is fully implemented; sub-features partial
  member_management:            { hasSidebar: true,  sidebarModule: "members",     hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  membership_renewals:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P0" },
  expiry_tracking:              { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  goal_tracking:                { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  progress_photos:              { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  membership_pause_freeze:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  member_tagging_segments:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  member_progress_tracking:     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  custom_member_fields:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  member_data_import_export:    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },

  // Platform — some are implemented, partial, or not
  member_portal:                { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  trainer_portal:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  branded_mobile_app:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  diet_workout_plans:           { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  google_calendar_sync:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  white_label_mobile_app:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  in_app_push_notifications:     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  digital_membership_card:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  loyalty_rewards_in_app:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },

  // Reports — core modules are fully implemented; sub-features are partial or not
  basic_reports:                     { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  advanced_reports:                  { hasSidebar: true,  sidebarModule: "analytics",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  custom_dashboards:                 { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  trainer_performance_report:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  class_occupancy_report:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  lead_conversion_report:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  branch_revenue_comparison:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  franchise_rollup_reports:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  scheduled_report_delivery:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  equipment_inventory_maintenance:   { hasSidebar: true,  sidebarModule: "equipment",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  data_export_csv_download:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  franchise_rollup_dashboard:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  custom_dashboards_kpis:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },

  // Trainer — core module is fully implemented; sub-features are partial
  trainer_management:               { hasSidebar: true,  sidebarModule: "trainers", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  workout_assignment:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  nutrition_plans:                  { hasSidebar: true,  sidebarModule: "nutrition", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  pt_sessions:                      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  class_booking:                    { hasSidebar: true,  sidebarModule: "classes",   hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  waitlist_management:              { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  cross_branch_class_booking:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  trainer_commissions_payroll:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  staff_attendance_leave:           { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  class_attendance_tracking:        { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  payroll_export:                   { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  network_wide_class_calendar:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  trainer_sharing_across_branches:  { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },

  // White Label — some are fully implemented, others partial
  white_label:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  custom_domain:    { hasSidebar: true,  sidebarModule: "domains",   hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  custom_branding:  { hasSidebar: true,  sidebarModule: "branding",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
};

function getImplementationInfo(featureCode: string): FeatureImplInfo {
  return FEATURE_IMPLEMENTATION_MAP[featureCode] ?? {
    hasSidebar: false,
    sidebarModule: null,
    hasRoute: false,
    hasActions: false,
    hasUI: false,
    status: "NOT_IMPLEMENTED",
    gapSeverity: "P2",
  };
}

function findCategoryForFeature(featureCode: string): string {
  for (const category of FEATURE_CATEGORIES) {
    const categoryFeaturePrefixes: Record<string, string[]> = {
      ai: ["ai_"],
      attendance: ["attendance_", "manual_attendance", "qr_attendance", "dynamic_qr_attendance", "trainer_attendance", "staff_attendance", "branch_attendance", "biometric_attendance", "fingerprint_attendance", "face_recognition_attendance", "rfid_attendance", "nfc_attendance", "geo_fencing_attendance", "attendance_api", "attendance_reports"],
      billing: ["billing_", "receipts", "payment_", "online_payment_", "renewal_reminders", "auto_billing", "discount_promo", "corporate_bulk", "payment_failure", "partial_payment", "razorpay", "multi_currency", "franchise_fee", "multi_gstin", "pos_merchandise", "branch_revenue"],
      communication: ["email_", "in_app_", "whatsapp_", "sms_", "birthday_", "broadcast_", "cross_branch_member"],
      crm: ["lead_", "trial_management", "re_engagement", "advanced_crm", "referral_", "loyalty_", "network_wide_campaign", "member_nps"],
      enterprise: ["franchise_", "multi_branch_", "api_access", "webhooks", "audit_logs", "advanced_rbac", "priority_support", "staff_management", "tally_", "rest_api", "role_based", "multi_branch_staff", "hr_document", "custom_roles", "sso_", "dedicated_", "response_sla", "named_account", "automated_backups", "uptime_sla", "staff_training", "custom_feature_requests"],
      membership: ["member_", "membership_", "expiry_", "goal_", "progress_", "membership_pause", "member_tagging", "member_progress", "custom_member", "member_data"],
      platform: ["member_portal", "trainer_portal", "branded_mobile", "diet_workout", "google_calendar", "white_label_mobile", "in_app_push", "digital_membership", "loyalty_rewards"],
      reports: ["basic_reports", "advanced_reports", "custom_dashboards", "trainer_performance", "class_occupancy", "lead_conversion", "branch_revenue_comparison", "franchise_rollup", "scheduled_report", "equipment_inventory", "data_export", "custom_dashboards_kpis"],
      trainer: ["trainer_", "workout_", "nutrition_", "pt_sessions", "class_booking", "waitlist_", "cross_branch_class", "trainer_commissions", "staff_attendance_leave", "class_attendance", "payroll_export", "network_wide_class", "trainer_sharing"],
      white_label: ["white_label", "custom_domain", "custom_branding"],
    };

    const prefixes = categoryFeaturePrefixes[category.code] ?? [];
    for (const prefix of prefixes) {
      if (featureCode.startsWith(prefix)) {
        return category.name;
      }
    }
  }
  return "Uncategorized";
}

export async function buildFeatureAuditReport(): Promise<FeatureAuditReport> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection failed.");

  const db = supabase as unknown as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: unknown): Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
        in(k: string, vals: unknown[]): {
          order(k: string, o: { ascending: boolean }): Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };

  const { data: packages } = await db
    .from("packages")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!packages || packages.length === 0) {
    return { plans: [], summary: { totalFeatures: 0, implemented: 0, partial: 0, configured: 0, notImplemented: 0, serviceInfra: 0, implementationRate: 0 } };
  }

  // Build sidebar module set for checking
  const sidebarModuleCodes = new Set(organizationOwnerModules.map((m) => m.featureKey));
  const sidebarModuleLabels: Record<string, string> = {};
  for (const mod of organizationOwnerModules) {
    if (mod.featureKey) {
      sidebarModuleLabels[mod.featureKey] = mod.label;
    }
  }

  const featureKeySet = new Set(FEATURE_KEYS);
  const moduleMapReverse: Record<string, string> = {};
  for (const [moduleSlug, featureKey] of Object.entries(MODULE_FEATURE_MAP)) {
    moduleMapReverse[featureKey] = moduleSlug;
  }

  const plans: PlanAudit[] = [];

  for (const pkg of packages) {
    const pkgId = asString(pkg.id);
    const pkgName = asString(pkg.name);
    const pkgSlug = asString(pkg.slug);

    // Fetch features and limits in parallel
    const [featuresRes, limitsRes] = await Promise.all([
      db.from("package_features")
        .select("feature_code, value")
        .eq("package_id" as never, pkgId as never),
      db.from("package_limits")
        .select("limit_code, value")
        .eq("package_id" as never, pkgId as never),
    ]);

    const featureRows = (featuresRes.data ?? []) as RawRow[];
    const limitRows = (limitsRes.data ?? []) as RawRow[];

    const auditRows: FeatureAuditRow[] = [];

    // Process each feature in the package
    for (const row of featureRows) {
      const featureCode = asString(row.feature_code);
      const value = row.value;
      const planValue = asBool(value) ? "Enabled" : String(value ?? "Disabled");

      const implInfo = getImplementationInfo(featureCode);

      const isInFeatureKeys = featureKeySet.has(featureCode);
      const moduleMapEntry = moduleMapReverse[featureCode] ?? null;
      const sidebarLabel = sidebarModuleLabels[featureCode] ?? null;

      auditRows.push({
        featureCode,
        category: findCategoryForFeature(featureCode),
        planValue,
        inFeatureKeys: isInFeatureKeys,
        hasModuleMap: moduleMapEntry,
        hasSidebar: sidebarLabel,
        hasRoute: implInfo.hasRoute,
        hasActions: implInfo.hasActions,
        hasUI: implInfo.hasUI,
        status: implInfo.status,
        gapSeverity: implInfo.gapSeverity,
      });
    }

    // Process limits as additional rows
    for (const row of limitRows) {
      const limitCode = asString(row.limit_code);
      const limitValue = row.value;

      auditRows.push({
        featureCode: limitCode,
        category: "Limits",
        planValue: String(limitValue ?? "0"),
        inFeatureKeys: true,
        hasModuleMap: null,
        hasSidebar: null,
        hasRoute: false,
        hasActions: false,
        hasUI: false,
        status: "SERVICE_OR_INFRA",
        gapSeverity: "N/A",
      });
    }

    // Calculate summary for this plan
    const featureAuditRows = auditRows.filter(
      (r) => r.status !== "SERVICE_OR_INFRA"
    );
    const fullyImplemented = featureAuditRows.filter((r) => r.status === "FULLY_IMPLEMENTED").length;
    const partial = featureAuditRows.filter((r) => r.status === "PARTIAL").length;
    const configuredOnly = featureAuditRows.filter((r) => r.status === "CONFIGURED_ONLY").length;
    const notImplemented = featureAuditRows.filter((r) => r.status === "NOT_IMPLEMENTED").length;
    const serviceInfra = auditRows.filter((r) => r.status === "SERVICE_OR_INFRA").length;
    const totalEligible = featureAuditRows.length;
    const implementationRate =
      totalEligible > 0
        ? Math.round(((fullyImplemented + partial * 0.5) / totalEligible) * 100)
        : 0;

    const summary = {
      totalFeatures: auditRows.length,
      fullyImplemented,
      partial,
      configuredOnly,
      notImplemented,
      serviceInfra,
      implementationRate,
    };

    plans.push({
      packageId: pkgId,
      packageName: pkgName,
      packageSlug: pkgSlug,
      features: auditRows,
      summary,
    });
  }

  // Overall summary
  const allFeatureRows = plans.flatMap((p) => p.features.filter((r) => r.status !== "SERVICE_OR_INFRA"));
  const allImpl = allFeatureRows.filter((r) => r.status === "FULLY_IMPLEMENTED").length;
  const allPartial = allFeatureRows.filter((r) => r.status === "PARTIAL").length;
  const allConfigured = allFeatureRows.filter((r) => r.status === "CONFIGURED_ONLY").length;
  const allNotImpl = allFeatureRows.filter((r) => r.status === "NOT_IMPLEMENTED").length;
  const allService = plans.flatMap((p) => p.features.filter((r) => r.status === "SERVICE_OR_INFRA")).length;
  const allTotal = allFeatureRows.length;
  const allRate = allTotal > 0
    ? Math.round(((allImpl + allPartial * 0.5) / allTotal) * 100)
    : 0;

  return {
    plans,
    summary: {
      totalFeatures: allTotal + allService,
      implemented: allImpl,
      partial: allPartial,
      configured: allConfigured,
      notImplemented: allNotImpl,
      serviceInfra: allService,
      implementationRate: allRate,
    },
  };
}
