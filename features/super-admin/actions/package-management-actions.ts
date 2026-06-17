"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = any;

const packageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  maxMembers: z.coerce.number().int().min(-1).default(0),
  maxBranches: z.coerce.number().int().min(-1).default(0),
  maxTrainers: z.coerce.number().int().min(-1).default(0),
  maxStaff: z.coerce.number().int().min(-1).default(0),
  maxStorage: z.coerce.number().int().min(-1).default(0),
  maxApiCalls: z.coerce.number().int().min(-1).default(0),
  trialDays: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().int().min(0).default(0),
  billingPeriod: z.enum(["monthly", "quarterly", "half_yearly", "annual"]).default("monthly"),
  isActive: z.coerce.boolean().default(true),
  recommended: z.coerce.boolean().default(false),
  // Feature toggles (checkbox fields from editor)
  qrAttendance: z.coerce.boolean().default(false),
  classScheduling: z.coerce.boolean().default(false),
  trainerAssignment: z.coerce.boolean().default(false),
  aiEnabled: z.coerce.boolean().default(false),
  razorpayEnabled: z.coerce.boolean().default(false),
  communicationsEnabled: z.coerce.boolean().default(false),
  advancedReports: z.coerce.boolean().default(false),
  customDomain: z.coerce.boolean().default(false),
  apiAccess: z.coerce.boolean().default(false),
  biometricAttendance: z.coerce.boolean().default(false),
  rfidAttendance: z.coerce.boolean().default(false),
  notificationsEnabled: z.coerce.boolean().default(false),
  whiteLabelEnabled: z.coerce.boolean().default(false),
});

// New streamlined feature toggles from the editor
const FEATURE_FIELD_MAP: Record<string, string> = {
  manual_attendance: "manualAttendance",
  qr_attendance: "qrAttendance",
  biometric_attendance: "biometricAttendance",
  rfid_attendance: "rfidAttendance",
  member_management: "memberManagement",
  class_booking: "classScheduling",
  trainer_management: "trainerManagement",
  whatsapp_integration: "communicationsEnabled",
  sms_integration: "smsIntegration",
  billing_invoices: "razorpayEnabled",
  basic_reports: "basicReports",
  advanced_reports: "advancedReports",
  member_portal: "memberPortal",
  api_access: "apiAccess",
  white_label: "whiteLabelEnabled",
  custom_domain: "customDomain",
  ai_recommendations: "aiEnabled",
  multi_branch_management: "multiBranchManagement",
  lead_management: "leadManagement",
  pt_sessions: "ptSessions",
  nutrition_plans: "nutritionPlans",
  goal_tracking: "goalTracking",
  progress_photos: "progressPhotos",
  workout_assignment: "trainerAssignment",
  staff_management: "staffManagement",
  expiry_tracking: "expiryTracking",
  membership_renewals: "membershipRenewals",
  attendance_reports: "attendanceReports",
  email_notifications: "emailNotifications",
  in_app_notifications: "notificationsEnabled",
  trainer_portal: "trainerPortal",
  // Growth-specific features
  member_tagging_segments: "memberTaggingSegments",
  member_progress_tracking: "memberProgressTracking",
  payment_failure_handling: "paymentFailureHandling",
  partial_payment_dues: "partialPaymentDues",
  razorpay_payu_integration: "razorpayPayuIntegration",
  class_attendance_tracking: "classAttendanceTracking",
  payroll_export: "payrollExport",
  role_based_permissions: "roleBasedPermissions",
  lead_followup_reminders: "leadFollowupReminders",
  re_engagement_automation: "reEngagementAutomation",
  trainer_performance_report: "trainerPerformanceReport",
  class_occupancy_report: "classOccupancyReport",
  lead_conversion_report: "leadConversionReport",
  branch_revenue_comparison: "branchRevenueComparison",
  franchise_rollup_reports: "franchiseRollupReports",
  whatsapp_business_api: "whatsappBusinessApi",
  google_calendar_sync: "googleCalendarSync",
  white_label_mobile_app: "whiteLabelMobileApp",
  tally_zoho_books_integration: "tallyZohoBooksIntegration",
  rest_api_access: "restApiAccess",
  cross_branch_member_access: "crossBranchMemberAccess",
  custom_member_fields: "customMemberFields",
  member_data_import_export: "memberDataImportExport",
  multi_currency_billing: "multiCurrencyBilling",
  franchise_fee_management: "franchiseFeeManagement",
  multi_gstin_support: "multiGstinSupport",
  pos_merchandise_supplements: "posMerchandiseSupplements",
  branch_revenue_split: "branchRevenueSplit",
  network_wide_class_calendar: "networkWideClassCalendar",
  trainer_sharing_across_branches: "trainerSharingAcrossBranches",
  custom_roles_granular_permissions: "customRolesGranularPermissions",
  multi_branch_staff_assignment: "multiBranchStaffAssignment",
  hr_document_storage: "hrDocumentStorage",
  advanced_crm_lead_pipeline: "advancedCrmLeadPipeline",
  referral_program: "referralProgram",
  loyalty_points_system: "loyaltyPointsSystem",
  network_wide_campaign_manager: "networkWideCampaignManager",
  member_nps_surveys: "memberNpsSurveys",
  franchise_rollup_dashboard: "franchiseRollupDashboard",
  custom_dashboards_kpis: "customDashboardsKpis",
  scheduled_report_delivery: "scheduledReportDelivery",
  equipment_inventory_maintenance: "equipmentInventoryMaintenance",
  data_export_csv_download: "dataExportCsvDownload",
  in_app_push_notifications: "inAppPushNotifications",
  digital_membership_card: "digitalMembershipCard",
  loyalty_rewards_in_app: "loyaltyRewardsInApp",
  sso_saml_login: "ssoSamlLogin",
  dedicated_cloud_infrastructure: "dedicatedCloudInfrastructure",
  dedicated_onboarding_manager: "dedicatedOnboardingManager",
  response_sla: "responseSla",
  named_account_manager: "namedAccountManager",
  automated_backups_90_day_retention: "automatedBackups90DayRetention",
  uptime_sla_99_9: "uptimeSla99_9",
  staff_training_sessions: "staffTrainingSessions",
  custom_feature_requests: "customFeatureRequests",
};

