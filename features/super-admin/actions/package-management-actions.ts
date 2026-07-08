"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { z } from "zod";
import { FEATURE_KEYS } from "@/features/entitlement";
import { syncSubscriptionArtifactsForOrganization } from "../services/subscription-entitlement-sync";

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
  maxGyms: z.coerce.number().int().min(-1).default(0),
  membershipPlanTypes: z.coerce.number().int().min(-1).default(0),
  weeklyClasses: z.coerce.number().int().min(-1).default(0),
  smsMonthly: z.coerce.number().int().min(-1).default(0),
  trialDays: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
  billingPeriod: z.enum(["monthly", "annual"]).default("monthly"),
  isActive: z.coerce.boolean().default(true),
  recommended: z.coerce.boolean().default(false),
  priceMonthly: z.coerce.number().int().min(0).default(0),
  priceAnnual: z.coerce.number().int().min(0).default(0),
  annualDiscountLabel: z.string().trim().max(100).optional().or(z.literal("")).default("2 months free"),
  isTrialAvailable: z.coerce.boolean().default(true),
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
  customEmailDomain: z.coerce.boolean().default(false),
});

// Feature toggles from the editor. Keys are canonical feature keys (snake_case)
// that MUST exist in feature_catalog.code — enforced by DB foreign key
// (package_features_feature_code_fkey). The single source of truth for the
// valid key set is features/entitlement/feature-registry.ts (FEATURE_KEYS).
// TODO(Phase 3): add missing keys (e.g. custom_branding, trial_management,
// nfc_attendance, fingerprint_attendance,
// geo_fencing_attendance, attendance_api, dynamic_qr_attendance) so the
// editor can control every registered feature.
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
  whatsapp_business_api: "whatsappBusinessApi",
  google_calendar_sync: "googleCalendarSync",
  tally_zoho_books_integration: "tallyZohoBooksIntegration",
  rest_api_access: "restApiAccess",
  cross_branch_member_access: "crossBranchMemberAccess",
  custom_member_fields: "customMemberFields",
  member_data_import_export: "memberDataImportExport",
  multi_gstin_support: "multiGstinSupport",
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
  custom_dashboards_kpis: "customDashboardsKpis",
  scheduled_report_delivery: "scheduledReportDelivery",
  equipment_inventory_maintenance: "equipmentInventoryMaintenance",
  data_export_csv_download: "dataExportCsvDownload",
  in_app_push_notifications: "inAppPushNotifications",
  digital_membership_card: "digitalMembershipCard",
  loyalty_rewards_in_app: "loyaltyRewardsInApp",
  custom_email_domain: "customEmailDomain",

};

const FEATURE_FORM_FIELD_ALIASES: Record<string, string> = Object.fromEntries(
  FEATURE_KEYS.map((featureCode) => [featureCode, FEATURE_FIELD_MAP[featureCode] ?? featureCode]),
);

