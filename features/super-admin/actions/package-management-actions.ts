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
  maxStorage: z.coerce.number().int().min(-1).default(0),
  maxApiCalls: z.coerce.number().int().min(-1).default(0),
  trialDays: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().int().min(0).default(0),
  billingPeriod: z.enum(["monthly", "quarterly", "half_yearly", "annual"]).default("monthly"),
  isActive: z.coerce.boolean().default(true),
  recommended: z.coerce.boolean().default(false),
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

export async function savePackageAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prev;
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const parsed = packageSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    maxMembers: formData.get("maxMembers") ?? "0",
    maxBranches: formData.get("maxBranches") ?? "0",
    maxTrainers: formData.get("maxTrainers") ?? "0",
    maxStorage: formData.get("maxStorage") ?? "0",
    maxApiCalls: formData.get("maxApiCalls") ?? "0",
    trialDays: formData.get("trialDays") ?? "0",
    sortOrder: formData.get("sortOrder") ?? "0",
    price: formData.get("price") ?? "0",
    billingPeriod: formData.get("billingPeriod") ?? "monthly",
    isActive: formData.get("isActive") === "on",
    recommended: formData.get("recommended") === "on",
    qrAttendance: formData.get("qrAttendance") === "on",
    classScheduling: formData.get("classScheduling") === "on",
    trainerAssignment: formData.get("trainerAssignment") === "on",
    aiEnabled: formData.get("aiEnabled") === "on",
    razorpayEnabled: formData.get("razorpayEnabled") === "on",
    communicationsEnabled: formData.get("communicationsEnabled") === "on",
    advancedReports: formData.get("advancedReports") === "on",
    customDomain: formData.get("customDomain") === "on",
    apiAccess: formData.get("apiAccess") === "on",
    biometricAttendance: formData.get("biometricAttendance") === "on",
    rfidAttendance: formData.get("rfidAttendance") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Database connection failed." };

  const payload: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    max_members: parsed.data.maxMembers,
    max_branches: parsed.data.maxBranches,
    max_trainers: parsed.data.maxTrainers,
    max_storage_gb: parsed.data.maxStorage,
    max_api_calls: parsed.data.maxApiCalls,
    trial_days: parsed.data.trialDays,
    sort_order: parsed.data.sortOrder,
    price: parsed.data.price,
    billing_period: parsed.data.billingPeriod,
    is_active: parsed.data.isActive,
    recommended: parsed.data.recommended,
    qr_attendance_enabled: parsed.data.qrAttendance,
    class_scheduling_enabled: parsed.data.classScheduling,
    trainer_assignment_enabled: parsed.data.trainerAssignment,
    ai_enabled: parsed.data.aiEnabled,
    razorpay_enabled: parsed.data.razorpayEnabled,
    communications_enabled: parsed.data.communicationsEnabled,
    advanced_reports_enabled: parsed.data.advancedReports,
    custom_domain_enabled: parsed.data.customDomain,
    api_access_enabled: parsed.data.apiAccess,
    biometric_attendance_enabled: parsed.data.biometricAttendance,
    rfid_attendance_enabled: parsed.data.rfidAttendance,
    notifications_enabled: parsed.data.notificationsEnabled,
    white_label_enabled: parsed.data.whiteLabelEnabled,
  };

  try {
    if (parsed.data.id) {
      const { error } = await (supabase as SbClient).from("packages").update(payload).eq("id", parsed.data.id);
      if (error) return { status: "error", message: error.message };
      await writeAuditLog({ actorId: auth.context.userId, action: "package.updated", entityType: "package", entityId: parsed.data.id });
    } else {
      const { data, error } = await (supabase as SbClient).from("packages").insert(payload).select("*").maybeSingle();
      if (error || !data) return { status: "error", message: error?.message ?? "Create failed" };
      await writeAuditLog({ actorId: auth.context.userId, action: "package.created", entityType: "package", entityId: data.id });
    }
    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: parsed.data.id ? "Package updated." : "Package created." };
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong while processing this action. Please try again.";
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

    // Check all restricted FK dependencies in parallel
    const depResults = await Promise.all(
      PACKAGE_DEPENDENCIES.map(async (dep) => {
        let query = sb.from(dep.table).select("id", { count: "exact", head: true }).eq(dep.column, packageId);

        // subscription_addons.addon_id references package_addons, not packages directly
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

    // If any restricted FK references exist, block hard delete
    if (totalRestricted > 0 && !forceDeactivate) {
      const details = depResults
        .filter((d) => d.count > 0)
        .map((d) => `${d.count} ${d.label}`)
        .join(", ");
      return {
        status: "error",
        message: `Cannot delete: ${details}. Deactivate the plan instead. Existing subscriptions will keep working until they expire. Submit again with force deactivation to proceed.`,
        fieldErrors: { forceDeactivate: [details] }
      };
    }

    if (totalRestricted > 0) {
      // Archive/deactivate instead of delete
      const { error } = await sb.from("packages").update({ is_active: false }).eq("id", packageId);
      if (error) return { status: "error", message: error.message };
      await writeAuditLog({
        actorId: auth.context.userId,
        action: "package.deactivated",
        entityType: "package",
        entityId: packageId,
        metadata: {
          dependencyDetails: depResults.filter((d) => d.count > 0).map((d) => ({ table: d.table, count: d.count })),
          message: "Package deactivated because it has historical subscription/addon references. Hard delete blocked."
        }
      });
      revalidatePath("/super-admin/subscriptions");
      return {
        status: "success",
        message: `Package deactivated — ${totalRestricted} historical reference(s) exist. Existing subscriptions will keep working.`
      };
    }

    // Zero references — safe to hard delete all related data via CASCADE
    const { error } = await sb.from("packages").delete().eq("id", packageId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ actorId: auth.context.userId, action: "package.deleted", entityType: "package", entityId: packageId });
    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: "Package permanently deleted." };
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong while processing this action. Please try again.";
    return { status: "error", message };
  }
}
