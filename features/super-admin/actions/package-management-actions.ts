"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { z } from "zod";

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
  table: string;
  column: string;
  label: string;
  isRestricted: boolean;
};

const PACKAGE_DEPENDENCIES: DependencyCheck[] = [
  { table: "organization_subscriptions", column: "package_id", label: "organization subscriptions", isRestricted: true },
  { table: "subscription_addons", column: "addon_id", label: "subscription addon assignments", isRestricted: true },
  { table: "package_subscription_changes", column: "from_package_id", label: "subscription changes (from)", isRestricted: true },
  { table: "package_subscription_changes", column: "to_package_id", label: "subscription changes (to)", isRestricted: true },
];

export async function deletePackageAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prev;
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const packageId = formData.get("packageId");
  if (!packageId || typeof packageId !== "string") return { status: "error", message: "Package ID required." };
  const forceDeactivate = formData.get("forceDeactivate") === "true";

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Database connection failed." };

  try {
    const sb = supabase as SbClient;

    const depResults = await Promise.all(
      PACKAGE_DEPENDENCIES.map(async (dep) => {
        let query = sb.from(dep.table).select("id", { count: "exact", head: true }).eq(dep.column, packageId);

        if (dep.table === "subscription_addons" && dep.column === "addon_id") {
          query = sb.from("package_addons").select("id", { count: "exact", head: true }).eq("package_id", packageId);
          const { count: addonCount } = await query;
          if ((addonCount ?? 0) > 0) {
            const addonIds = (await sb.from("package_addons").select("id").eq("package_id", packageId)).data ?? [];
            const ids = addonIds.map((a: Record<string, unknown>) => a.id);
            if (ids.length > 0) {
              const { count: refCount } = await sb.from("subscription_addons").select("id", { count: "exact", head: true }).in("addon_id", ids);
              return { ...dep, count: refCount ?? 0 };
            }
          }
          return { ...dep, count: 0 };
        }

        const { count } = await query;
        return { ...dep, count: count ?? 0 };
      })
    );

    const totalRestricted = depResults.filter((d) => d.isRestricted).reduce((s, d) => s + d.count, 0);

    if (totalRestricted > 0 && !forceDeactivate) {
      const details = depResults
        .filter((d) => d.count > 0)
        .map((d) => `${d.count} ${d.label}`)
        .join(", ");
      return {
        status: "error",
        message: `Cannot delete: ${details}. Deactivate the plan instead.`,
        fieldErrors: { forceDeactivate: [details] }
      };
    }

    if (totalRestricted > 0) {
      const { error } = await sb.from("packages").update({ is_active: false }).eq("id", packageId);
      if (error) return { status: "error", message: error.message };
      await writeAuditLog({
        actorId: auth.context.userId,
        action: "package.deactivated",
        entityType: "package",
        entityId: packageId,
        metadata: {
          dependencyDetails: depResults.filter((d) => d.count > 0).map((d) => ({ table: d.table, count: d.count })),
        }
      });
      revalidatePath("/super-admin/subscriptions");
      return { status: "success", message: `Package deactivated — ${totalRestricted} historical reference(s) exist.` };
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