export async function savePackageAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prev;
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  // Build parsed data from form
  const raw: Record<string, unknown> = {
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    maxMembers: formData.get("maxMembers") ?? "0",
    maxBranches: formData.get("maxBranches") ?? "0",
    maxTrainers: formData.get("maxTrainers") ?? "0",
    maxStaff: formData.get("maxStaff") ?? "0",
    maxStorage: formData.get("maxStorage") ?? "0",
    maxApiCalls: formData.get("maxApiCalls") ?? "0",
    trialDays: formData.get("trialDays") ?? "0",
    sortOrder: formData.get("sortOrder") ?? "0",
    price: formData.get("price") ?? "0",
    billingPeriod: formData.get("billingPeriod") ?? "monthly",
    isActive: formData.get("isActive") === "on",
    recommended: formData.get("recommended") === "on",
  };

  // Collect feature toggles from form
  for (const [featureCode, fieldName] of Object.entries(FEATURE_FIELD_MAP)) {
    raw[fieldName] = formData.get(fieldName) === "on";
  }

  // Also catch any feature_xxx or direct boolean toggles from the editor
  const allKeys = Array.from(formData.keys());
  for (const key of allKeys) {
    if (key.startsWith("feature_") && !raw[key]) {
      raw[key] = formData.get(key) === "on";
    }
  }

  const parsed = packageSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Database connection failed." };

  const sb = supabase as SbClient;

  const payload: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    sort_order: parsed.data.sortOrder,
    price: parsed.data.price,
    billing_period: parsed.data.billingPeriod,
    is_active: parsed.data.isActive,
    recommended: parsed.data.recommended,
    trial_days: parsed.data.trialDays,
  };

  try {
    let packageId: string;

    if (parsed.data.id) {
      await sb.from("packages").update(payload).eq("id", parsed.data.id);
      packageId = parsed.data.id;
      await writeAuditLog({ actorId: auth.context.userId, action: "package.updated", entityType: "package", entityId: parsed.data.id });

      // Also update slug if name changed
      const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await sb.from("packages").update({ slug }).eq("id", packageId);
    } else {
      const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data, error } = await sb.from("packages").insert({ ...payload, slug }).select("*").maybeSingle();
      if (error || !data) return { status: "error", message: error?.message ?? "Create failed" };
      packageId = data.id;
      await writeAuditLog({ actorId: auth.context.userId, action: "package.created", entityType: "package", entityId: packageId });
    }

    // Save feature toggles to package_features table
    const featureValues: Array<{ package_id: string; feature_code: string; value: string }> = [];

    // Map from form field names back to feature codes
    for (const [featureCode, fieldName] of Object.entries(FEATURE_FIELD_MAP)) {
      const value = raw[fieldName] === true ? "true" : "false";
      featureValues.push({ package_id: packageId, feature_code: featureCode, value });
    }

    // Upsert each feature
    for (const fv of featureValues) {
      await sb.from("package_features").upsert(
        { package_id: fv.package_id, feature_code: fv.feature_code, value: fv.value },
        { onConflict: "package_id, feature_code" }
      );
    }

    // Save limits to package_limits table
    const limitMappings: Array<{ limit_code: string; label: string; value: number; sort_order: number }> = [
      { limit_code: "max_members", label: "Maximum Members", value: parsed.data.maxMembers, sort_order: 1 },
      { limit_code: "max_branches", label: "Maximum Branches", value: parsed.data.maxBranches, sort_order: 2 },
      { limit_code: "max_trainers", label: "Maximum Trainers", value: parsed.data.maxTrainers, sort_order: 3 },
      { limit_code: "max_staff", label: "Maximum Staff", value: parsed.data.maxStaff, sort_order: 4 },
      { limit_code: "max_storage_gb", label: "Storage Limit (GB)", value: parsed.data.maxStorage, sort_order: 5 },
      { limit_code: "max_api_calls", label: "Monthly API Calls", value: parsed.data.maxApiCalls, sort_order: 6 },
    ];

    for (const lm of limitMappings) {
      await sb.from("package_limits").upsert(
        { package_id: packageId, limit_code: lm.limit_code, label: lm.label, value: lm.value, sort_order: lm.sort_order },
        { onConflict: "package_id, limit_code" }
      );
    }

    // Save pricing to package_pricing table
    await sb.from("package_pricing").upsert(
      { package_id: packageId, billing_period: parsed.data.billingPeriod, price: parsed.data.price, currency: "INR" },
      { onConflict: "package_id, billing_period" }
    );

    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: parsed.data.id ? "Package updated." : "Package created." };
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong while processing this action.";
    return { status: "error", message };
  }
}

