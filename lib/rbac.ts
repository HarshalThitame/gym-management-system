import type { AuthResource, PermissionAction, RoleName } from "@/types/auth";

type PermissionSet = Partial<Record<AuthResource, readonly PermissionAction[]>>;

const allActions = ["read", "create", "update", "delete", "export", "approve"] as const satisfies readonly PermissionAction[];
const readOnly = ["read"] as const satisfies readonly PermissionAction[];
const readCreateUpdate = ["read", "create", "update"] as const satisfies readonly PermissionAction[];
const readCreateUpdateExport = ["read", "create", "update", "export"] as const satisfies readonly PermissionAction[];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionSet> = {
  super_admin: {
    users: allActions,
    roles: allActions,
    profiles: allActions,
    members: allActions,
    trainers: allActions,
    membership_plans: allActions,
    memberships: allActions,
    payments: allActions,
    attendance: allActions,
    classes: allActions,
    class_bookings: allActions,
    leads: allActions,
    notifications: allActions,
    reports: allActions,
    settings: allActions,
    organizations: allActions,
    branches: allActions,
    feature_flags: allActions,
    licenses: allActions,
    compliance: allActions,
    backups: allActions,
    system_health: allActions,
    content: allActions,
    audit_logs: ["read", "export"]
  },
  organization_owner: {
    users: readCreateUpdateExport,
    roles: ["read", "update", "approve"],
    profiles: readCreateUpdate,
    members: readCreateUpdateExport,
    trainers: readCreateUpdateExport,
    membership_plans: allActions,
    memberships: readCreateUpdateExport,
    payments: ["read", "create", "update", "export", "approve"],
    attendance: readCreateUpdateExport,
    classes: allActions,
    class_bookings: readCreateUpdate,
    leads: readCreateUpdateExport,
    notifications: readCreateUpdateExport,
    reports: ["read", "export"],
    settings: ["read", "update", "approve"],
    organizations: ["read", "update", "export", "approve"],
    branches: allActions,
    feature_flags: ["read", "update", "approve"],
    licenses: readOnly,
    compliance: readCreateUpdateExport,
    backups: ["read", "create", "export"],
    system_health: readOnly,
    content: allActions,
    audit_logs: ["read", "export"]
  },
  gym_admin: {
    users: readCreateUpdateExport,
    roles: ["read", "update", "approve"],
    profiles: readCreateUpdate,
    members: readCreateUpdateExport,
    trainers: readCreateUpdate,
    membership_plans: allActions,
    memberships: readCreateUpdateExport,
    payments: ["read", "create", "update", "export", "approve"],
    attendance: readCreateUpdateExport,
    classes: allActions,
    class_bookings: readCreateUpdate,
    leads: readCreateUpdateExport,
    notifications: readCreateUpdate,
    reports: ["read", "export"],
    settings: ["read", "update", "approve"],
    organizations: ["read", "update"],
    branches: allActions,
    feature_flags: ["read", "update", "approve"],
    licenses: readOnly,
    compliance: readCreateUpdateExport,
    backups: ["read", "create"],
    system_health: readOnly,
    content: allActions,
    audit_logs: ["read"]
  },
  reception_staff: {
    users: ["read", "create", "update"],
    profiles: readCreateUpdate,
    members: readCreateUpdate,
    trainers: readOnly,
    membership_plans: readOnly,
    memberships: readCreateUpdate,
    payments: ["read", "create", "update"],
    attendance: readCreateUpdate,
    classes: readOnly,
    class_bookings: readCreateUpdate,
    leads: readCreateUpdate,
    notifications: ["read", "create"],
    reports: readOnly,
    settings: readOnly,
    organizations: readOnly,
    branches: readOnly,
    feature_flags: readOnly,
    licenses: readOnly,
    compliance: ["read", "create"],
    backups: readOnly,
    system_health: readOnly,
    content: readOnly
  },
  trainer: {
    users: readOnly,
    profiles: ["read", "update"],
    members: ["read", "update"],
    trainers: ["read", "update"],
    membership_plans: readOnly,
    memberships: readOnly,
    attendance: ["read", "create", "update"],
    classes: ["read", "update"],
    class_bookings: readOnly,
    notifications: ["read", "create", "update"],
    reports: readOnly,
    settings: ["read", "update"],
    organizations: readOnly,
    branches: readOnly,
    feature_flags: readOnly,
    licenses: readOnly,
    compliance: readOnly,
    system_health: readOnly,
    content: readOnly
  },
  member: {
    users: ["read", "create", "update"],
    profiles: ["read", "update"],
    members: ["read", "create", "update"],
    trainers: readOnly,
    membership_plans: readOnly,
    memberships: ["read", "create"],
    payments: ["read", "create"],
    attendance: readOnly,
    classes: readOnly,
    class_bookings: ["read", "create", "update", "delete"],
    notifications: ["read", "update"],
    reports: readOnly,
    settings: ["read", "update"],
    organizations: readOnly,
    branches: readOnly,
    compliance: ["read", "create"],
    content: readOnly
  }
};

export const rolePriority = ["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer", "member"] as const satisfies readonly RoleName[];

export function getPrimaryRole(roles: readonly RoleName[]) {
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function can(
  role: RoleName,
  resource: AuthResource,
  action: PermissionAction,
  customPermissions?: readonly Record<string, string[]>[]
) {
  if (Boolean(ROLE_PERMISSIONS[role][resource]?.includes(action))) return true;
  if (customPermissions?.length) {
    return customPermissions.some((cp) => (cp[resource] as string[] | undefined)?.includes(action));
  }
  return false;
}

export function canAny(
  roles: readonly RoleName[],
  resource: AuthResource,
  action: PermissionAction,
  customPermissions?: readonly Record<string, string[]>[]
) {
  return roles.some((role) => can(role, resource, action, customPermissions));
}

export function mergePermissions(
  builtInRoles: readonly RoleName[],
  customPermissions?: readonly Record<string, string[]>[]
): Record<string, string[]> {
  const merged: Record<string, Set<string>> = {};

  for (const role of builtInRoles) {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) continue;
    for (const [resource, actions] of Object.entries(perms)) {
      if (!actions) continue;
      if (!merged[resource]) merged[resource] = new Set();
      for (const a of actions) merged[resource].add(a);
    }
  }

  if (customPermissions) {
    for (const cp of customPermissions) {
      for (const [resource, actions] of Object.entries(cp)) {
        if (!Array.isArray(actions)) continue;
        if (!merged[resource]) merged[resource] = new Set();
        for (const a of actions) merged[resource].add(a);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, Array.from(v)])
  );
}

export function hasRequiredRole(roles: readonly RoleName[], allowedRoles: readonly RoleName[]) {
  return allowedRoles.some((role) => roles.includes(role));
}

export function getRoleRedirect(roles: readonly RoleName[]) {
  const primaryRole = getPrimaryRole(roles);

  if (!primaryRole) {
    return "/auth/no-role";
  }

  if (primaryRole === "super_admin") {
    return "/super-admin";
  }

  if (primaryRole === "organization_owner") {
    return "/organization";
  }

  if (primaryRole === "gym_admin") {
    return "/admin";
  }

  if (primaryRole === "reception_staff") {
    return "/reception";
  }

  if (primaryRole === "trainer") {
    return "/trainer";
  }

  return "/member";
}
