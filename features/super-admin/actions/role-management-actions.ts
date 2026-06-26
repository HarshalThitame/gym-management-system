"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  updateRolePermissionsSchema,
  assignUserRoleSchema,
  unassignUserRoleSchema,
  createRoleSchema as cloneRoleSchema
} from "../schemas/role-management-schemas";
import {
  createRoleInDb,
  updateRoleInDb,
  deleteRoleFromDb,
  updateRolePermissionsInDb,
  getRoleDetailData,
  cloneRoleInDb
} from "../services/role-management-service";
import type { Database } from "@/types/database";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";

async function verifyCriticalSuperAdminAccess(
  context: { userId: string | null; email: string | null; roles: string[] },
  supabase: SupabaseClient<Database>,
  value: string
): Promise<
  | { ok: true }
  | { ok: false; state: AuthActionState }
> {
  const email = context.email?.trim().toLowerCase() ?? null;
  const requiredEmail = getCriticalSuperAdminEmail();

  if (email !== requiredEmail) {
    return { ok: false, state: { status: "error", message: `Critical Super Admin actions must be performed from ${requiredEmail}.` } };
  }

  if (value.trim().toLowerCase() !== requiredEmail) {
    return { ok: false, state: fieldError("stepUpEmail", `Type ${requiredEmail} to pass the step-up identity check.`) };
  }

  const mfaResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaResult.data?.currentLevel !== "aal2") {
    return { ok: false, state: { status: "error", message: "MFA verification is required. Verify MFA at /super-admin/security/mfa first.", fieldErrors: { stepUpEmail: ["Verify MFA first."] } } };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaFreshnessCookieName)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return { ok: false, state: { status: "error", message: "MFA verification is stale. Verify a fresh code.", fieldErrors: { stepUpEmail: ["Verify a fresh MFA challenge within 10 minutes."] } } };
  }

  return { ok: true };
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v?.length)) as Record<string, string[]>
  };
}

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function revalidatePaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/roles");
}

export async function createRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");
  const rateCheck = await checkRateLimit(`create-role:${context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName"),
    description: formData.get("description") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  try {
    const role = await createRoleInDb(parsed.data.name, parsed.data.displayName, parsed.data.description ?? "");
    await writeAuditLog({
      actorId: context.userId,
      action: "role.create",
      entityType: "roles",
      entityId: role.id,
      metadata: { name: parsed.data.name, displayName: parsed.data.displayName }
    });
    revalidatePaths();
    return { status: "success", message: `Role "${parsed.data.displayName}" created.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to create role." };
  }
}