type DependencyCheck = {
  table: "organization_subscriptions" | "scheduled_plan_changes" | "subscription_requests" | "subscription_addons";
  column: string;
  label: string;
};

type DependencyResult = DependencyCheck & {
  count: number;
};

const PACKAGE_REFERENCE_CHECKS: DependencyCheck[] = [
  { table: "organization_subscriptions", column: "package_id", label: "organization subscriptions" },
  { table: "scheduled_plan_changes", column: "from_package_id", label: "scheduled plan changes (from)" },
  { table: "scheduled_plan_changes", column: "to_package_id", label: "scheduled plan changes (to)" },
  { table: "subscription_requests", column: "current_package_id", label: "subscription requests (current)" },
  { table: "subscription_requests", column: "requested_package_id", label: "subscription requests (requested)" },
];

async function countPackageReference(sb: SbClient, dep: DependencyCheck, packageId: string): Promise<DependencyResult> {
  const { count, error } = await sb.from(dep.table).select("id", { count: "exact", head: true }).eq(dep.column, packageId);
  if (error) throw new Error(`Could not verify ${dep.label}: ${error.message}`);
  return { ...dep, count: count ?? 0 };
}

async function countAssignedPackageAddons(sb: SbClient, packageId: string): Promise<DependencyResult> {
  const dep: DependencyCheck = { table: "subscription_addons", column: "addon_id", label: "subscription addon assignments" };
  const { data: addons, error: addonsError } = await sb.from("package_addons").select("id").eq("package_id", packageId);
  if (addonsError) throw new Error(`Could not verify package add-ons: ${addonsError.message}`);

  const addonIds = (addons ?? [])
    .map((addon: Record<string, unknown>) => addon.id)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);

  if (addonIds.length === 0) return { ...dep, count: 0 };

  const { count, error } = await sb.from("subscription_addons").select("id", { count: "exact", head: true }).in("addon_id", addonIds);
  if (error) throw new Error(`Could not verify ${dep.label}: ${error.message}`);
  return { ...dep, count: count ?? 0 };
}

function getDependencyDetails(depResults: DependencyResult[]) {
  return depResults
    .filter((dep) => dep.count > 0)
    .map((dep) => `${dep.count} ${dep.label}`)
    .join(", ");
}

export async function deletePackageAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prev;
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const packageId = formData.get("packageId");
  if (!packageId || typeof packageId !== "string") return { status: "error", message: "Package ID required." };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Database connection failed." };

  try {
    const sb = supabase as SbClient;

    const depResults = await Promise.all([
      ...PACKAGE_REFERENCE_CHECKS.map((dep) => countPackageReference(sb, dep, packageId)),
      countAssignedPackageAddons(sb, packageId),
    ]);

    const totalRestricted = depResults.reduce((sum, dep) => sum + dep.count, 0);

    if (totalRestricted > 0) {
      const { error } = await sb.from("packages").update({ is_active: false }).eq("id", packageId);
      if (error) return { status: "error", message: error.message };
      const details = getDependencyDetails(depResults);
      await writeAuditLog({
        actorId: auth.context.userId,
        action: "package.deactivated",
        entityType: "package",
        entityId: packageId,
        metadata: {
          dependencyDetails: depResults.filter((d) => d.count > 0).map((d) => ({ table: d.table, column: d.column, count: d.count })),
        }
      });
      revalidatePath("/super-admin/subscriptions");
      return { status: "success", message: `Package archived because it has historical references: ${details}.` };
    }

    const { error } = await sb.from("packages").delete().eq("id", packageId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ actorId: auth.context.userId, action: "package.deleted", entityType: "package", entityId: packageId });
    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: "Package permanently deleted." };
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong while processing this action.";
    return { status: "error", message };
  }
}
