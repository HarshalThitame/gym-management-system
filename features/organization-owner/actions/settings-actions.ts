"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";

export async function toggleFeatureFlagAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/settings");
    const flagId = formData.get("flagId") as string;
    const enabled = formData.get("enabled") === "true";
    if (!flagId) return { ...prevState, status: "error", message: "Flag ID is required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() } as never).eq("id", flagId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.toggle_feature_flag", entityType: "feature_flag", entityId: flagId, metadata: { enabled } as never });
    revalidateOrgModules(["/organization/settings"]);
    return { ...prevState, status: "success", message: `Flag ${enabled ? "enabled" : "disabled"}.` };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to toggle flag." };
  }
}

export async function saveBranchSettingAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/settings");
    const branchId = formData.get("branchId") as string;
    const settingsKey = formData.get("settingsKey") as string;
    const settingsValue = formData.get("settingsValue") as string;
    if (!branchId || !settingsKey) return { ...prevState, status: "error", message: "Branch ID and settings key are required." };

    const supabase = await createSupabaseServerClient();
    const parsedValue: Record<string, unknown> = {};
    try { Object.assign(parsedValue, JSON.parse(settingsValue)); } catch { Object.assign(parsedValue, { value: settingsValue }); }

    const columnKey = (settingsKey + "_settings") as "general_settings" | "membership_settings" | "payment_settings" | "attendance_settings" | "class_settings" | "notification_settings" | "security_settings";
    const update: Record<string, unknown> = { [columnKey]: parsedValue as Json, updated_by: ctx.userId, updated_at: new Date().toISOString() };

    const { data: existing } = await supabase.from("branch_settings").select("id").eq("branch_id", branchId).eq("organization_id", ctx.organizationId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("branch_settings").update(update as never).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const insert: Record<string, unknown> = { organization_id: ctx.organizationId, branch_id: branchId, [columnKey]: parsedValue as Json };
      const { error } = await supabase.from("branch_settings").insert(insert as never);
      if (error) throw new Error(error.message);
    }

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_branch_setting", entityType: "branch_setting", entityId: null, metadata: { branchId, settingsKey } as never });
    revalidateOrgModules(["/organization/settings"]);
    return { ...prevState, status: "success", message: "Setting saved." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to save setting." };
  }
}
