"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { RoleAssignmentSchema } from "../schemas/auth";
import type { AuthActionState } from "./action-state";

export async function assignUserRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const actor = await requireGymAdminScope("/admin/settings");
  const parsed = RoleAssignmentSchema.safeParse({
    userId: formData.get("userId"),
    roleName: formData.get("roleName"),
    gymId: formData.get("gymId") ?? undefined
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please choose a valid user and role.",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  if (parsed.data.roleName === "super_admin" || parsed.data.roleName === "organization_owner") {
    return { status: "error", message: "Use the Super Admin portal to assign platform or organization owner roles." };
  }

  const adminClient = getSupabaseAdminClient();

  if (!adminClient) {
    return { status: "error", message: "Supabase service credentials are not configured." };
  }

  if (parsed.data.gymId && parsed.data.gymId !== actor.gymId) {
    return { status: "error", message: "Gym Admins can only assign roles inside their own gym." };
  }

  const { data: role, error: roleError } = await adminClient
    .from("roles")
    .select("id")
    .eq("name", parsed.data.roleName)
    .maybeSingle();

  if (roleError || !role) {
    return { status: "error", message: "Role does not exist." };
  }

  const gymId = actor.gymId;
  const { error } = await adminClient.from("user_roles").insert({
    user_id: parsed.data.userId,
    role_id: role.id,
    gym_id: gymId,
    assigned_by: actor.userId
  });

  if (error && error.code !== "23505") {
    return { status: "error", message: "Role assignment failed." };
  }

  await writeAuditLog({
    actorId: actor.userId,
    gymId,
    action: "user.role_assigned",
    entityType: "auth_user",
    entityId: parsed.data.userId,
    metadata: { role: parsed.data.roleName }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/staff");
  return { status: "success", message: "Role assigned." };
}
