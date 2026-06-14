"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { z } from "zod";

const packageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  maxMembers: z.coerce.number().int().min(-1).default(0),
  maxBranches: z.coerce.number().int().min(-1).default(0),
  maxGyms: z.coerce.number().int().min(-1).default(1),
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
    max_gyms: parsed.data.maxGyms,
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
      const { error } = await (supabase as any).from("packages").update(payload).eq("id", parsed.data.id);
      if (error) return { status: "error", message: error.message };
      await writeAuditLog({ actorId: auth.context.userId, action: "package.updated", entityType: "package", entityId: parsed.data.id });
    } else {
      const { data, error } = await (supabase as any).from("packages").insert(payload).select("*").maybeSingle();
      if (error || !data) return { status: "error", message: error?.message ?? "Create failed" };
      await writeAuditLog({ actorId: auth.context.userId, action: "package.created", entityType: "package", entityId: data.id });
    }
    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: parsed.data.id ? "Package updated." : "Package created." };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}

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
    // Check for active subscriptions assigned to this package
    const { data: assignedSubs } = await (supabase as any)
      .from("organization_subscriptions")
      .select("id, status")
      .eq("package_id", packageId);

    const activeCount = (assignedSubs ?? []).filter((s: any) => s.status === "active" || s.status === "trial").length;
    const totalCount = (assignedSubs ?? []).length;

    if (totalCount > 0 && !forceDeactivate) {
      return {
        status: "error",
        message: `Cannot delete: ${totalCount} organization(s) are assigned to this plan (${activeCount} active). Deactivate the plan instead. Orgs will keep working until their subscription expires. Submit again with force deactivation to proceed.`,
        fieldErrors: { forceDeactivate: [`${totalCount} orgs assigned`] }
      };
    }

    if (totalCount > 0) {
      // Deactivate instead of delete — existing orgs keep working, new assign blocked
      const { error } = await (supabase as any).from("packages").update({ is_active: false }).eq("id", packageId);
      if (error) return { status: "error", message: error.message };
      await writeAuditLog({ actorId: auth.context.userId, action: "package.deactivated", entityType: "package", entityId: packageId, metadata: { assignedOrgs: totalCount, message: "Package deactivated instead of deleted because orgs were assigned" } });
      revalidatePath("/super-admin/subscriptions");
      return { status: "success", message: `Package deactivated — ${totalCount} org(s) will keep working until their subscription expires.` };
    }

    // No subscriptions — safe to hard delete
    const { error } = await (supabase as any).from("packages").delete().eq("id", packageId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ actorId: auth.context.userId, action: "package.deleted", entityType: "package", entityId: packageId });
    revalidatePath("/super-admin/subscriptions");
    return { status: "success", message: "Package permanently deleted." };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}
