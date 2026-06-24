"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrgWithinLimit, requireOrgFeature } from "../lib/entitlement-guards";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

type TrainerInsert = Database["public"]["Tables"]["trainers"]["Insert"];
type TrainerUpdate = Database["public"]["Tables"]["trainers"]["Update"];

export async function saveTrainerAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "trainer_management", actionName: "trainer.save" });
    const supabase = await createSupabaseServerClient();
    let trainerId = formData.get("trainerId") as string | null;
    const gymId = formData.get("gymId") as string;
    const displayName = formData.get("displayName") as string;
    if (!gymId || !displayName) return { ...prevState, status: "error", message: "Gym and trainer name are required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const employeeCode = `TRN-${Date.now().toString(36).toUpperCase()}`;
    const email = (formData.get("email") as string) || null;
    const phone = (formData.get("phone") as string) || null;
    const yearsExperience = formData.get("yearsExperience") ? Number(formData.get("yearsExperience")) : null;
    const employmentType = (formData.get("employmentType") as string) || "full_time";
    const status = (formData.get("status") as string) || "active";

    if (trainerId) {
      const update: Record<string, unknown> = { display_name: displayName, email, phone, years_experience: yearsExperience, employment_type: employmentType, status, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("trainers").update(update as never).eq("id", trainerId).eq("gym_id", gymId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_trainer", entityType: "trainer", entityId: trainerId });
    } else {
      // Enforce trainer limit before creation
      const { count } = await supabase
        .from("trainers")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gymId);
      const limitCheck = await requireOrgWithinLimit(ctx.organizationId, "max_trainers", count ?? 0);
      if (!limitCheck.ok) return { ...prevState, status: "error", message: limitCheck.error };

      const insert: Record<string, unknown> = { gym_id: gymId, employee_code: employeeCode, display_name: displayName, email, phone, years_experience: yearsExperience, employment_type: employmentType, status };
      const { data, error } = await supabase.from("trainers").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      trainerId = data.id;
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_trainer", entityType: "trainer", entityId: data.id });
    }

    // ── Multi-gym assignment (trainer sharing) ──
    const additionalGymIdsRaw = (formData.get("additionalGymIds") as string) || "";
    if (additionalGymIdsRaw && trainerId) {
      const { hasFeatureAccess: getHasFeature } = await import("@/features/entitlement");
      const hasSharing = await getHasFeature(ctx.organizationId, "trainer_sharing_across_branches");
      if (hasSharing) {
        const additionalIds = additionalGymIdsRaw.split(",").map((id) => id.trim()).filter(Boolean);
        const { data: existingAssignments } = await supabase
          .from("trainer_gym_assignments")
          .select("gym_id")
          .eq("trainer_id", trainerId)
          .eq("organization_id", ctx.organizationId);
        const existingGymIds = new Set((existingAssignments ?? []).map((a) => a.gym_id));

        // Remove unchecked assignments (except primary)
        for (const assign of (existingAssignments ?? [])) {
          if (assign.gym_id !== gymId && !additionalIds.includes(assign.gym_id)) {
            await supabase
              .from("trainer_gym_assignments")
              .delete()
              .eq("trainer_id", trainerId)
              .eq("gym_id", assign.gym_id)
              .eq("organization_id", ctx.organizationId);
          }
        }

        // Insert new assignments
        for (const addGymId of additionalIds) {
          if (!existingGymIds.has(addGymId)) {
            const { data: addGym } = await supabase.from("gyms").select("organization_id").eq("id", addGymId).single();
            if (addGym && addGym.organization_id === ctx.organizationId) {
              await supabase.from("trainer_gym_assignments").insert({
                trainer_id: trainerId,
                gym_id: addGymId,
                organization_id: ctx.organizationId,
                is_primary: addGymId === gymId,
              });
            }
          }
        }
      }
    }

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Trainer saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save trainer.");
  }
}

export async function assignMemberToTrainerAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "trainer_management", actionName: "trainer.assign_member" });
    const memberId = formData.get("memberId") as string;
    const trainerId = formData.get("trainerId") as string;
    if (!memberId || !trainerId) return { ...prevState, status: "error", message: "Member ID and Trainer ID are required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("members").update({ assigned_trainer_id: trainerId, updated_at: new Date().toISOString() }).eq("id", memberId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.assign_member_to_trainer", entityType: "member", entityId: memberId, metadata: { trainerId } as never });
    revalidateOrgModules(["/organization/trainers", "/organization/members"]);
    return { ...prevState, status: "success", message: "Member assigned." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to assign member.");
  }
}
