import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MODULE_FEATURE_MAP, isFeatureKey } from "@/features/entitlement/feature-registry";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import type { ImplementationStatus, GapSeverity, FeatureAuditRow, PlanAudit, FeatureAuditReport } from "./feature-audit-types";

type RawRow = Record<string, unknown>;
type QueryResult = { data: RawRow[] | null; error: { message: string } | null };
type QueryBuilder = PromiseLike<QueryResult> & {
  eq(k: string, v: unknown): QueryBuilder;
  in(k: string, vals: readonly unknown[]): QueryBuilder;
  order(k: string, o: { ascending: boolean }): QueryBuilder;
};

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

  // Attendance — core module is fully implemented in the current web/device stack.
  // Hardware-native biometric/fingerprint support remains the only configuration-only surface.
  manual_attendance:         { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  qr_attendance:             { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  dynamic_qr_attendance:     { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  trainer_attendance:        { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  staff_attendance:          { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  branch_attendance:         { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  biometric_attendance:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  fingerprint_attendance:    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  rfid_attendance:           { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  nfc_attendance:            { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  geo_fencing_attendance:    { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  attendance_api:            { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
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
  multi_gstin_support:             { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
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
  multi_branch_management:            { hasSidebar: true,  sidebarModule: "branches", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  api_access:                         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  webhooks:                           { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  audit_logs:                         { hasSidebar: true,  sidebarModule: "security",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  advanced_rbac:                      { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  priority_support:                   { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  staff_management:                   { hasSidebar: true,  sidebarModule: "staff",    hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  tally_zoho_books_integration:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  rest_api_access:                    { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "SERVICE_OR_INFRA", gapSeverity: "N/A" },
  role_based_permissions:             { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  multi_branch_staff_assignment:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  hr_document_storage:                { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  custom_roles_granular_permissions:  { hasSidebar: true,  sidebarModule: "custom-roles", hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },


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
  scheduled_report_delivery:         { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  equipment_inventory_maintenance:   { hasSidebar: true,  sidebarModule: "equipment",  hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  data_export_csv_download:          { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  custom_dashboards_kpis:            { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },

  // Trainer — core module is fully implemented; some operational extras remain partial/configured-only
  trainer_management:               { hasSidebar: true,  sidebarModule: "trainers", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  workout_assignment:               { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  nutrition_plans:                  { hasSidebar: true,  sidebarModule: "nutrition", hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  pt_sessions:                      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  class_booking:                    { hasSidebar: true,  sidebarModule: "classes",   hasRoute: true,  hasActions: false, hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  waitlist_management:              { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P2" },
  cross_branch_class_booking:       { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  trainer_commissions_payroll:      { hasSidebar: false, sidebarModule: null, hasRoute: false, hasActions: false, hasUI: false, status: "CONFIGURED_ONLY", gapSeverity: "P1" },
  staff_attendance_leave:           { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
  class_attendance_tracking:        { hasSidebar: false, sidebarModule: null, hasRoute: true,  hasActions: true,  hasUI: true,  status: "FULLY_IMPLEMENTED", gapSeverity: "N/A" },
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
  // Built from FEATURE_KEYS in feature-registry.ts — each category block
  // corresponds to a section of the FEATURE_KEYS array.
  const keyToCategory: Record<string, string> = {
    // ai
    ai_recommendations: "AI Features",
    ai_coach: "AI Features",
    ai_retention_analysis: "AI Features",
    ai_revenue_insights: "AI Features",
    // attendance
    manual_attendance: "Attendance",
    qr_attendance: "Attendance",
    dynamic_qr_attendance: "Attendance",
    trainer_attendance: "Attendance",
    staff_attendance: "Attendance",
    branch_attendance: "Attendance",
    biometric_attendance: "Attendance",
    fingerprint_attendance: "Attendance",
    rfid_attendance: "Attendance",
    nfc_attendance: "Attendance",
    geo_fencing_attendance: "Attendance",
    attendance_api: "Attendance",
    attendance_reports: "Attendance",
    // billing
    billing_invoices: "Billing & Payments",
    receipts: "Billing & Payments",
    payment_tracking: "Billing & Payments",
    online_payment_links: "Billing & Payments",
    renewal_reminders: "Billing & Payments",
    auto_billing: "Billing & Payments",
    discount_promo_codes: "Billing & Payments",
    corporate_bulk_memberships: "Billing & Payments",
    payment_failure_handling: "Billing & Payments",
    partial_payment_dues: "Billing & Payments",
    razorpay_payu_integration: "Billing & Payments",
    multi_gstin_support: "Billing & Payments",
    branch_revenue_split: "Billing & Payments",
    // communication
    email_notifications: "Communication",
    in_app_notifications: "Communication",
    whatsapp_integration: "Communication",
    sms_integration: "Communication",
    birthday_greetings: "Communication",
    broadcast_messages: "Communication",
    email_campaigns: "Communication",
    whatsapp_business_api: "Communication",
    cross_branch_member_access: "Communication",
    // crm
    lead_management: "CRM & Sales",
    trial_management: "CRM & Sales",
    lead_followup_reminders: "CRM & Sales",
    re_engagement_automation: "CRM & Sales",
    advanced_crm_lead_pipeline: "CRM & Sales",
    referral_program: "CRM & Sales",
    loyalty_points_system: "CRM & Sales",
    network_wide_campaign_manager: "CRM & Sales",
    member_nps_surveys: "CRM & Sales",
    // enterprise
    multi_branch_management: "Enterprise",
    api_access: "Enterprise",
    webhooks: "Enterprise",
    audit_logs: "Enterprise",
    advanced_rbac: "Enterprise",
    priority_support: "Enterprise",
    staff_management: "Enterprise",
    tally_zoho_books_integration: "Enterprise",
    rest_api_access: "Enterprise",
    role_based_permissions: "Enterprise",
    multi_branch_staff_assignment: "Enterprise",
    hr_document_storage: "Enterprise",
    custom_roles_granular_permissions: "Enterprise",

    // membership
    member_management: "Membership Management",
    membership_renewals: "Membership Management",
    expiry_tracking: "Membership Management",
    goal_tracking: "Membership Management",
    progress_photos: "Membership Management",
    membership_pause_freeze: "Membership Management",
    member_tagging_segments: "Membership Management",
    member_progress_tracking: "Membership Management",
    custom_member_fields: "Membership Management",
    member_data_import_export: "Membership Management",
    // platform
    member_portal: "Platform",
    trainer_portal: "Platform",
    branded_mobile_app: "Platform",
    diet_workout_plans: "Platform",
    google_calendar_sync: "Platform",
    in_app_push_notifications: "Platform",
    digital_membership_card: "Platform",
    loyalty_rewards_in_app: "Platform",
    // reports
    basic_reports: "Reports & Analytics",
    advanced_reports: "Reports & Analytics",
    custom_dashboards: "Reports & Analytics",
    trainer_performance_report: "Reports & Analytics",
    class_occupancy_report: "Reports & Analytics",
    lead_conversion_report: "Reports & Analytics",
    branch_revenue_comparison: "Reports & Analytics",
    scheduled_report_delivery: "Reports & Analytics",
    equipment_inventory_maintenance: "Reports & Analytics",
    data_export_csv_download: "Reports & Analytics",
    custom_dashboards_kpis: "Reports & Analytics",
    // trainer
    trainer_management: "Trainer Management",
    workout_assignment: "Trainer Management",
    nutrition_plans: "Trainer Management",
    pt_sessions: "Trainer Management",
    class_booking: "Trainer Management",
    waitlist_management: "Trainer Management",
    cross_branch_class_booking: "Trainer Management",
    trainer_commissions_payroll: "Trainer Management",
    staff_attendance_leave: "Trainer Management",
    class_attendance_tracking: "Trainer Management",
    payroll_export: "Trainer Management",
    network_wide_class_calendar: "Trainer Management",
    trainer_sharing_across_branches: "Trainer Management",
    // white_label
    white_label: "White Label",
    custom_domain: "White Label",
    custom_branding: "White Label",
  };

  return keyToCategory[featureCode] ?? "Uncategorized";
}

export async function buildFeatureAuditReport(): Promise<FeatureAuditReport> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection failed.");

  const db = supabase as unknown as {
    from(t: string): {
      select(c: string): QueryBuilder;
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

  const sidebarModuleLabels: Record<string, string> = {};
  for (const mod of organizationOwnerModules) {
    if (mod.featureKey) {
      sidebarModuleLabels[mod.featureKey] = mod.label;
    }
  }

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

      const isInFeatureKeys = isFeatureKey(featureCode);
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
