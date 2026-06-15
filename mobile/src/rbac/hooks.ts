import { useMemo } from "react";
import type { AuthContext, AuthResource, PermissionAction, RoleName } from "@/types";
import { can, canAny, getPrimaryRole, hasRequiredRole } from "./permissions";
import { requireRole, requirePermission } from "./guards";

export function useRBAC(user: AuthContext | null) {
  return useMemo(() => {
    const roles = user?.roles ?? [];
    const isAuthenticated = user?.isAuthenticated ?? false;
    const primaryRole = user?.primaryRole;

    if (!isAuthenticated) {
      return {
        isAuthenticated: false,
        primaryRole: null,
        roles: [],
        can: () => false,
        canAny: () => false,
        hasRole: () => false,
        requireAccess: () => false,
      };
    }

    return {
      isAuthenticated: true,
      primaryRole,
      roles,

      can(resource: AuthResource, action: PermissionAction): boolean {
        return canAny(roles, resource, action);
      },

      canAny(resource: AuthResource, actions: PermissionAction[]): boolean {
        return actions.some((action) => canAny(roles, resource, action));
      },

      hasRole(role: RoleName): boolean {
        return roles.includes(role);
      },

      hasAnyRole(allowedRoles: RoleName[]): boolean {
        return hasRequiredRole(roles, allowedRoles);
      },

      requireAccess(resource: AuthResource, action: PermissionAction): boolean {
        const result = requirePermission(roles, resource, action);
        return result.ok;
      },

      isSuperAdmin: roles.includes("super_admin"),
      isOrgOwner: roles.includes("organization_owner"),
      isGymAdmin: roles.includes("gym_admin"),
      isReception: roles.includes("reception_staff"),
      isTrainer: roles.includes("trainer"),
      isMember: roles.includes("member"),
    };
  }, [user]);
}

export interface RBACHookResult {
  isAuthenticated: boolean;
  primaryRole: RoleName | null;
  roles: RoleName[];
  can: (resource: AuthResource, action: PermissionAction) => boolean;
  canAny: (resource: AuthResource, actions: PermissionAction[]) => boolean;
  hasRole: (role: RoleName) => boolean;
  hasAnyRole: (allowedRoles: RoleName[]) => boolean;
  requireAccess: (resource: AuthResource, action: PermissionAction) => boolean;
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isGymAdmin: boolean;
  isReception: boolean;
  isTrainer: boolean;
  isMember: boolean;
}

export function usePermissionGuard(
  user: AuthContext | null,
  resource: AuthResource,
  action: PermissionAction
): { allowed: boolean; reason: string | null } {
  return useMemo(() => {
    if (!user) {
      return { allowed: false, reason: "Not authenticated." };
    }
    const result = requirePermission(user.roles, resource, action);
    return { allowed: result.ok, reason: result.ok ? null : result.reason };
  }, [user, resource, action]);
}

export function useRoleGuard(
  user: AuthContext | null,
  allowedRoles: RoleName[]
): { allowed: boolean; reason: string | null } {
  return useMemo(() => {
    if (!user) {
      return { allowed: false, reason: "Not authenticated." };
    }
    const result = requireRole(user.roles, allowedRoles);
    return { allowed: result.ok, reason: result.ok ? null : result.reason };
  }, [user, allowedRoles]);
}