export async function updateRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");
  const rateCheck = await checkRateLimit(`update-role:${context.userId}`, 20, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const parsed = updateRoleSchema.safeParse({
    roleId: formData.get("roleId"),
    displayName: formData.get("displayName"),
    description: formData.get("description") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  try {
    await updateRoleInDb(parsed.data.roleId, parsed.data.displayName, parsed.data.description ?? "");
    await writeAuditLog({
      actorId: context.userId,
      action: "role.update",
      entityType: "roles",
      entityId: parsed.data.roleId,
      metadata: { displayName: parsed.data.displayName }
    });
    revalidatePaths();
    return { status: "success", message: "Role updated." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to update role." };
  }
}

export async function deleteRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");
  const rateCheck = await checkRateLimit(`delete-role:${context.userId}`, 5, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const parsed = deleteRoleSchema.safeParse({
    roleId: formData.get("roleId"),
    confirmation: formData.get("confirmation"),
    stepUpEmail: formData.get("stepUpEmail"),
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  if (parsed.data.confirmation !== "DELETE") {
    return fieldError("confirmation", "Type DELETE to confirm.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  try {
    await deleteRoleFromDb(parsed.data.roleId);
    await writeAuditLog({
      actorId: context.userId,
      action: "role.delete",
      entityType: "roles",
      entityId: parsed.data.roleId,
      metadata: { reason: parsed.data.reason ?? "" }
    });
    revalidatePaths();
    return { status: "success", message: "Role permanently deleted." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to delete role." };
  }
}

export async function updateRolePermissionsAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");

  const roleId = formData.get("roleId");
  if (typeof roleId !== "string") return fieldError("roleId", "Invalid role ID.");

  const resourcesJson = formData.get("resources");
  if (typeof resourcesJson !== "string") return fieldError("resources", "Permissions data is required.");

  let resources: Array<{ resource: string; actions: string[] }>;
  try { resources = JSON.parse(resourcesJson); }
  catch { return fieldError("resources", "Invalid permissions format."); }

  const parsed = updateRolePermissionsSchema.safeParse({
    roleId,
    permissions: resources,
    stepUpEmail: formData.get("stepUpEmail"),
    reason: formData.get("reason") ?? ""
  });
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  const { data: targetRole } = await supabase.from("roles").select("is_system").eq("id", parsed.data.roleId).single();
  if ((targetRole as unknown as { is_system: boolean })?.is_system) {
    return { status: "error", message: "System role permissions cannot be modified." };
  }

  try {
    await updateRolePermissionsInDb(parsed.data.roleId, parsed.data.permissions);
    await writeAuditLog({
      actorId: context.userId,
      action: "role.permissions.update",
      entityType: "roles",
      entityId: parsed.data.roleId,
      metadata: { permissionCount: parsed.data.permissions.length, reason: parsed.data.reason ?? "" }
    });
    revalidatePaths();
    return { status: "success", message: "Permissions updated." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to update permissions." };
  }
}

export async function assignUserRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");
  const rateCheck = await checkRateLimit(`assign-role:${context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const parsed = assignUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
    stepUpEmail: formData.get("stepUpEmail"),
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  const { data: targetRole } = await supabase.from("roles").select("is_system").eq("id", parsed.data.roleId).single();
  if ((targetRole as unknown as { is_system: boolean })?.is_system) {
    return { status: "error", message: "System roles cannot be assigned through this interface." };
  }

  try {
    const roleDetail = await getRoleDetailData(parsed.data.roleId);
    const { error } = await supabase.from("user_roles").insert({
      user_id: parsed.data.userId,
      role_id: parsed.data.roleId,
      assigned_by: context.userId
    });

    if (error) {
      if (error.code === "23505") return { status: "error", message: "User already has this role." };
      return { status: "error", message: error.message };
    }

    await writeAuditLog({
      actorId: context.userId,
      action: "user.role.assign",
      entityType: "user_roles",
      entityId: parsed.data.userId,
      metadata: { roleName: roleDetail?.display_name ?? parsed.data.roleId, reason: parsed.data.reason ?? "" }
    });
    revalidatePaths();
    return { status: "success", message: "Role assigned to user." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to assign role." };
  }
}

export async function unassignUserRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");
  const rateCheck = await checkRateLimit(`unassign-role:${context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const parsed = unassignUserRoleSchema.safeParse({
    userRoleId: formData.get("userRoleId"),
    stepUpEmail: formData.get("stepUpEmail"),
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  try {
    const { data: ur } = await supabase.from("user_roles").select("user_id, role_id").eq("id", parsed.data.userRoleId).single();
    if (!ur) return { status: "error", message: "Assignment not found." };

    const { error } = await supabase.from("user_roles").delete().eq("id", parsed.data.userRoleId);
    if (error) return { status: "error", message: error.message };

    await writeAuditLog({
      actorId: context.userId,
      action: "user.role.unassign",
      entityType: "user_roles",
      entityId: ur.user_id,
      metadata: { roleId: ur.role_id, reason: parsed.data.reason ?? "" }
    });
    revalidatePaths();
    return { status: "success", message: "Role unassigned from user." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to unassign role." };
  }
}

export async function cloneRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/roles");
  const rateCheck = await checkRateLimit(`clone-role:${context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const sourceRoleId = formData.get("sourceRoleId");
  if (typeof sourceRoleId !== "string") return fieldError("sourceRoleId", "Source role is required.");

  const parsed = cloneRoleSchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName"),
    description: formData.get("description") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  try {
    const role = await cloneRoleInDb(sourceRoleId, parsed.data.name, parsed.data.displayName, parsed.data.description ?? "");
    await writeAuditLog({
      actorId: context.userId,
      action: "role.clone",
      entityType: "roles",
      entityId: role.id,
      metadata: { sourceRoleId, name: parsed.data.name, displayName: parsed.data.displayName }
    });
    revalidatePaths();
    return { status: "success", message: `Role "${parsed.data.displayName}" cloned from source.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to clone role." };
  }
}
