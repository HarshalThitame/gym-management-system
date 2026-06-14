"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";

export async function inviteStaffAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/staff");
    const supabase = await createSupabaseServerClient();
    const email = formData.get("email") as string;
    const fullName = formData.get("fullName") as string;
    const roleName = formData.get("roleName") as string;
    const gymId = formData.get("gymId") as string;
    if (!email || !fullName || !roleName || !gymId) return { ...prevState, status: "error", message: "Email, name, role, and gym are required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) throw new Error("Server configuration error.");

    const { data: existingProfile } = await supabase.from("profiles").select("id, gym_id").eq("email", email).maybeSingle();
    let profileId: string;

    if (existingProfile) {
      profileId = existingProfile.id;
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", profileId);
    } else {
      const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
      if (createUserError) throw new Error(createUserError.message);
      profileId = newUser.user.id;
      const { error: profileError } = await supabase.from("profiles").insert({ id: profileId, email, full_name: fullName } as never);
      if (profileError) throw new Error(profileError.message);
    }

    // Look up role_id from roles table
    const { data: role } = await supabase.from("roles").select("id").eq("name", roleName as never).single();
    if (!role) throw new Error(`Role "${roleName}" not found.`);

    const { error: roleError } = await supabase.from("user_roles").insert({ user_id: profileId, role_id: role.id, gym_id: gymId } as never);
    if (roleError) throw new Error(roleError.message);

    const branchId = formData.get("branchId") as string | null;
    if (branchId) {
      const { error: branchUserError } = await supabase.from("branch_users").insert({
        organization_id: ctx.organizationId, branch_id: branchId, user_id: profileId,
        role_name: roleName as never, access_scope: (formData.get("accessScope") as string) || "single_branch",
        branch_role: "staff", status: "active"
      } as never);
      if (branchUserError) throw new Error(branchUserError.message);
    }

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.invite_staff", entityType: "profile", entityId: profileId, metadata: { role: roleName, gymId } as never });
    revalidateOrgModules(["/organization/staff"]);
    return { ...prevState, status: "success", message: "Staff invited." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to invite staff." };
  }
}

export async function deactivateStaffAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/staff");
    const userId = formData.get("userId") as string;
    if (!userId) return { ...prevState, status: "error", message: "User ID is required." };

    const supabase = await createSupabaseServerClient();
    // Soft-delete by setting user_roles.gym_id = null and branch_users.status = 'revoked'
    const { error: roleError } = await supabase.from("user_roles").update({ gym_id: null } as never).eq("user_id", userId);
    if (roleError) throw new Error(roleError.message);

    const { error: branchError } = await supabase.from("branch_users").update({ status: "revoked" } as never).eq("user_id", userId).eq("organization_id", ctx.organizationId);
    if (branchError) throw new Error(branchError.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.deactivate_staff", entityType: "profile", entityId: userId });
    revalidateOrgModules(["/organization/staff"]);
    return { ...prevState, status: "success", message: "Staff deactivated." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to deactivate staff." };
  }
}
