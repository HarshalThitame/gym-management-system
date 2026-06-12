"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isWithinBranchLimit } from "@/lib/tenant";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import { branchStatuses, gymStatuses } from "@/types/enterprise";
import { slugifyEnterpriseName } from "@/features/enterprise/lib/business-rules";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import {
  branchCapacityHoursSchema,
  branchMoveSchema,
  gymAdminTransferSchema,
  gymMoveSchema,
  locationLifecycleSchema,
  reviewGymBranchApprovalSchema,
  superAdminBranchSchema,
  superAdminGymSchema
} from "../schemas/gym-branch-schemas";

const superAdminRoles = ["super_admin"] as const;
const operatingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";

type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchUserInsert = Database["public"]["Tables"]["branch_users"]["Insert"];
type UserRoleInsert = Database["public"]["Tables"]["user_roles"]["Insert"];
type GymBranchApprovalAction = "transfer_gym_admin" | "gym_lifecycle" | "branch_lifecycle" | "move_gym" | "move_branch" | "bulk_lifecycle";
type GymBranchApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";
type GymBranchApprovalRequestRow = {
  id: string;
  organization_id: string;
  gym_id: string | null;
  branch_id: string | null;
  action: GymBranchApprovalAction;
  status: GymBranchApprovalStatus;
  requested_by: string | null;
  reviewed_by: string | null;
  target_user_id: string | null;
  payload: Json;
  before_snapshot: Json;
  after_snapshot: Json;
  reason: string | null;
  review_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};
type GymBranchApprovalInsert = Pick<
  GymBranchApprovalRequestRow,
  "organization_id" | "gym_id" | "branch_id" | "action" | "requested_by" | "target_user_id" | "payload" | "before_snapshot" | "after_snapshot" | "reason" | "expires_at"
>;
type GymBranchApprovalUpdate = Partial<Pick<GymBranchApprovalRequestRow, "status" | "reviewed_by" | "review_note" | "reviewed_at">>;
type GymBranchApprovalFilterQuery = {
  eq(column: "id" | "organization_id" | "gym_id" | "branch_id" | "action" | "status", value: string): GymBranchApprovalFilterQuery;
  maybeSingle(): Promise<{ data: GymBranchApprovalRequestRow | null; error: { code?: string; message: string } | null }>;
};
type GymBranchApprovalReturningQuery = {
  select(columns: "id"): { maybeSingle(): Promise<{ data: { id: string } | null; error: { code?: string; message: string } | null }> };
};
type GymBranchApprovalUpdateQuery = {
  eq(column: "id", value: string): {
    select(columns: "id"): { maybeSingle(): Promise<{ data: { id: string } | null; error: { code?: string; message: string } | null }> };
  };
};
type GymBranchApprovalClient = SupabaseClient<Database> & {
  from(table: "gym_branch_approval_requests"): {
    select(columns: "*"): GymBranchApprovalFilterQuery;
    insert(payload: GymBranchApprovalInsert): GymBranchApprovalReturningQuery;
    update(payload: GymBranchApprovalUpdate): GymBranchApprovalUpdateQuery;
  };
};
type BranchScopeRemediationClient = SupabaseClient<Database> & {
  rpc(
    functionName: "apply_branch_scope_remediation",
    args: { p_branch_id: string; p_actor_id: string | null }
  ): Promise<{ data: Json | null; error: { message: string } | null }>;
};

export async function saveSuperAdminGymAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = superAdminGymSchema.safeParse({
    gymId: formData.get("gymId") ?? "",
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    timezone: formData.get("timezone") ?? "Asia/Kolkata",
    currency: formData.get("currency") ?? "INR",
    status: formData.get("status") ?? "active",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const existing = parsed.data.gymId ? await getGym(supabase, parsed.data.gymId) : null;
  if (existing && existing.organization_id !== parsed.data.organizationId) {
    return fieldError("organizationId", "Use the guarded move workflow to transfer a gym across organizations.");
  }

  if (!existing) {
    const limitError = await requireLocationCapacity(supabase, parsed.data.organizationId);
    if (limitError) {
      return limitError;
    }
  }

  const slug = parsed.data.slug || slugifyEnterpriseName(parsed.data.name);
  const duplicate = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", parsed.data.organizationId)
    .eq("slug", slug)
    .neq("id", parsed.data.gymId || "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  if (duplicate.error) {
    return { status: "error", message: duplicate.error.message };
  }

  if (duplicate.data) {
    return fieldError("slug", "This gym slug already exists inside the selected organization.");
  }

  const payload = {
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    slug,
    timezone: parsed.data.timezone,
    currency: parsed.data.currency.toUpperCase(),
    status: parsed.data.status
  };
  const result = existing
    ? await supabase.from("gyms").update(payload).eq("id", existing.id).select("*").maybeSingle()
    : await supabase.from("gyms").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Gym save failed." };
  }

  await writeGymBranchAudit(context, existing ? "gym.updated" : "gym.created", "gym", result.data.id, {
    organizationId: parsed.data.organizationId,
    reason: parsed.data.reason || null,
    status: parsed.data.status
  });
  revalidateGymBranchPaths();
  return { status: "success", message: existing ? "Gym updated." : "Gym created." };
}

