import "server-only";

import { getRoleDetailData } from "./role-management-service";
import type { PermissionEntry } from "./role-management-service";
import { buildRoleAccessPreview, type RoleAccessPreview } from "@/features/super-admin/lib/role-access-preview";

export async function getRoleAccessPreview(roleId: string, proposedPermissions?: PermissionEntry[]): Promise<RoleAccessPreview | null> {
  const role = await getRoleDetailData(roleId);
  if (!role) return null;
  return buildRoleAccessPreview(role, proposedPermissions ?? role.permissions);
}

