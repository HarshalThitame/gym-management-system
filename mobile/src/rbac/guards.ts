import type { AuthContext, AuthResource, PermissionAction, RoleName } from "@/types";
import { can, canAny, getPrimaryRole, hasRequiredRole } from "./permissions";

type GuardResult = { ok: true } | { ok: false; reason: string };

export function requireRole(roles: readonly RoleName[], allowedRoles: readonly RoleName[]): GuardResult {
  if (hasRequiredRole(roles, allowedRoles)) {
    return { ok: true };
  }
  return { ok: false, reason: "You do not have the required role for this action." };
}

export function requirePrimaryRole(roles: readonly RoleName[], allowedRoles: readonly RoleName[]): GuardResult {
  const primaryRole = getPrimaryRole(roles);
  if (primaryRole && allowedRoles.includes(primaryRole)) {
    return { ok: true };
  }
  return { ok: false, reason: "Your primary role does not have access to this feature." };
}

export function requirePermission(
  roles: readonly RoleName[],
  resource: AuthResource,
  action: PermissionAction
): GuardResult {
  if (canAny(roles, resource, action)) {
    return { ok: true };
  }
  return { ok: false, reason: `You do not have permission to ${action} ${resource}.` };
}

export function requireAllPermissions(
  roles: readonly RoleName[],
  permissions: Array<{ resource: AuthResource; action: PermissionAction }>
): GuardResult {
  for (const { resource, action } of permissions) {
    const result = requirePermission(roles, resource, action);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function requireAnyPermission(
  roles: readonly RoleName[],
  permissions: Array<{ resource: AuthResource; action: PermissionAction }>
): GuardResult {
  for (const { resource, action } of permissions) {
    if (can(roles[0] as RoleName, resource, action)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "You do not have any of the required permissions." };
}

export function requireActiveSubscription(subscriptionStatus: string): GuardResult {
  if (subscriptionStatus === "active" || subscriptionStatus === "trial") {
    return { ok: true };
  }
  return { ok: false, reason: "Your subscription is not active. Please renew to continue." };
}

export function requireTenantAccess(
  context: AuthContext,
  targetOrganizationId: string | null,
  targetGymId: string | null
): GuardResult {
  if (context.roles.includes("super_admin")) {
    return { ok: true };
  }

  if (targetGymId && context.profile?.gym_id === targetGymId) {
    return { ok: true };
  }

  if (
    targetOrganizationId &&
    context.organizationId === targetOrganizationId &&
    context.roles.includes("organization_owner")
  ) {
    return { ok: true };
  }

  return { ok: false, reason: "You do not have access to this organization." };
}

export function canAccessResource(
  context: AuthContext,
  resource: AuthResource,
  action: PermissionAction
): boolean {
  return canAny(context.roles, resource, action);
}