export async function saveSuperAdminBranchAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = superAdminBranchSchema.safeParse({
    branchId: formData.get("branchId") ?? "",
    organizationId: formData.get("organizationId"),
    gymId: formData.get("gymId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    branchCode: formData.get("branchCode"),
    status: formData.get("status") ?? "planned",
    timezone: formData.get("timezone") ?? "Asia/Kolkata",
    currency: formData.get("currency") ?? "INR",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    country: formData.get("country") ?? "India",
    postalCode: formData.get("postalCode") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    capacity: formData.get("capacity") ?? "0",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const existing = parsed.data.branchId ? await getBranch(supabase, parsed.data.branchId) : null;
  if (existing && existing.organization_id !== parsed.data.organizationId) {
    return fieldError("organizationId", "Use the guarded branch move workflow for cross-organization changes.");
  }

  if (existing && (existing.gym_id ?? "") !== (parsed.data.gymId ?? "")) {
    return fieldError("gymId", "Use the guarded branch move workflow to change a branch's parent gym.");
  }

  const gym = parsed.data.gymId ? await getGym(supabase, parsed.data.gymId) : null;
  if (gym && gym.organization_id !== parsed.data.organizationId) {
    return fieldError("gymId", "Selected gym belongs to a different organization.");
  }

  if (!existing) {
    const limitError = await requireLocationCapacity(supabase, parsed.data.organizationId);
    if (limitError) {
      return limitError;
    }
  }

  const slug = parsed.data.slug || slugifyEnterpriseName(parsed.data.name);
  const duplicate = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", parsed.data.organizationId)
    .or(`slug.eq.${slug},branch_code.eq.${parsed.data.branchCode.toUpperCase()}`)
    .neq("id", parsed.data.branchId || "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  if (duplicate.error) {
    return { status: "error", message: duplicate.error.message };
  }

  if (duplicate.data) {
    return fieldError("branchCode", "Branch slug or code already exists inside this organization.");
  }

  const operatingHours = parseOperatingHours(formData);
  const payload = {
    organization_id: parsed.data.organizationId,
    gym_id: parsed.data.gymId || null,
    name: parsed.data.name,
    slug,
    branch_code: parsed.data.branchCode.toUpperCase(),
    status: parsed.data.status,
    timezone: parsed.data.timezone,
    currency: parsed.data.currency.toUpperCase(),
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country,
    postal_code: parsed.data.postalCode || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    capacity: parsed.data.capacity,
    operating_hours: operatingHours,
    created_by: context.userId
  };
  const result = existing
    ? await supabase.from("branches").update(payload).eq("id", existing.id).select("*").maybeSingle()
    : await supabase.from("branches").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch save failed." };
  }

  await writeGymBranchAudit(context, existing ? "branch.updated" : "branch.created", "branch", result.data.id, {
    organizationId: parsed.data.organizationId,
    gymId: parsed.data.gymId || null,
    reason: parsed.data.reason || null,
    status: parsed.data.status
  });
  revalidateGymBranchPaths();
  return { status: "success", message: existing ? "Branch updated." : "Branch created." };
}

export async function transferGymAdminAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = gymAdminTransferSchema.safeParse({
    gymId: formData.get("gymId"),
    newAdminUserId: formData.get("newAdminUserId"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "TRANSFER_ADMIN") {
    return fieldError("confirmation", "Type TRANSFER_ADMIN to confirm this gym admin transfer.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const gym = await getGym(supabase, parsed.data.gymId);
  if (!gym || !gym.organization_id) {
    return { status: "error", message: "Gym was not found or is not linked to an organization." };
  }

  const { data: branches, error: branchesError } = await supabase
    .from("branches")
    .select("*")
    .eq("gym_id", gym.id)
    .neq("status", "archived");

  if (branchesError) {
    return { status: "error", message: branchesError.message };
  }

  if (!branches || branches.length === 0) {
    return { status: "error", message: "Create at least one branch under this gym before assigning a gym admin." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .eq("id", parsed.data.newAdminUserId)
    .maybeSingle();

  if (profileError) {
    return { status: "error", message: profileError.message };
  }

  if (!profile || profile.status === "archived" || profile.status === "suspended") {
    return fieldError("newAdminUserId", "Select an active or invited user as gym admin.");
  }

  const branchIds = branches.map((branch) => branch.id);
  const previousAdminUserIds = unique((await getActiveGymAdminAssignments(supabase, branchIds)).map((assignment) => assignment.user_id));
  const approval = await createGymBranchApprovalRequest(supabase, context, {
    organizationId: gym.organization_id,
    gymId: gym.id,
    branchId: null,
    action: "transfer_gym_admin",
    targetUserId: parsed.data.newAdminUserId,
    payload: {
      gymId: gym.id,
      branchIds,
      newAdminUserId: parsed.data.newAdminUserId,
      previousAdminUserIds
    },
    beforeSnapshot: buildGymSnapshot(gym, { previousAdminUserIds, branchIds }),
    afterSnapshot: buildGymSnapshot(gym, { newAdminUserId: parsed.data.newAdminUserId, branchIds }),
    reason: parsed.data.reason
  });
  if (approval.status === "error") {
    return approval;
  }

  await writeGymBranchAudit(context, "gym.admin_transfer_requested", "gym", gym.id, {
    organizationId: gym.organization_id,
    branchIds,
    newAdminUserId: parsed.data.newAdminUserId,
    newAdminEmail: profile.email,
    reason: parsed.data.reason,
    approvalId: approval.approvalId,
    stepUp: criticalAccess.mfa
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Gym admin transfer approval requested. A different Super Admin must approve it before access changes." };
}

export async function updateLocationLifecycleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = locationLifecycleSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    nextStatus: formData.get("nextStatus"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const expectedConfirmation = `${parsed.data.entityType.toUpperCase()}:${parsed.data.nextStatus.toUpperCase()}`;
  if (parsed.data.confirmation !== expectedConfirmation) {
    return fieldError("confirmation", `Type ${expectedConfirmation} to confirm this lifecycle change.`);
  }

  const supabase = await createSupabaseServerClient();
  const requiresStepUp = ["suspended", "deactivated", "archived"].includes(parsed.data.nextStatus);
  const criticalAccess = requiresStepUp ? await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail ?? "") : null;
  if (criticalAccess && !criticalAccess.ok) {
    return criticalAccess.state;
  }

  if (parsed.data.entityType === "gym") {
    if (!gymStatuses.includes(parsed.data.nextStatus as (typeof gymStatuses)[number])) {
      return fieldError("nextStatus", "Unsupported gym status.");
    }
    const gym = await getGym(supabase, parsed.data.entityId);
    if (!gym) {
      return { status: "error", message: "Gym was not found." };
    }
    const blockers = parsed.data.nextStatus === "archived" ? await getGymArchiveBlockers(supabase, gym.id) : [];
    if (blockers.length > 0) {
      return { status: "error", message: `Gym archive blocked: ${blockers.join(" ")}` };
    }
    if (requiresStepUp) {
      const approval = await createGymBranchApprovalRequest(supabase, context, {
        organizationId: gym.organization_id,
        gymId: gym.id,
        branchId: null,
        action: "gym_lifecycle",
        targetUserId: null,
        payload: {
          entityType: "gym",
          entityId: gym.id,
          nextStatus: parsed.data.nextStatus
        },
        beforeSnapshot: buildGymSnapshot(gym),
        afterSnapshot: buildGymSnapshot({ ...gym, status: parsed.data.nextStatus as GymRow["status"] }),
        reason: parsed.data.reason
      });
      if (approval.status === "error") {
        return approval;
      }
      await writeGymBranchAudit(context, "gym.lifecycle_requested", "gym", gym.id, { previousStatus: gym.status, nextStatus: parsed.data.nextStatus, reason: parsed.data.reason, approvalId: approval.approvalId, stepUp: criticalAccess?.mfa ?? null });
      revalidateGymBranchPaths();
      return { status: "success", message: "Gym lifecycle approval requested. A different Super Admin must approve it before the status changes." };
    }
    const result = await supabase.from("gyms").update({ status: parsed.data.nextStatus as GymRow["status"] }).eq("id", gym.id).select("*").maybeSingle();
    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Gym lifecycle update failed." };
    }
    await writeGymBranchAudit(context, "gym.lifecycle_updated", "gym", gym.id, { previousStatus: gym.status, nextStatus: parsed.data.nextStatus, reason: parsed.data.reason, stepUp: criticalAccess?.mfa ?? null });
  } else {
    if (!branchStatuses.includes(parsed.data.nextStatus as (typeof branchStatuses)[number])) {
      return fieldError("nextStatus", "Unsupported branch status.");
    }
    const branch = await getBranch(supabase, parsed.data.entityId);
    if (!branch) {
      return { status: "error", message: "Branch was not found." };
    }
    const blockers = parsed.data.nextStatus === "archived" ? await getBranchArchiveBlockers(supabase, branch.id) : [];
    if (blockers.length > 0) {
      return { status: "error", message: `Branch archive blocked: ${blockers.join(" ")}` };
    }
    if (requiresStepUp) {
      const approval = await createGymBranchApprovalRequest(supabase, context, {
        organizationId: branch.organization_id,
        gymId: branch.gym_id,
        branchId: branch.id,
        action: "branch_lifecycle",
        targetUserId: null,
        payload: {
          entityType: "branch",
          entityId: branch.id,
          nextStatus: parsed.data.nextStatus
        },
        beforeSnapshot: buildBranchSnapshot(branch),
        afterSnapshot: buildBranchSnapshot({ ...branch, status: parsed.data.nextStatus as BranchRow["status"] }),
        reason: parsed.data.reason
      });
      if (approval.status === "error") {
        return approval;
      }
      await writeGymBranchAudit(context, "branch.lifecycle_requested", "branch", branch.id, { previousStatus: branch.status, nextStatus: parsed.data.nextStatus, reason: parsed.data.reason, approvalId: approval.approvalId, stepUp: criticalAccess?.mfa ?? null });
      revalidateGymBranchPaths();
      return { status: "success", message: "Branch lifecycle approval requested. A different Super Admin must approve it before the status changes." };
    }
    const result = await supabase.from("branches").update({ status: parsed.data.nextStatus as BranchRow["status"] }).eq("id", branch.id).select("*").maybeSingle();
    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Branch lifecycle update failed." };
    }
    await writeGymBranchAudit(context, "branch.lifecycle_updated", "branch", branch.id, { previousStatus: branch.status, nextStatus: parsed.data.nextStatus, reason: parsed.data.reason, stepUp: criticalAccess?.mfa ?? null });
  }

  revalidateGymBranchPaths();
  return { status: "success", message: "Lifecycle status updated." };
}

export async function updateBranchCapacityHoursAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = branchCapacityHoursSchema.safeParse({
    branchId: formData.get("branchId"),
    capacity: formData.get("capacity"),
    timezone: formData.get("timezone") ?? "Asia/Kolkata",
    currency: formData.get("currency") ?? "INR",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const branch = await getBranch(supabase, parsed.data.branchId);
  if (!branch) {
    return { status: "error", message: "Branch was not found." };
  }

  if (branch.status === "active" && parsed.data.capacity === 0) {
    return fieldError("capacity", "Active branches must have a capacity greater than zero.");
  }

  const operatingHours = parseOperatingHours(formData);
  const result = await supabase
    .from("branches")
    .update({
      capacity: parsed.data.capacity,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency.toUpperCase(),
      operating_hours: operatingHours
    })
    .eq("id", branch.id)
    .select("*")
    .maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch capacity update failed." };
  }

  await writeGymBranchAudit(context, "branch.capacity_hours_updated", "branch", branch.id, {
    previousCapacity: branch.capacity,
    nextCapacity: parsed.data.capacity,
    reason: parsed.data.reason
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Branch capacity and operating hours updated." };
}

export async function moveGymToOrganizationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = gymMoveSchema.safeParse({
    gymId: formData.get("gymId"),
    targetOrganizationId: formData.get("targetOrganizationId"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "MOVE_GYM") {
    return fieldError("confirmation", "Type MOVE_GYM to confirm cross-organization transfer.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const gym = await getGym(supabase, parsed.data.gymId);
  if (!gym) {
    return { status: "error", message: "Gym was not found." };
  }

  if (gym.organization_id === parsed.data.targetOrganizationId) {
    return { status: "success", message: "Gym already belongs to the selected organization." };
  }

  const blockers = await getGymMoveBlockers(supabase, gym.id);
  if (blockers.length > 0) {
    return { status: "error", message: `Cross-org gym move blocked: ${blockers.join(" ")}` };
  }

  if (!gym.organization_id) {
    return { status: "error", message: "Gym is not linked to an organization." };
  }

  const approval = await createGymBranchApprovalRequest(supabase, context, {
    organizationId: gym.organization_id,
    gymId: gym.id,
    branchId: null,
    action: "move_gym",
    targetUserId: null,
    payload: {
      gymId: gym.id,
      previousOrganizationId: gym.organization_id,
      targetOrganizationId: parsed.data.targetOrganizationId
    },
    beforeSnapshot: buildGymSnapshot(gym),
    afterSnapshot: buildGymSnapshot({ ...gym, organization_id: parsed.data.targetOrganizationId }),
    reason: parsed.data.reason
  });
  if (approval.status === "error") {
    return approval;
  }

  await writeGymBranchAudit(context, "gym.move_organization_requested", "gym", gym.id, {
    previousOrganizationId: gym.organization_id,
    targetOrganizationId: parsed.data.targetOrganizationId,
    reason: parsed.data.reason,
    approvalId: approval.approvalId,
    stepUp: criticalAccess.mfa
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Gym move approval requested. A different Super Admin must approve it before the hierarchy changes." };
}

export async function moveBranchToGymAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = branchMoveSchema.safeParse({
    branchId: formData.get("branchId"),
    targetGymId: formData.get("targetGymId") ?? "",
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "MOVE_BRANCH") {
    return fieldError("confirmation", "Type MOVE_BRANCH to confirm this branch move.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const branch = await getBranch(supabase, parsed.data.branchId);
  if (!branch) {
    return { status: "error", message: "Branch was not found." };
  }

  const targetGym = parsed.data.targetGymId ? await getGym(supabase, parsed.data.targetGymId) : null;
  if (parsed.data.targetGymId && !targetGym) {
    return fieldError("targetGymId", "Target gym was not found.");
  }

  const targetOrganizationId = targetGym?.organization_id ?? branch.organization_id;
  if (targetOrganizationId !== branch.organization_id) {
    const blockers = await getBranchCrossOrgMoveBlockers(supabase, branch.id);
    if (blockers.length > 0) {
      return { status: "error", message: `Cross-org branch move blocked: ${blockers.join(" ")}` };
    }
  }

  const approval = await createGymBranchApprovalRequest(supabase, context, {
    organizationId: branch.organization_id,
    gymId: branch.gym_id,
    branchId: branch.id,
    action: "move_branch",
    targetUserId: null,
    payload: {
      branchId: branch.id,
      previousGymId: branch.gym_id,
      targetGymId: targetGym?.id ?? null,
      previousOrganizationId: branch.organization_id,
      targetOrganizationId
    },
    beforeSnapshot: buildBranchSnapshot(branch),
    afterSnapshot: buildBranchSnapshot({ ...branch, gym_id: targetGym?.id ?? null, organization_id: targetOrganizationId }),
    reason: parsed.data.reason
  });
  if (approval.status === "error") {
    return approval;
  }

  await writeGymBranchAudit(context, "branch.move_gym_requested", "branch", branch.id, {
    previousGymId: branch.gym_id,
    targetGymId: targetGym?.id ?? null,
    previousOrganizationId: branch.organization_id,
    targetOrganizationId,
    reason: parsed.data.reason,
    approvalId: approval.approvalId,
    stepUp: criticalAccess.mfa
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Branch move approval requested. A different Super Admin must approve it before the hierarchy changes." };
}

export async function reviewGymBranchApprovalAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = reviewGymBranchApprovalSchema.safeParse({
    approvalId: formData.get("approvalId"),
    decision: formData.get("decision"),
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reviewNote: formData.get("reviewNote") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const approval = await getGymBranchApprovalRequest(supabase, parsed.data.approvalId);
  if (!approval) {
    return { status: "error", message: "Approval request was not found." };
  }

  if (approval.status !== "pending") {
    return { status: "error", message: `This approval request is already ${approval.status}.` };
  }

  if (new Date(approval.expires_at).getTime() <= Date.now()) {
    const update = await updateGymBranchApprovalRequest(supabase, approval.id, {
      status: "expired",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_note: parsed.data.reviewNote || "Expired before review."
    });
    if (update.status === "error") {
      return update;
    }
    return { status: "error", message: "This approval request has expired. Create a fresh request." };
  }

  if (parsed.data.decision === "approve" && approval.requested_by === context.userId) {
    return { status: "error", message: "Maker-checker control blocked this approval. A different Super Admin must approve the request." };
  }

  if (parsed.data.decision === "reject") {
    const update = await updateGymBranchApprovalRequest(supabase, approval.id, {
      status: "rejected",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_note: parsed.data.reviewNote || null
    });
    if (update.status === "error") {
      return update;
    }
    await writeGymBranchAudit(context, "gym_branch.approval_rejected", approval.branch_id ? "branch" : "gym", approval.branch_id ?? approval.gym_id ?? approval.organization_id, {
      approvalId: approval.id,
      action: approval.action,
      requestedBy: approval.requested_by,
      reviewNote: parsed.data.reviewNote || null
    });
    revalidateGymBranchPaths();
    return { status: "success", message: "Approval request rejected." };
  }

  const applyResult = await applyApprovedGymBranchAction(supabase, context, approval, criticalAccess.mfa, parsed.data.reviewNote || null);
  if (applyResult.status === "error") {
    return applyResult;
  }

  const update = await updateGymBranchApprovalRequest(supabase, approval.id, {
    status: "approved",
    reviewed_by: context.userId,
    reviewed_at: new Date().toISOString(),
    review_note: parsed.data.reviewNote || null
  });
  if (update.status === "error") {
    return update;
  }

  revalidateGymBranchPaths();
  return applyResult;
}

export async function remediateBranchScopeAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const branchId = String(formData.get("branchId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!branchId) {
    return fieldError("branchId", "Branch is required.");
  }
  if (confirmation !== "REMEDIATE_BRANCH_SCOPE") {
    return fieldError("confirmation", "Type REMEDIATE_BRANCH_SCOPE to assign unresolved operational records to this branch.");
  }
  if (reason.length < 5) {
    return fieldError("reason", "Reason is required for audit.");
  }

  const supabase = await createSupabaseServerClient();
  const branch = await getBranch(supabase, branchId);
  if (!branch) {
    return { status: "error", message: "Branch was not found." };
  }

  const rpcClient = supabase as BranchScopeRemediationClient;
  const result = await rpcClient.rpc("apply_branch_scope_remediation", {
    p_branch_id: branchId,
    p_actor_id: context.userId
  });

  if (result.error) {
    return { status: "error", message: result.error.message };
  }

  await writeGymBranchAudit(context, "branch.scope_remediated", "branch", branchId, {
    reason,
    result: result.data ?? {}
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Unassigned operational records were remediated for this branch." };
}

async function createGymBranchApprovalRequest(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  input: {
    organizationId: string | null;
    gymId: string | null;
    branchId: string | null;
    action: GymBranchApprovalAction;
    targetUserId: string | null;
    payload: Record<string, Json | undefined>;
    beforeSnapshot: Record<string, Json | undefined>;
    afterSnapshot: Record<string, Json | undefined>;
    reason: string | null;
  }
): Promise<AuthActionState & { approvalId?: string }> {
  if (!input.organizationId) {
    return { status: "error", message: "An organization scope is required before requesting approval." };
  }

  const client = supabase as GymBranchApprovalClient;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await client
    .from("gym_branch_approval_requests")
    .insert({
      organization_id: input.organizationId,
      gym_id: input.gymId,
      branch_id: input.branchId,
      action: input.action,
      requested_by: context.userId,
      target_user_id: input.targetUserId,
      payload: input.payload as Json,
      before_snapshot: input.beforeSnapshot as Json,
      after_snapshot: input.afterSnapshot as Json,
      reason: input.reason,
      expires_at: expiresAt
    })
    .select("id")
    .maybeSingle();

  if (result.error || !result.data) {
    if (result.error?.code === "23505") {
      return { status: "error", message: "A pending approval already exists for this Gym/Branch action." };
    }
    return { status: "error", message: result.error?.message ?? "Approval request could not be created." };
  }

  return { status: "success", message: "Approval request created.", approvalId: result.data.id };
}

async function getGymBranchApprovalRequest(supabase: SupabaseClient<Database>, approvalId: string) {
  const client = supabase as GymBranchApprovalClient;
  const { data, error } = await client.from("gym_branch_approval_requests").select("*").eq("id", approvalId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function updateGymBranchApprovalRequest(
  supabase: SupabaseClient<Database>,
  approvalId: string,
  payload: GymBranchApprovalUpdate
): Promise<AuthActionState> {
  const client = supabase as GymBranchApprovalClient;
  const result = await client.from("gym_branch_approval_requests").update(payload).eq("id", approvalId).select("id").maybeSingle();
  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Approval request update failed." };
  }
  return { status: "success", message: "Approval request updated." };
}

async function applyApprovedGymBranchAction(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  approval: GymBranchApprovalRequestRow,
  mfa: { currentLevel: string | null; nextLevel: string | null },
  reviewNote: string | null
): Promise<AuthActionState> {
  const payload = jsonRecord(approval.payload);

  if (approval.action === "transfer_gym_admin") {
    const gymId = stringFromJson(payload.gymId);
    const newAdminUserId = stringFromJson(payload.newAdminUserId);
    if (!gymId || !newAdminUserId) {
      return { status: "error", message: "Approval payload is missing gym admin transfer details." };
    }
    return applyGymAdminTransfer(supabase, context, {
      approval,
      gymId,
      newAdminUserId,
      reason: approval.reason,
      mfa,
      reviewNote
    });
  }

  if (approval.action === "gym_lifecycle" || approval.action === "branch_lifecycle") {
    const entityType = approval.action === "gym_lifecycle" ? "gym" : "branch";
    const entityId = stringFromJson(payload.entityId);
    const nextStatus = stringFromJson(payload.nextStatus);
    if (!entityId || !nextStatus) {
      return { status: "error", message: "Approval payload is missing lifecycle details." };
    }
    return applyLocationLifecycle(supabase, context, {
      approval,
      entityType,
      entityId,
      nextStatus,
      reason: approval.reason,
      mfa,
      reviewNote
    });
  }

  if (approval.action === "move_gym") {
    const gymId = stringFromJson(payload.gymId);
    const targetOrganizationId = stringFromJson(payload.targetOrganizationId);
    if (!gymId || !targetOrganizationId) {
      return { status: "error", message: "Approval payload is missing gym move details." };
    }
    return applyGymMove(supabase, context, { approval, gymId, targetOrganizationId, reason: approval.reason, mfa, reviewNote });
  }

  if (approval.action === "move_branch") {
    const branchId = stringFromJson(payload.branchId);
    const targetGymId = nullableStringFromJson(payload.targetGymId);
    const targetOrganizationId = stringFromJson(payload.targetOrganizationId);
    if (!branchId || !targetOrganizationId) {
      return { status: "error", message: "Approval payload is missing branch move details." };
    }
    return applyBranchMove(supabase, context, { approval, branchId, targetGymId, targetOrganizationId, reason: approval.reason, mfa, reviewNote });
  }

  return { status: "error", message: "Unsupported Gym/Branch approval action." };
}

async function applyGymAdminTransfer(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  input: {
    approval: GymBranchApprovalRequestRow;
    gymId: string;
    newAdminUserId: string;
    reason: string | null;
    mfa: { currentLevel: string | null; nextLevel: string | null };
    reviewNote: string | null;
  }
): Promise<AuthActionState> {
  const gym = await getGym(supabase, input.gymId);
  if (!gym || !gym.organization_id) {
    return { status: "error", message: "Gym was not found or is not linked to an organization." };
  }

  const { data: branches, error: branchesError } = await supabase.from("branches").select("*").eq("gym_id", gym.id).neq("status", "archived");
  if (branchesError) {
    return { status: "error", message: branchesError.message };
  }
  if (!branches || branches.length === 0) {
    return { status: "error", message: "Create at least one branch under this gym before assigning a gym admin." };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, full_name, email, status").eq("id", input.newAdminUserId).maybeSingle();
  if (profileError) {
    return { status: "error", message: profileError.message };
  }
  if (!profile || profile.status === "archived" || profile.status === "suspended") {
    return { status: "error", message: "The requested gym admin is no longer active." };
  }

  const branchIds = branches.map((branch) => branch.id);
  const previousAdminUserIds = unique((await getActiveGymAdminAssignments(supabase, branchIds)).map((assignment) => assignment.user_id));
  const revokeResult = await supabase.from("branch_users").update({ status: "revoked" }).in("branch_id", branchIds).eq("role_name", "gym_admin").eq("status", "active");
  if (revokeResult.error) {
    return { status: "error", message: revokeResult.error.message };
  }

  const assignments: BranchUserInsert[] = branches.map((branch) => ({
    organization_id: gym.organization_id as string,
    branch_id: branch.id,
    user_id: input.newAdminUserId,
    role_name: "gym_admin",
    branch_role: "admin",
    access_scope: "multi_branch",
    status: "active",
    permissions: { scope: "gym", gymId: gym.id } satisfies Json,
    assigned_by: context.userId
  }));
  const upsertResult = await supabase.from("branch_users").upsert(assignments, { onConflict: "branch_id,user_id" });
  if (upsertResult.error) {
    return { status: "error", message: upsertResult.error.message };
  }

  const roleSync = await syncGymAdminUserRoles(supabase, {
    gymId: gym.id,
    newAdminUserId: input.newAdminUserId,
    previousAdminUserIds,
    assignedBy: context.userId
  });
  if (roleSync) {
    return roleSync;
  }

  await writeGymBranchAudit(context, "gym.admin_transferred", "gym", gym.id, {
    approvalId: input.approval.id,
    requestedBy: input.approval.requested_by,
    organizationId: gym.organization_id,
    branchIds,
    previousAdminUserIds,
    newAdminUserId: input.newAdminUserId,
    newAdminEmail: profile.email,
    reason: input.reason,
    reviewNote: input.reviewNote,
    stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: input.mfa.currentLevel, mfaNextLevel: input.mfa.nextLevel }
  });
  return { status: "success", message: "Gym admin transfer approved and applied." };
}

async function applyLocationLifecycle(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  input: {
    approval: GymBranchApprovalRequestRow;
    entityType: "gym" | "branch";
    entityId: string;
    nextStatus: string;
    reason: string | null;
    mfa: { currentLevel: string | null; nextLevel: string | null };
    reviewNote: string | null;
  }
): Promise<AuthActionState> {
  if (input.entityType === "gym") {
    if (!gymStatuses.includes(input.nextStatus as (typeof gymStatuses)[number])) {
      return fieldError("nextStatus", "Unsupported gym status.");
    }
    const gym = await getGym(supabase, input.entityId);
    if (!gym) {
      return { status: "error", message: "Gym was not found." };
    }
    const blockers = input.nextStatus === "archived" ? await getGymArchiveBlockers(supabase, gym.id) : [];
    if (blockers.length > 0) {
      return { status: "error", message: `Gym archive blocked: ${blockers.join(" ")}` };
    }
    const result = await supabase.from("gyms").update({ status: input.nextStatus as GymRow["status"] }).eq("id", gym.id).select("*").maybeSingle();
    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Gym lifecycle update failed." };
    }
    await writeGymBranchAudit(context, "gym.lifecycle_updated", "gym", gym.id, {
      approvalId: input.approval.id,
      requestedBy: input.approval.requested_by,
      previousStatus: gym.status,
      nextStatus: input.nextStatus,
      reason: input.reason,
      reviewNote: input.reviewNote,
      stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: input.mfa.currentLevel, mfaNextLevel: input.mfa.nextLevel }
    });
    return { status: "success", message: "Gym lifecycle approval applied." };
  }

  if (!branchStatuses.includes(input.nextStatus as (typeof branchStatuses)[number])) {
    return fieldError("nextStatus", "Unsupported branch status.");
  }
  const branch = await getBranch(supabase, input.entityId);
  if (!branch) {
    return { status: "error", message: "Branch was not found." };
  }
  const blockers = input.nextStatus === "archived" ? await getBranchArchiveBlockers(supabase, branch.id) : [];
  if (blockers.length > 0) {
    return { status: "error", message: `Branch archive blocked: ${blockers.join(" ")}` };
  }
  const result = await supabase.from("branches").update({ status: input.nextStatus as BranchRow["status"] }).eq("id", branch.id).select("*").maybeSingle();
  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch lifecycle update failed." };
  }
  await writeGymBranchAudit(context, "branch.lifecycle_updated", "branch", branch.id, {
    approvalId: input.approval.id,
    requestedBy: input.approval.requested_by,
    previousStatus: branch.status,
    nextStatus: input.nextStatus,
    reason: input.reason,
    reviewNote: input.reviewNote,
    stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: input.mfa.currentLevel, mfaNextLevel: input.mfa.nextLevel }
  });
  return { status: "success", message: "Branch lifecycle approval applied." };
}

async function applyGymMove(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  input: {
    approval: GymBranchApprovalRequestRow;
    gymId: string;
    targetOrganizationId: string;
    reason: string | null;
    mfa: { currentLevel: string | null; nextLevel: string | null };
    reviewNote: string | null;
  }
): Promise<AuthActionState> {
  const gym = await getGym(supabase, input.gymId);
  if (!gym) {
    return { status: "error", message: "Gym was not found." };
  }
  if (gym.organization_id === input.targetOrganizationId) {
    return { status: "success", message: "Gym already belongs to the selected organization." };
  }
  const blockers = await getGymMoveBlockers(supabase, gym.id);
  if (blockers.length > 0) {
    return { status: "error", message: `Cross-org gym move blocked: ${blockers.join(" ")}` };
  }
  const result = await supabase.from("gyms").update({ organization_id: input.targetOrganizationId }).eq("id", gym.id).select("*").maybeSingle();
  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Gym move failed." };
  }
  await writeGymBranchAudit(context, "gym.moved_organization", "gym", gym.id, {
    approvalId: input.approval.id,
    requestedBy: input.approval.requested_by,
    previousOrganizationId: gym.organization_id,
    targetOrganizationId: input.targetOrganizationId,
    reason: input.reason,
    reviewNote: input.reviewNote,
    stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: input.mfa.currentLevel, mfaNextLevel: input.mfa.nextLevel }
  });
  return { status: "success", message: "Gym move approval applied." };
}

async function applyBranchMove(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  input: {
    approval: GymBranchApprovalRequestRow;
    branchId: string;
    targetGymId: string | null;
    targetOrganizationId: string;
    reason: string | null;
    mfa: { currentLevel: string | null; nextLevel: string | null };
    reviewNote: string | null;
  }
): Promise<AuthActionState> {
  const branch = await getBranch(supabase, input.branchId);
  if (!branch) {
    return { status: "error", message: "Branch was not found." };
  }
  const targetGym = input.targetGymId ? await getGym(supabase, input.targetGymId) : null;
  if (input.targetGymId && !targetGym) {
    return { status: "error", message: "Target gym was not found." };
  }
  const targetOrganizationId = targetGym?.organization_id ?? input.targetOrganizationId;
  if (targetOrganizationId !== branch.organization_id) {
    const blockers = await getBranchCrossOrgMoveBlockers(supabase, branch.id);
    if (blockers.length > 0) {
      return { status: "error", message: `Cross-org branch move blocked: ${blockers.join(" ")}` };
    }
  }
  const result = await supabase.from("branches").update({ gym_id: targetGym?.id ?? null, organization_id: targetOrganizationId }).eq("id", branch.id).select("*").maybeSingle();
  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch move failed." };
  }
  await writeGymBranchAudit(context, "branch.moved_gym", "branch", branch.id, {
    approvalId: input.approval.id,
    requestedBy: input.approval.requested_by,
    previousGymId: branch.gym_id,
    targetGymId: targetGym?.id ?? null,
    previousOrganizationId: branch.organization_id,
    targetOrganizationId,
    reason: input.reason,
    reviewNote: input.reviewNote,
    stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: input.mfa.currentLevel, mfaNextLevel: input.mfa.nextLevel }
  });
  return { status: "success", message: "Branch move approval applied." };
}

function buildGymSnapshot(gym: GymRow, extra: Record<string, Json | undefined> = {}) {
  return {
    id: gym.id,
    organizationId: gym.organization_id,
    name: gym.name,
    slug: gym.slug,
    status: gym.status,
    timezone: gym.timezone,
    currency: gym.currency,
    ...extra
  };
}

function buildBranchSnapshot(branch: BranchRow, extra: Record<string, Json | undefined> = {}) {
  return {
    id: branch.id,
    organizationId: branch.organization_id,
    gymId: branch.gym_id,
    name: branch.name,
    slug: branch.slug,
    branchCode: branch.branch_code,
    status: branch.status,
    capacity: branch.capacity,
    timezone: branch.timezone,
    currency: branch.currency,
    ...extra
  };
}

function jsonRecord(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Json | undefined>;
}

function stringFromJson(value: Json | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableStringFromJson(value: Json | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function getGym(supabase: SupabaseClient<Database>, gymId: string): Promise<GymRow | null> {
  const { data, error } = await supabase.from("gyms").select("*").eq("id", gymId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function getBranch(supabase: SupabaseClient<Database>, branchId: string): Promise<BranchRow | null> {
  const { data, error } = await supabase.from("branches").select("*").eq("id", branchId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function requireLocationCapacity(supabase: SupabaseClient<Database>, organizationId: string): Promise<AuthActionState | null> {
  const { count, error } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "archived");

  if (error) {
    return { status: "error", message: error.message };
  }

  const withinLimit = await isWithinBranchLimit(organizationId, count ?? 0);
  return withinLimit ? null : { status: "error", message: "Branch limit reached for your current plan. Please upgrade to add more locations." };
}

async function getGymMoveBlockers(supabase: SupabaseClient<Database>, gymId: string) {
  const [branches, members, payments, domains] = await Promise.all([
    countRows(supabase, "branches", "gym_id", gymId),
    countRows(supabase, "members", "gym_id", gymId),
    countRows(supabase, "payments", "gym_id", gymId),
    countRows(supabase, "tenant_domains", "gym_id", gymId)
  ]);
  return [
    branches > 0 ? `${branches} branch record(s) remain.` : null,
    members > 0 ? `${members} member record(s) remain.` : null,
    payments > 0 ? `${payments} payment record(s) remain.` : null,
    domains > 0 ? `${domains} domain route(s) remain.` : null
  ].filter((blocker): blocker is string => Boolean(blocker));
}

async function getGymArchiveBlockers(supabase: SupabaseClient<Database>, gymId: string) {
  const [activeBranches, activeMembers, paidPayments, activeSessions] = await Promise.all([
    countRowsWithStatus(supabase, "branches", "gym_id", gymId, ["active", "planned", "maintenance", "suspended"]),
    countRowsWithStatus(supabase, "members", "gym_id", gymId, ["active"]),
    countRowsWithStatus(supabase, "payments", "gym_id", gymId, ["paid", "processing", "pending", "partially_refunded"]),
    countRowsWithStatus(supabase, "attendance_sessions", "gym_id", gymId, ["inside"])
  ]);
  return [
    activeBranches > 0 ? `${activeBranches} non-archived branch record(s) remain.` : null,
    activeMembers > 0 ? `${activeMembers} active member(s) remain.` : null,
    paidPayments > 0 ? `${paidPayments} payment record(s) require retention/reconciliation.` : null,
    activeSessions > 0 ? `${activeSessions} active attendance session(s) remain.` : null
  ].filter((blocker): blocker is string => Boolean(blocker));
}

async function getBranchArchiveBlockers(supabase: SupabaseClient<Database>, branchId: string) {
  const [activeAdmins, activeDomains, activeMembers, paidPayments, activeSessions] = await Promise.all([
    countRowsWithStatus(supabase, "branch_users", "branch_id", branchId, ["active", "invited"]),
    countRowsWithStatus(supabase, "tenant_domains", "branch_id", branchId, ["pending", "verified", "failed"]),
    countRowsWithStatus(supabase, "members", "branch_id", branchId, ["active"]),
    countRowsWithStatus(supabase, "payments", "branch_id", branchId, ["paid", "processing", "pending", "partially_refunded"]),
    countRowsWithStatus(supabase, "attendance_sessions", "branch_id", branchId, ["inside"])
  ]);
  return [
    activeAdmins > 0 ? `${activeAdmins} branch user assignment(s) remain.` : null,
    activeDomains > 0 ? `${activeDomains} active domain route(s) remain.` : null,
    activeMembers > 0 ? `${activeMembers} active member(s) remain.` : null,
    paidPayments > 0 ? `${paidPayments} payment record(s) require retention/reconciliation.` : null,
    activeSessions > 0 ? `${activeSessions} active attendance session(s) remain.` : null
  ].filter((blocker): blocker is string => Boolean(blocker));
}

async function getBranchCrossOrgMoveBlockers(supabase: SupabaseClient<Database>, branchId: string) {
  const [branchUsers, domains, settings, members, payments, attendanceSessions] = await Promise.all([
    countRows(supabase, "branch_users", "branch_id", branchId),
    countRows(supabase, "tenant_domains", "branch_id", branchId),
    countRows(supabase, "branch_settings", "branch_id", branchId),
    countRows(supabase, "members", "branch_id", branchId),
    countRows(supabase, "payments", "branch_id", branchId),
    countRows(supabase, "attendance_sessions", "branch_id", branchId)
  ]);
  return [
    branchUsers > 0 ? `${branchUsers} user assignment(s) remain.` : null,
    domains > 0 ? `${domains} domain route(s) remain.` : null,
    settings > 0 ? `${settings} settings record(s) remain.` : null,
    members > 0 ? `${members} member record(s) remain.` : null,
    payments > 0 ? `${payments} payment record(s) remain.` : null,
    attendanceSessions > 0 ? `${attendanceSessions} attendance session record(s) remain.` : null
  ].filter((blocker): blocker is string => Boolean(blocker));
}

async function getActiveGymAdminAssignments(supabase: SupabaseClient<Database>, branchIds: string[]) {
  if (branchIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("branch_users")
    .select("user_id")
    .in("branch_id", branchIds)
    .eq("role_name", "gym_admin")
    .eq("status", "active");
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function syncGymAdminUserRoles(
  supabase: SupabaseClient<Database>,
  input: {
    gymId: string;
    newAdminUserId: string;
    previousAdminUserIds: string[];
    assignedBy: string | null;
  }
): Promise<AuthActionState | null> {
  const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("name", "gym_admin").maybeSingle();
  if (roleError || !role) {
    return { status: "error", message: roleError?.message ?? "Gym Admin role is not configured." };
  }

  const oldAdminUserIds = input.previousAdminUserIds.filter((userId) => userId !== input.newAdminUserId);
  if (oldAdminUserIds.length > 0) {
    const deleteResult = await supabase
      .from("user_roles")
      .delete()
      .eq("role_id", role.id)
      .eq("gym_id", input.gymId)
      .in("user_id", oldAdminUserIds);
    if (deleteResult.error) {
      return { status: "error", message: deleteResult.error.message };
    }

    const profileClearResult = await supabase
      .from("profiles")
      .update({ gym_id: null })
      .eq("gym_id", input.gymId)
      .in("id", oldAdminUserIds);
    if (profileClearResult.error) {
      return { status: "error", message: profileClearResult.error.message };
    }
  }

  const userRole: UserRoleInsert = {
    user_id: input.newAdminUserId,
    role_id: role.id,
    gym_id: input.gymId,
    assigned_by: input.assignedBy
  };
  const upsertRole = await supabase.from("user_roles").upsert(userRole, { onConflict: "user_id,role_id,gym_id" });
  if (upsertRole.error) {
    return { status: "error", message: upsertRole.error.message };
  }

  const profileUpdate = await supabase.from("profiles").update({ gym_id: input.gymId }).eq("id", input.newAdminUserId);
  if (profileUpdate.error) {
    return { status: "error", message: profileUpdate.error.message };
  }

  return null;
}

async function countRows(
  supabase: SupabaseClient<Database>,
  table: "branches" | "members" | "payments" | "attendance_sessions" | "tenant_domains" | "branch_users" | "branch_settings",
  column: "gym_id" | "branch_id",
  value: string
) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).filter(column, "eq", value);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function countRowsWithStatus(
  supabase: SupabaseClient<Database>,
  table: "branches" | "members" | "payments" | "attendance_sessions" | "branch_users" | "tenant_domains",
  column: "gym_id" | "branch_id",
  value: string,
  statuses: readonly string[]
) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .filter(column, "eq", value)
    .filter("status", "in", `(${statuses.join(",")})`);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

function parseOperatingHours(formData: FormData): Json {
  const hours: Record<string, Json> = {};
  for (const day of operatingDays) {
    const closed = formData.get(`${day}Closed`) === "on";
    const opensAt = String(formData.get(`${day}Open`) ?? "06:00");
    const closesAt = String(formData.get(`${day}Close`) ?? "22:00");
    hours[day] = {
      closed,
      opensAt: closed ? null : opensAt,
      closesAt: closed ? null : closesAt
    };
  }
  return hours;
}

async function writeGymBranchAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action,
    entityType,
    entityId,
    metadata
  });
}

async function verifyCriticalSuperAdminAccess(
  context: AuthContext,
  supabase: SupabaseClient<Database>,
  value: string
): Promise<
  | { ok: true; mfa: { currentLevel: string | null; nextLevel: string | null } }
  | { ok: false; state: AuthActionState }
> {
  const email = context.email?.trim().toLowerCase() ?? null;
  const requiredEmail = getCriticalSuperAdminEmail();

  if (email !== requiredEmail) {
    return {
      ok: false,
      state: {
        status: "error",
        message: `Critical Super Admin actions must be performed from ${requiredEmail}. Sign in with that account and verify MFA before retrying.`
      }
    };
  }

  if (value.trim().toLowerCase() !== requiredEmail) {
    return {
      ok: false,
      state: fieldError("stepUpEmail", `Type ${requiredEmail} to pass the step-up identity check.`)
    };
  }

  const mfa = await getMfaAssuranceLevel(supabase);
  if (mfa.currentLevel !== "aal2") {
    return {
      ok: false,
      state: {
        status: "error",
        message: "MFA verification is required before running this critical Gym/Branch action. Open Super Admin MFA, verify a current authenticator code, then retry.",
        fieldErrors: {
          stepUpEmail: ["Verify MFA at /super-admin/security/mfa before submitting this action."]
        }
      }
    };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaFreshnessCookieName)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "MFA verification is stale. Open Super Admin MFA, verify a fresh authenticator code, then retry this critical Gym/Branch action.",
        fieldErrors: {
          stepUpEmail: ["Verify a fresh MFA challenge within the last 10 minutes."]
        }
      }
    };
  }

  return { ok: true, mfa };
}

async function getMfaAssuranceLevel(supabase: SupabaseClient<Database>) {
  try {
    const result = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return {
      currentLevel: result.data?.currentLevel ?? null,
      nextLevel: result.data?.nextLevel ?? null
    };
  } catch {
    return {
      currentLevel: null,
      nextLevel: null
    };
  }
}

function revalidateGymBranchPaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/gyms");
  revalidatePath("/super-admin/[module]", "page");
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value?.length)) as Record<string, string[]>
  };
}

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