function readCheckbox(formData: FormData, fieldName: string) {
  return formData.get(fieldName) === "on" || formData.get(fieldName) === "true";
}

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
    maxGyms: formData.get("maxGyms") ?? "0",
    membershipPlanTypes: formData.get("membershipPlanTypes") ?? "0",
    weeklyClasses: formData.get("weeklyClasses") ?? "0",
    smsMonthly: formData.get("smsMonthly") ?? "0",
    trialDays: formData.get("trialDays") ?? "0",
    sortOrder: formData.get("sortOrder") ?? "0",
    billingPeriod: formData.get("billingPeriod") ?? "monthly",
    priceMonthly: formData.get("priceMonthly") ?? "0",
    priceAnnual: formData.get("priceAnnual") ?? "0",
    annualDiscountLabel: formData.get("annualDiscountLabel") ?? "2 months free",
    isTrialAvailable: formData.get("isTrialAvailable") === "on",
    isActive: formData.get("isActive") === "on",
    recommended: formData.get("recommended") === "on",
  };

  // Collect feature toggles from form. Support both historical alias field
  // names and canonical feature-code field names from the editor.
  for (const [featureCode, fieldName] of Object.entries(FEATURE_FORM_FIELD_ALIASES)) {
    raw[fieldName] = readCheckbox(formData, fieldName) || readCheckbox(formData, featureCode);
  }

  const parsed = packageSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.priceMonthly <= 0 || parsed.data.priceAnnual <= 0) {
    return {
      status: "error",
      message: "Monthly and annual pricing are required for every package. Save both live pricing rows before publishing the plan.",
      fieldErrors: {
        priceMonthly: parsed.data.priceMonthly <= 0 ? ["Monthly pricing is required."] : undefined,
        priceAnnual: parsed.data.priceAnnual <= 0 ? ["Annual pricing is required."] : undefined,
      },
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Database connection failed." };

  const sb = supabase as SbClient;

  const payload: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    sort_order: parsed.data.sortOrder,
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
    for (const featureCode of FEATURE_KEYS) {
      const fieldName = FEATURE_FORM_FIELD_ALIASES[featureCode];
      const enabled = Boolean(raw[fieldName]);
      featureValues.push({ package_id: packageId, feature_code: featureCode, value: enabled ? "true" : "false" });
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
      { limit_code: "max_gyms", label: "Maximum Gyms", value: parsed.data.maxGyms, sort_order: 7 },
      { limit_code: "membership_plan_types", label: "Membership Plan Types", value: parsed.data.membershipPlanTypes, sort_order: 8 },
      { limit_code: "weekly_classes", label: "Weekly Classes", value: parsed.data.weeklyClasses, sort_order: 9 },
      { limit_code: "sms_monthly", label: "Monthly SMS Limit", value: parsed.data.smsMonthly, sort_order: 10 },
    ];

    for (const lm of limitMappings) {
      await sb.from("package_limits").upsert(
        { package_id: packageId, limit_code: lm.limit_code, label: lm.label, value: lm.value, sort_order: lm.sort_order },
        { onConflict: "package_id, limit_code" }
      );
    }

    // Save pricing to package_pricing table (monthly + annual + other periods)
    const priceMonthly = parsed.data.priceMonthly;
    const priceAnnual = parsed.data.priceAnnual;
    const pricingPeriods: Array<{ billing_period: string; price: number }> = [
      { billing_period: "monthly", price: priceMonthly },
      { billing_period: "annual", price: priceAnnual },
    ];
    // Also keep quarterly and half_yearly if they exist (auto-calculate)
    for (const existingPrice of (await sb.from("package_pricing").select("billing_period, price").eq("package_id", packageId)).data ?? []) {
      const bp = existingPrice.billing_period as string;
      if (bp !== "monthly" && bp !== "annual") {
        pricingPeriods.push({ billing_period: bp, price: existingPrice.price as number });
      }
    }
    for (const pp of pricingPeriods) {
      await sb.from("package_pricing").upsert(
        { package_id: packageId, billing_period: pp.billing_period, price: pp.price, currency: "INR" },
        { onConflict: "package_id, billing_period" }
      );
    }

    // Save pricing labels to package metadata
    const pkgMeta = {
      price_monthly: priceMonthly,
      price_annual: priceAnnual,
      annual_discount_label: parsed.data.annualDiscountLabel || "2 months free",
      trial_days: parsed.data.trialDays || 0,
      is_trial_available: parsed.data.isTrialAvailable,
    };

    await sb.from("packages").update({ metadata: pkgMeta }).eq("id", packageId);

    const { data: impactedSubscriptions } = await sb
      .from("organization_subscriptions")
      .select("organization_id")
      .eq("package_id", packageId)
      .in("status", ["active", "trial"]);

    const impactedOrganizationIds = [...new Set(
      ((impactedSubscriptions ?? []) as Array<Record<string, unknown>>)
        .map((row) => row.organization_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    )];

    await Promise.all(
      impactedOrganizationIds.map((organizationId) =>
        syncSubscriptionArtifactsForOrganization(
          organizationId,
          `Package ${packageId} configuration updated by Super Admin.`,
        ),
      ),
    );

    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: parsed.data.id ? "Package updated." : "Package created." };
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong while processing this action.";
    return { status: "error", message };
  }
}

type DependencyCheck = {
  table: "organization_subscriptions" | "scheduled_plan_changes" | "subscription_addons";
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
