"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrgWithinLimit } from "../lib/entitlement-guards";

type GymInsert = Database["public"]["Tables"]["gyms"]["Insert"];
type GymUpdate = Database["public"]["Tables"]["gyms"]["Update"];

export async function saveGymAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/branches");
    const supabase = await createSupabaseServerClient();
    const gymId = formData.get("gymId") as string | null;
    const name = formData.get("name") as string;
    if (!name) return { ...prevState, status: "error", message: "Location name is required." };

    const slug = (formData.get("slug") as string) || name.toLowerCase().replace(/\s+/g, "-");
    const timezone = (formData.get("timezone") as string) || "Asia/Kolkata";
    const currency = (formData.get("currency") as string) || "INR";
    const status = (formData.get("status") as string) || "active";
    const validStatus = status as "active" | "suspended" | "archived";

    if (gymId) {
      const update: GymUpdate = { name, slug, timezone, currency, status: validStatus, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("gyms").update(update).eq("id", gymId).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_location", entityType: "gym", entityId: gymId });
    } else {
      // Enforce branch/location limit before creation
      const { count } = await supabase
        .from("gyms")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId);
      const limitCheck = await requireOrgWithinLimit(ctx.organizationId, "max_branches", count ?? 0);
      if (!limitCheck.ok) return { ...prevState, status: "error", message: limitCheck.error };

      const insert: GymInsert = { organization_id: ctx.organizationId, name, slug, timezone, currency, status: validStatus };
      const { data, error } = await supabase.from("gyms").insert(insert).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_location", entityType: "gym", entityId: data.id });
    }

    revalidateOrgModules(["/organization/branches"]);
    return { ...prevState, status: "success", message: "Location saved." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to save gym." };
  }
}

export async function setGymStatusAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/branches");
    const gymId = formData.get("gymId") as string;
    const status = formData.get("status") as "active" | "suspended" | "archived";
    if (!gymId || !status) return { ...prevState, status: "error", message: "Gym ID and status are required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("gyms").update({ status, updated_at: new Date().toISOString() }).eq("id", gymId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${status}_location`, entityType: "gym", entityId: gymId });
    revalidateOrgModules(["/organization/branches"]);
    return { ...prevState, status: "success", message: `Location ${status}.` };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to update gym." };
  }
}
