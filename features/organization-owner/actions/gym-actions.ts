"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrgWithinLimit } from "../lib/entitlement-guards";
import { entitlementActionCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";

type GymInsert = Database["public"]["Tables"]["gyms"]["Insert"];
type GymUpdate = Database["public"]["Tables"]["gyms"]["Update"];

type GymActionResult = AuthActionState & {
  gymData?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    status: string;
  };
};

export async function saveGymAction(prevState: AuthActionState, formData: FormData): Promise<GymActionResult> {
  try {
    const ctx = await getOrgOwnerContext("/organization/branches");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "multi_branch_management", actionName: "gym.save" });
    const supabase = await createSupabaseServerClient();
    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { ...prevState, status: "error", message: "Server configuration error." };

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
      const { error } = await adminClient.from("gyms").update(update as never).eq("id", gymId).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_location", entityType: "gym", entityId: gymId });
      revalidateOrgModules(["/organization/branches"]);
      return { ...prevState, status: "success", message: "Location updated." };
    }

    // Enforce branch/location limit before creation
    const { count } = await supabase
      .from("gyms")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId);
    const limitCheck = await requireOrgWithinLimit(ctx.organizationId, "max_branches", count ?? 0);
    if (!limitCheck.ok) return { ...prevState, status: "error", message: limitCheck.error };

    const insert: GymInsert = { organization_id: ctx.organizationId, name, slug, timezone, currency, status: validStatus };
    const { data, error } = await adminClient.from("gyms").insert(insert as never).select("id,name,slug,timezone,currency,status").single();
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_location", entityType: "gym", entityId: data.id });

    revalidateOrgModules(["/organization/branches"]);
    return { ...prevState, status: "success", message: "Location saved.", gymData: { id: data.id, name: data.name, slug: data.slug, timezone: data.timezone, currency: data.currency, status: data.status } };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save gym.");
  }
}

export async function setGymStatusAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/branches");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "multi_branch_management", actionName: "gym.status.update" });
    const gymId = formData.get("gymId") as string;
    const status = formData.get("status") as "active" | "suspended" | "archived";
    if (!gymId || !status) return { ...prevState, status: "error", message: "Gym ID and status are required." };

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { ...prevState, status: "error", message: "Server configuration error." };

    const { error } = await adminClient.from("gyms").update({ status, updated_at: new Date().toISOString() } as never).eq("id", gymId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${status}_location`, entityType: "gym", entityId: gymId });
    revalidateOrgModules(["/organization/branches"]);
    return { ...prevState, status: "success", message: `Location ${status}.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to update gym.");
  }
}
