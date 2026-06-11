"use server";

import { revalidatePath } from "next/cache";
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
import {
  branchCapacityHoursSchema,
  branchMoveSchema,
  gymAdminTransferSchema,
  gymMoveSchema,
  locationLifecycleSchema,
  superAdminBranchSchema,
  superAdminGymSchema
} from "../schemas/gym-branch-schemas";

const superAdminRoles = ["super_admin"] as const;
const operatingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchUserInsert = Database["public"]["Tables"]["branch_users"]["Insert"];

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
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "TRANSFER_ADMIN") {
    return fieldError("confirmation", "Type TRANSFER_ADMIN to confirm this gym admin transfer.");
  }

  const supabase = await createSupabaseServerClient();
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
  const revokeResult = await supabase
    .from("branch_users")
    .update({ status: "revoked" })
    .in("branch_id", branchIds)
    .eq("role_name", "gym_admin")
    .eq("status", "active");

  if (revokeResult.error) {
    return { status: "error", message: revokeResult.error.message };
  }

  const assignments: BranchUserInsert[] = branches.map((branch) => ({
    organization_id: gym.organization_id as string,
    branch_id: branch.id,
    user_id: parsed.data.newAdminUserId,
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

  const profileUpdate = await supabase.from("profiles").update({ gym_id: gym.id }).eq("id", parsed.data.newAdminUserId);
  if (profileUpdate.error) {
    return { status: "error", message: profileUpdate.error.message };
  }

  await writeGymBranchAudit(context, "gym.admin_transferred", "gym", gym.id, {
    organizationId: gym.organization_id,
    branchIds,
    newAdminUserId: parsed.data.newAdminUserId,
    newAdminEmail: profile.email,
    reason: parsed.data.reason
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Gym admin transferred across this gym's active branch scope." };
}

export async function updateLocationLifecycleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = locationLifecycleSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    nextStatus: formData.get("nextStatus"),
    confirmation: formData.get("confirmation") ?? "",
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
    const result = await supabase.from("gyms").update({ status: parsed.data.nextStatus as GymRow["status"] }).eq("id", gym.id).select("*").maybeSingle();
    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Gym lifecycle update failed." };
    }
    await writeGymBranchAudit(context, "gym.lifecycle_updated", "gym", gym.id, { previousStatus: gym.status, nextStatus: parsed.data.nextStatus, reason: parsed.data.reason });
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
    const result = await supabase.from("branches").update({ status: parsed.data.nextStatus as BranchRow["status"] }).eq("id", branch.id).select("*").maybeSingle();
    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Branch lifecycle update failed." };
    }
    await writeGymBranchAudit(context, "branch.lifecycle_updated", "branch", branch.id, { previousStatus: branch.status, nextStatus: parsed.data.nextStatus, reason: parsed.data.reason });
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
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "MOVE_GYM") {
    return fieldError("confirmation", "Type MOVE_GYM to confirm cross-organization transfer.");
  }

  const supabase = await createSupabaseServerClient();
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

  const result = await supabase.from("gyms").update({ organization_id: parsed.data.targetOrganizationId }).eq("id", gym.id).select("*").maybeSingle();
  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Gym move failed." };
  }

  await writeGymBranchAudit(context, "gym.moved_organization", "gym", gym.id, {
    previousOrganizationId: gym.organization_id,
    targetOrganizationId: parsed.data.targetOrganizationId,
    reason: parsed.data.reason
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Gym moved to target organization." };
}

export async function moveBranchToGymAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = branchMoveSchema.safeParse({
    branchId: formData.get("branchId"),
    targetGymId: formData.get("targetGymId") ?? "",
    confirmation: formData.get("confirmation") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "MOVE_BRANCH") {
    return fieldError("confirmation", "Type MOVE_BRANCH to confirm this branch move.");
  }

  const supabase = await createSupabaseServerClient();
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

  const result = await supabase
    .from("branches")
    .update({
      gym_id: targetGym?.id ?? null,
      organization_id: targetOrganizationId
    })
    .eq("id", branch.id)
    .select("*")
    .maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch move failed." };
  }

  await writeGymBranchAudit(context, "branch.moved_gym", "branch", branch.id, {
    previousGymId: branch.gym_id,
    targetGymId: targetGym?.id ?? null,
    previousOrganizationId: branch.organization_id,
    targetOrganizationId,
    reason: parsed.data.reason
  });
  revalidateGymBranchPaths();
  return { status: "success", message: "Branch moved safely." };
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
  const [activeAdmins, activeDomains] = await Promise.all([
    countRowsWithStatus(supabase, "branch_users", "branch_id", branchId, ["active", "invited"]),
    countRowsWithStatus(supabase, "tenant_domains", "branch_id", branchId, ["pending", "verified", "failed"])
  ]);
  return [
    activeAdmins > 0 ? `${activeAdmins} branch user assignment(s) remain.` : null,
    activeDomains > 0 ? `${activeDomains} active domain route(s) remain.` : null
  ].filter((blocker): blocker is string => Boolean(blocker));
}

async function getBranchCrossOrgMoveBlockers(supabase: SupabaseClient<Database>, branchId: string) {
  const [branchUsers, domains, settings] = await Promise.all([
    countRows(supabase, "branch_users", "branch_id", branchId),
    countRows(supabase, "tenant_domains", "branch_id", branchId),
    countRows(supabase, "branch_settings", "branch_id", branchId)
  ]);
  return [
    branchUsers > 0 ? `${branchUsers} user assignment(s) remain.` : null,
    domains > 0 ? `${domains} domain route(s) remain.` : null,
    settings > 0 ? `${settings} settings record(s) remain.` : null
  ].filter((blocker): blocker is string => Boolean(blocker));
}

async function countRows(
  supabase: SupabaseClient<Database>,
  table: "branches" | "members" | "payments" | "tenant_domains" | "branch_users" | "branch_settings",
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
