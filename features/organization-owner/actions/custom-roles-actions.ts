"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules, auditOrgAction } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

export type CustomRole = Database["public"]["Tables"]["custom_roles"]["Row"];

const BASE_URL = "/organization/custom-roles";

function gate(organizationId: string, actionName: string) {
  return requireOrganizationFeatureAccess({ organizationId, featureKey: "custom_roles_granular_permissions", actionName });
}

// ─── Direct server functions (matching spec signatures) ────────────────────

export async function getCustomRoles(organizationId: string): Promise<CustomRole[]> {
  await gate(organizationId, "custom_roles.list");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("custom_roles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return (data as CustomRole[]) ?? [];
}

export async function getCustomRole(organizationId: string, roleId: string): Promise<CustomRole | null> {
  await gate(organizationId, "custom_roles.read");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("custom_roles")
    .select("*")
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .single();
  return (data as CustomRole) ?? null;
}

export async function createCustomRoleAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(BASE_URL);
    await gate(ctx.organizationId, "custom_roles.create");

    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const permissionsRaw = formData.get("permissions") as string;

    if (!name) return { ...prevState, status: "error", message: "Role name is required." };
    if (!permissionsRaw) return { ...prevState, status: "error", message: "Permissions are required." };

    let permissions: Json;
    try {
      permissions = JSON.parse(permissionsRaw);
    } catch {
      return { ...prevState, status: "error", message: "Invalid permissions format." };
    }

    if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
      return { ...prevState, status: "error", message: "Permissions must be a resource-to-actions mapping." };
    }
    for (const [, actions] of Object.entries(permissions as Record<string, unknown>)) {
      if (!Array.isArray(actions) || !actions.every((a) => typeof a === "string")) {
        return { ...prevState, status: "error", message: "Each permission resource must map to an array of action strings." };
      }
    }

    const supabase = await createSupabaseServerClient();

    // Check uniqueness
    const { data: existing } = await supabase
      .from("custom_roles")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("name", name)
      .maybeSingle();
    if (existing) return { ...prevState, status: "error", message: `A custom role named "${name}" already exists.` };

    const { error } = await supabase.from("custom_roles").insert({
      organization_id: ctx.organizationId,
      name,
      description,
      permissions,
      created_by: ctx.userId,
    } as never);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "create_custom_role", "custom_roles", null, { name });
    revalidateOrgModules([BASE_URL]);
    return { ...prevState, status: "success", message: `Custom role "${name}" created.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to create custom role.");
  }
}

export async function updateCustomRoleAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(BASE_URL);
    await gate(ctx.organizationId, "custom_roles.update");

    const roleId = formData.get("roleId") as string;
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const permissionsRaw = formData.get("permissions") as string;

    if (!roleId) return { ...prevState, status: "error", message: "Role ID is required." };
    if (!name) return { ...prevState, status: "error", message: "Role name is required." };
    if (!permissionsRaw) return { ...prevState, status: "error", message: "Permissions are required." };

    let permissions: Json;
    try {
      permissions = JSON.parse(permissionsRaw);
    } catch {
      return { ...prevState, status: "error", message: "Invalid permissions format." };
    }

    if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
      return { ...prevState, status: "error", message: "Permissions must be a resource-to-actions mapping." };
    }
    for (const [, actions] of Object.entries(permissions as Record<string, unknown>)) {
      if (!Array.isArray(actions) || !actions.every((a) => typeof a === "string")) {
        return { ...prevState, status: "error", message: "Each permission resource must map to an array of action strings." };
      }
    }

    const supabase = await createSupabaseServerClient();

    // Check uniqueness (exclude self)
    const { data: existing } = await supabase
      .from("custom_roles")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("name", name)
      .neq("id", roleId)
      .maybeSingle();
    if (existing) return { ...prevState, status: "error", message: `A custom role named "${name}" already exists.` };

    const { error } = await supabase
      .from("custom_roles")
      .update({ name, description, permissions } as never)
      .eq("id", roleId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "update_custom_role", "custom_roles", roleId, { name });
    revalidateOrgModules([BASE_URL]);
    return { ...prevState, status: "success", message: `Custom role "${name}" updated.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to update custom role.");
  }
}

export async function deleteCustomRoleAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(BASE_URL);
    await gate(ctx.organizationId, "custom_roles.delete");

    const roleId = formData.get("roleId") as string;
    if (!roleId) return { ...prevState, status: "error", message: "Role ID is required." };

    const supabase = await createSupabaseServerClient();

    // Delete user assignments first
    await supabase
      .from("user_custom_roles")
      .delete()
      .eq("custom_role_id", roleId)
      .eq("organization_id", ctx.organizationId);

    const { error } = await supabase
      .from("custom_roles")
      .delete()
      .eq("id", roleId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "delete_custom_role", "custom_roles", roleId);
    revalidateOrgModules([BASE_URL]);
    return { ...prevState, status: "success", message: "Custom role deleted." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to delete custom role.");
  }
}

export async function assignCustomRoleToUserAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(BASE_URL);
    await gate(ctx.organizationId, "custom_roles.assign");

    const userId = formData.get("userId") as string;
    const customRoleId = formData.get("customRoleId") as string;
    if (!userId || !customRoleId) return { ...prevState, status: "error", message: "User and role are required." };

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("user_custom_roles").insert({
      user_id: userId,
      custom_role_id: customRoleId,
      organization_id: ctx.organizationId,
    } as never);

    if (error) {
      // Unique violation means already assigned
      if (error.code === "23505") return { ...prevState, status: "error", message: "This role is already assigned to the user." };
      throw new Error(error.message);
    }

    await auditOrgAction(ctx.userId, "assign_custom_role", "user_custom_roles", null, { userId, customRoleId });
    revalidateOrgModules([BASE_URL]);
    return { ...prevState, status: "success", message: "Custom role assigned." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to assign custom role.");
  }
}

export async function removeCustomRoleFromUserAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(BASE_URL);
    await gate(ctx.organizationId, "custom_roles.unassign");

    const userId = formData.get("userId") as string;
    const customRoleId = formData.get("customRoleId") as string;
    if (!userId || !customRoleId) return { ...prevState, status: "error", message: "User and role are required." };

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("user_custom_roles")
      .delete()
      .eq("user_id", userId)
      .eq("custom_role_id", customRoleId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "remove_custom_role", "user_custom_roles", null, { userId, customRoleId });
    revalidateOrgModules([BASE_URL]);
    return { ...prevState, status: "success", message: "Custom role removed." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to remove custom role.");
  }
}

export async function getUserCustomRoles(organizationId: string, userId: string): Promise<CustomRole[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_custom_roles")
    .select("custom_role_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  if (!data || data.length === 0) return [];

  const roleIds = data.map((r) => r.custom_role_id);
  const { data: roles } = await supabase
    .from("custom_roles")
    .select("*")
    .in("id", roleIds)
    .eq("is_active", true);

  return (roles as CustomRole[]) ?? [];
}

export async function getCustomRoleUserCounts(organizationId: string): Promise<Record<string, number>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_custom_roles")
    .select("custom_role_id")
    .eq("organization_id", organizationId);

  if (!data || data.length === 0) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.custom_role_id] = (counts[row.custom_role_id] ?? 0) + 1;
  }
  return counts;
}

export async function getBulkUserCustomRoles(organizationId: string): Promise<Record<string, string[]>> {
  const supabase = await createSupabaseServerClient();
  const { data: assignments } = await supabase
    .from("user_custom_roles")
    .select("user_id, custom_role_id")
    .eq("organization_id", organizationId);

  if (!assignments || assignments.length === 0) return {};

  const roleIds = [...new Set(assignments.map((a) => a.custom_role_id))];
  const { data: roles } = await supabase
    .from("custom_roles")
    .select("id, name")
    .in("id", roleIds)
    .eq("is_active", true);

  const roleNameMap: Record<string, string> = {};
  if (roles) {
    for (const r of roles) {
      roleNameMap[r.id] = r.name;
    }
  }

  const result: Record<string, string[]> = {};
  for (const a of assignments) {
    const name = roleNameMap[a.custom_role_id];
    if (name) {
      const arr = result[a.user_id] ?? (result[a.user_id] = []);
      arr.push(name);
    }
  }
  return result;
}

// ─── Direct mutation functions (for use outside form actions) ──────────────

export async function createCustomRole(
  organizationId: string,
  data: { name: string; description?: string; permissions: Record<string, string[]> }
): Promise<CustomRole> {
  await gate(organizationId, "custom_roles.create");
  const supabase = await createSupabaseServerClient();

  if (!data.name?.trim()) throw new Error("Role name is required.");
  if (!data.permissions || typeof data.permissions !== "object" || Array.isArray(data.permissions)) {
    throw new Error("Permissions must be a resource-to-actions mapping.");
  }

  const { data: existing } = await supabase
    .from("custom_roles").select("id").eq("organization_id", organizationId).eq("name", data.name.trim()).maybeSingle();
  if (existing) throw new Error(`A custom role named "${data.name}" already exists.`);

  const { data: created, error } = await supabase
    .from("custom_roles")
    .insert({ organization_id: organizationId, name: data.name.trim(), description: data.description ?? null, permissions: data.permissions as Json })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return created as CustomRole;
}

export async function updateCustomRole(
  organizationId: string,
  roleId: string,
  data: { name?: string; description?: string; permissions?: Record<string, string[]> }
): Promise<CustomRole> {
  await gate(organizationId, "custom_roles.update");
  const supabase = await createSupabaseServerClient();

  if (data.name?.trim()) {
    const { data: existing } = await supabase
      .from("custom_roles").select("id").eq("organization_id", organizationId).eq("name", data.name.trim()).neq("id", roleId).maybeSingle();
    if (existing) throw new Error(`A custom role named "${data.name}" already exists.`);
  }

  const update: Record<string, unknown> = {};
  if (data.name?.trim()) update.name = data.name.trim();
  if (data.description !== undefined) update.description = data.description ?? null;
  if (data.permissions) update.permissions = data.permissions as Json;

  const { data: updated, error } = await supabase
    .from("custom_roles")
    .update(update as never)
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return updated as CustomRole;
}

export async function deleteCustomRole(organizationId: string, roleId: string): Promise<void> {
  await gate(organizationId, "custom_roles.delete");
  const supabase = await createSupabaseServerClient();

  await supabase.from("user_custom_roles").delete().eq("custom_role_id", roleId).eq("organization_id", organizationId);

  const { error } = await supabase
    .from("custom_roles")
    .delete()
    .eq("id", roleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function assignCustomRoleToUser(
  organizationId: string,
  userId: string,
  customRoleId: string
): Promise<void> {
  await gate(organizationId, "custom_roles.assign");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("user_custom_roles").insert({
    user_id: userId, custom_role_id: customRoleId, organization_id: organizationId
  } as never);

  if (error) {
    if (error.code === "23505") throw new Error("This role is already assigned to the user.");
    throw new Error(error.message);
  }
}

export async function removeCustomRoleFromUser(
  organizationId: string,
  userId: string,
  customRoleId: string
): Promise<void> {
  await gate(organizationId, "custom_roles.unassign");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("user_custom_roles")
    .delete()
    .eq("user_id", userId)
    .eq("custom_role_id", customRoleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}
