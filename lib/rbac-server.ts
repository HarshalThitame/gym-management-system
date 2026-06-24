import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext, RoleName, AuthResource, PermissionAction } from "@/types/auth";
import { canAny, mergePermissions } from "./rbac";

export async function getEffectiveCustomPermissions(
  auth: AuthContext
): Promise<Record<string, string[]>[]> {
  if (!auth.userId || !auth.organizationId || !auth.roles || auth.roles.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // Verify user is still active in the organization (has active branch_users record)
  const { data: activeAssignment } = await supabase
    .from("branch_users")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("organization_id", auth.organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (!activeAssignment) return [];

  // Fetch custom role assignments for the user
  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_custom_roles")
    .select("custom_role_id")
    .eq("user_id", auth.userId)
    .eq("organization_id", auth.organizationId);

  if (assignmentsError || !assignments || assignments.length === 0) return [];

  const roleIds = assignments.map((a) => a.custom_role_id);

  const { data: customRoles, error: rolesError } = await supabase
    .from("custom_roles")
    .select("id, permissions")
    .in("id", roleIds)
    .eq("is_active", true);

  if (rolesError || !customRoles || customRoles.length === 0) return [];

  return customRoles
    .map((cr) => (cr.permissions as Record<string, string[]>) ?? {})
    .filter((p) => Object.keys(p).length > 0);
}

export async function canWithCustomRoles(
  auth: AuthContext,
  resource: AuthResource,
  action: PermissionAction
): Promise<boolean> {
  const builtInRoles = auth.roles as readonly RoleName[];
  if (canAny(builtInRoles, resource, action)) return true;

  const customPerms = await getEffectiveCustomPermissions(auth);
  if (customPerms.length === 0) return false;

  return customPerms.some((cp) => (cp[resource] as string[] | undefined)?.includes(action));
}

export async function getEffectivePermissions(
  auth: AuthContext
): Promise<Record<string, string[]>> {
  const builtInRoles = auth.roles as readonly RoleName[];
  const customPerms = await getEffectiveCustomPermissions(auth);
  return mergePermissions(builtInRoles, customPerms);
}
