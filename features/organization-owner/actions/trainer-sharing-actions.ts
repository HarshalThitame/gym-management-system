"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, requireOrgFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

export type TrainerGymAssignment = {
  gym_id: string;
  gym_name: string;
  is_primary: boolean;
};

export type TrainerWithGyms = {
  id: string;
  display_name: string;
  primary_gym_id: string | null;
  assigned_gym_ids: string[];
};

async function requireTrainerSharingAccess(organizationId: string) {
  const ctx = await getOrgOwnerContext("/organization/trainers");
  const scoped = await requireOrgFeatureAccess(ctx.organizationId, "trainer_sharing_across_branches");

  if (organizationId !== scoped.organizationId) {
    throw new Error("Organization scope mismatch.");
  }

  return scoped.organizationId;
}

function getGymNameFromJoin(row: Record<string, unknown>): string {
  const gyms = row.gyms;
  if (!gyms) return "";
  if (Array.isArray(gyms) && gyms.length > 0) {
    const first = gyms[0] as Record<string, unknown> | undefined;
    return String(first?.name ?? "");
  }
  const obj = gyms as Record<string, unknown>;
  return String(obj.name ?? "");
}

export async function getTrainerGymAssignments(
  organizationId: string,
  trainerId: string
): Promise<TrainerGymAssignment[]> {
  const scopedOrganizationId = await requireTrainerSharingAccess(organizationId);

  const supabase = await createSupabaseServerClient();

  const { data: assignments, error } = await supabase
    .from("trainer_gym_assignments")
    .select("gym_id, is_primary, gyms!inner(name)")
    .eq("trainer_id", trainerId)
    .eq("organization_id", scopedOrganizationId);

  if (error) throw new Error(error.message);

  return (assignments ?? []).map((a) => ({
    gym_id: a.gym_id,
    gym_name: getGymNameFromJoin(a as unknown as Record<string, unknown>),
    is_primary: a.is_primary ?? false,
  }));
}

export async function assignTrainerToGymAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "trainer_sharing_across_branches",
      actionName: "trainer.assign_gym",
    });

    const trainerId = formData.get("trainerId") as string;
    const gymId = formData.get("gymId") as string;
    if (!trainerId || !gymId) {
      return { ...prevState, status: "error", message: "Trainer ID and Gym ID are required." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: gym } = await supabase
      .from("gyms")
      .select("organization_id")
      .eq("id", gymId)
      .single();

    if (!gym || gym.organization_id !== ctx.organizationId) {
      return { ...prevState, status: "error", message: "Gym not in your organization." };
    }

    const { data: trainer } = await supabase
      .from("trainers")
      .select("id, gym_id")
      .eq("id", trainerId)
      .single();

    if (!trainer) {
      return { ...prevState, status: "error", message: "Trainer not found." };
    }

    const { data: existing } = await supabase
      .from("trainer_gym_assignments")
      .select("id")
      .eq("trainer_id", trainerId)
      .eq("gym_id", gymId)
      .maybeSingle();

    if (!existing) {
      const isPrimary = trainer.gym_id === gymId;
      const { error } = await supabase
        .from("trainer_gym_assignments")
        .insert({
          trainer_id: trainerId,
          gym_id: gymId,
          organization_id: ctx.organizationId,
          is_primary: isPrimary,
        });

      if (error) throw new Error(error.message);
    }

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Trainer assigned to gym." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to assign trainer to gym.");
  }
}

export async function removeTrainerFromGymAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "trainer_sharing_across_branches",
      actionName: "trainer.remove_gym",
    });

    const trainerId = formData.get("trainerId") as string;
    const gymId = formData.get("gymId") as string;
    if (!trainerId || !gymId) {
      return { ...prevState, status: "error", message: "Trainer ID and Gym ID are required." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: assignment } = await supabase
      .from("trainer_gym_assignments")
      .select("is_primary")
      .eq("trainer_id", trainerId)
      .eq("gym_id", gymId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (!assignment) {
      return { ...prevState, status: "error", message: "Trainer is not assigned to this gym." };
    }

    if (assignment.is_primary) {
      return { ...prevState, status: "error", message: "Cannot remove the primary gym assignment." };
    }

    const { error } = await supabase
      .from("trainer_gym_assignments")
      .delete()
      .eq("trainer_id", trainerId)
      .eq("gym_id", gymId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Trainer removed from gym." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to remove trainer from gym.");
  }
}

export async function getAllTrainersWithGyms(organizationId: string): Promise<TrainerWithGyms[]> {
  const scopedOrganizationId = await requireTrainerSharingAccess(organizationId);
  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", scopedOrganizationId);

  const gymIds = (gyms ?? []).map((g) => g.id);

  if (gymIds.length === 0) return [];

  const { data: trainers } = await supabase
    .from("trainers")
    .select("id, display_name, gym_id")
    .in("gym_id", gymIds)
    .order("display_name");

  const trainerRows = trainers ?? [];
  const trainerIds = trainerRows.map((t) => t.id);

  const assignmentMap = new Map<string, string[]>();
  if (trainerIds.length > 0) {
    const { data: assignments } = await supabase
      .from("trainer_gym_assignments")
      .select("trainer_id, gym_id")
      .in("trainer_id", trainerIds)
      .eq("organization_id", scopedOrganizationId);

    for (const a of (assignments ?? [])) {
      const existing = assignmentMap.get(a.trainer_id) ?? [];
      existing.push(a.gym_id);
      assignmentMap.set(a.trainer_id, existing);
    }
  }

  return trainerRows.map((t) => ({
    id: t.id,
    display_name: t.display_name,
    primary_gym_id: t.gym_id,
    assigned_gym_ids: assignmentMap.get(t.id) ?? [],
  }));
}

export async function getTrainerAssignedGymIds(
  trainerId: string,
  organizationId: string
): Promise<string[]> {
  const scopedOrganizationId = await requireTrainerSharingAccess(organizationId);
  const supabase = await createSupabaseServerClient();

  const { data: assignments } = await supabase
    .from("trainer_gym_assignments")
    .select("gym_id")
    .eq("trainer_id", trainerId)
    .eq("organization_id", scopedOrganizationId);

  return (assignments ?? []).map((a) => a.gym_id);
}
