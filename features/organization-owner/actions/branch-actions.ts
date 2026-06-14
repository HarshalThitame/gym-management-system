"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";

type BranchInsert = Database["public"]["Tables"]["branches"]["Insert"];
type BranchUpdate = Database["public"]["Tables"]["branches"]["Update"];

export async function saveBranchAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/gyms");
    const supabase = await createSupabaseServerClient();
    const branchId = formData.get("branchId") as string | null;
    const gymId = formData.get("gymId") as string;
    const name = formData.get("name") as string;
    const branchCode = formData.get("branchCode") as string;
    if (!gymId || !name || !branchCode) return { ...prevState, status: "error", message: "Gym, name, and branch code are required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const slug = (formData.get("slug") as string) || name.toLowerCase().replace(/\s+/g, "-");
    const status = (formData.get("status") as string) || "active";
    const timezone = (formData.get("timezone") as string) || "Asia/Kolkata";
    const currency = (formData.get("currency") as string) || "INR";
    const capacity = Number(formData.get("capacity")) || 0;
    const address = (formData.get("address") as string) || null;
    const city = (formData.get("city") as string) || null;
    const state = (formData.get("state") as string) || null;
    const country = (formData.get("country") as string) || null;
    const postalCode = (formData.get("postalCode") as string) || null;
    const phone = (formData.get("phone") as string) || null;
    const email = (formData.get("email") as string) || null;

    if (branchId) {
      const update: Record<string, unknown> = { name, slug, branch_code: branchCode, status, timezone, currency, capacity, address, city, state, country, postal_code: postalCode, phone, email, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("branches").update(update as never).eq("id", branchId).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_branch", entityType: "branch", entityId: branchId });
    } else {
      const insert: Record<string, unknown> = { organization_id: ctx.organizationId, gym_id: gymId, name, slug, branch_code: branchCode, status, timezone, currency, capacity, address, city, state, country, postal_code: postalCode, phone, email };
      const { data, error } = await supabase.from("branches").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_branch", entityType: "branch", entityId: data.id });
    }

    revalidateOrgModules(["/organization/gyms"]);
    return { ...prevState, status: "success", message: "Branch saved." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to save branch." };
  }
}

export async function setBranchStatusAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/gyms");
    const branchId = formData.get("branchId") as string;
    const status = formData.get("status") as string;
    if (!branchId || !status) return { ...prevState, status: "error", message: "Branch ID and status are required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("branches").update({ status: status as never, updated_at: new Date().toISOString() }).eq("id", branchId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${status}_branch`, entityType: "branch", entityId: branchId });
    revalidateOrgModules(["/organization/gyms"]);
    return { ...prevState, status: "success", message: `Branch ${status}.` };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to update branch." };
  }
}
