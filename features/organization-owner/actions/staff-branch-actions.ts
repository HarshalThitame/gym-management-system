"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import type { AuthActionState } from "@/features/auth/actions/action-state";

export type BranchAssignment = {
  id: string;
  user_id: string;
  branch_id: string;
  organization_id: string;
  role_name: string;
  branch_role: string;
  access_scope: string;
  status: string;
  created_at: string;
  updated_at: string;
  branch_name?: string | null;
  gym_name?: string | null;
};

export async function getStaffBranchAssignments(
  organizationId: string,
  userId: string
): Promise<BranchAssignment[]> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "multi_branch_staff_assignment", actionName: "staff_branch.read" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await (supabase as any)
    .from("branch_users")
    .select("*, branches:branch_id(name, gym_id, gyms:gym_id(name))")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((bu) => {
    const branch = bu.branches as { name?: string; gym_id?: string; gyms?: { name?: string } } | null;
    return {
      id: bu.id as string,
      user_id: bu.user_id as string,
      branch_id: bu.branch_id as string,
      organization_id: bu.organization_id as string,
      role_name: bu.role_name as string,
      branch_role: bu.branch_role as string,
      access_scope: bu.access_scope as string,
      status: bu.status as string,
      created_at: bu.created_at as string,
      updated_at: bu.updated_at as string,
      branch_name: branch?.name ?? null,
      gym_name: branch?.gyms?.name ?? null,
    } as BranchAssignment;
  });
}

export async function assignStaffToBranch(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/staff");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "multi_branch_staff_assignment", actionName: "staff_branch.assign" });

    const userId = formData.get("userId") as string;
    const branchId = formData.get("branchId") as string;
    const roleName = formData.get("roleName") as string;

    if (!userId || !branchId || !roleName) {
      return { ...prevState, status: "error", message: "User, branch, and role are required." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: branch } = await supabase.from("branches").select("id, organization_id").eq("id", branchId).single();
    if (!branch || branch.organization_id !== ctx.organizationId) {
      return { ...prevState, status: "error", message: "Branch not found in your organization." };
    }

    const { data: existing } = await supabase.from("branch_users")
      .select("id")
      .eq("user_id", userId)
      .eq("branch_id", branchId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (existing) {
      return { ...prevState, status: "error", message: "Staff is already assigned to this branch." };
    }

    const { error } = await supabase.from("branch_users").insert({
      organization_id: ctx.organizationId,
      branch_id: branchId,
      user_id: userId,
      role_name: roleName as never,
      branch_role: "staff",
      access_scope: formData.get("accessScope") as string || "single_branch",
      status: "active",
    } as never);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.assign_staff_to_branch",
      entityType: "branch_users",
      entityId: null,
      metadata: { userId, branchId, roleName } as never,
    });

    revalidateOrgModules(["/organization/staff"]);
    return { ...prevState, status: "success", message: "Staff assigned to branch." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to assign staff to branch.");
  }
}

export async function removeStaffFromBranch(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/staff");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "multi_branch_staff_assignment", actionName: "staff_branch.remove" });

    const assignmentId = formData.get("assignmentId") as string;
    const userId = formData.get("userId") as string;

    if (!assignmentId || !userId) {
      return { ...prevState, status: "error", message: "Assignment ID and user ID are required." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: assignments } = await supabase.from("branch_users")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", ctx.organizationId)
      .neq("status", "revoked");

    if (!assignments || assignments.length <= 1) {
      return { ...prevState, status: "error", message: "Cannot remove the last branch assignment for this staff member." };
    }

    const { error } = await supabase.from("branch_users")
      .update({ status: "revoked" } as never)
      .eq("id", assignmentId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.remove_staff_from_branch",
      entityType: "branch_users",
      entityId: assignmentId,
      metadata: { userId } as never,
    });

    revalidateOrgModules(["/organization/staff"]);
    return { ...prevState, status: "success", message: "Staff removed from branch." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to remove staff from branch.");
  }
}
