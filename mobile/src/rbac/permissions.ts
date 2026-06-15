import type { AuthResource, PermissionAction, RoleName } from "@/types";

type PermissionSet = Partial<Record<AuthResource, readonly PermissionAction[]>>;

const ALL_ACTIONS = ["read", "create", "update", "delete", "export", "approve"] as const satisfies readonly PermissionAction[];
const READ_ONLY = ["read"] as const satisfies readonly PermissionAction[];
const READ_CREATE_UPDATE = ["read", "create", "update"] as const satisfies readonly PermissionAction[];
const READ_CREATE_UPDATE_EXPORT = ["read", "create", "update", "export"] as const satisfies readonly PermissionAction[];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionSet> = {
  super_admin: {
    users: ALL_ACTIONS,
    roles: ALL_ACTIONS,
    profiles: ALL_ACTIONS,
    members: ALL_ACTIONS,
    trainers: ALL_ACTIONS,
    membership_plans: ALL_ACTIONS,
    memberships: ALL_ACTIONS,
    payments: ALL_ACTIONS,
    attendance: ALL_ACTIONS,
    classes: ALL_ACTIONS,
    class_bookings: ALL_ACTIONS,
    leads: ALL_ACTIONS,
    notifications: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    settings: ALL_ACTIONS,
    organizations: ALL_ACTIONS,
    branches: ALL_ACTIONS,
    feature_flags: ALL_ACTIONS,
    licenses: ALL_ACTIONS,
    compliance: ALL_ACTIONS,
    backups: ALL_ACTIONS,
    system_health: ALL_ACTIONS,
    content: ALL_ACTIONS,
    audit_logs: ["read", "export"],
  },
  organization_owner: {
    users: READ_CREATE_UPDATE_EXPORT,
    roles: ["read", "update", "approve"],
    profiles: READ_CREATE_UPDATE,
    members: READ_CREATE_UPDATE_EXPORT,
    trainers: READ_CREATE_UPDATE_EXPORT,
    membership_plans: ALL_ACTIONS,
    memberships: READ_CREATE_UPDATE_EXPORT,
    payments: ["read", "create", "update", "export", "approve"],
    attendance: READ_CREATE_UPDATE_EXPORT,
    classes: ALL_ACTIONS,
    class_bookings: READ_CREATE_UPDATE,
    leads: READ_CREATE_UPDATE_EXPORT,
    notifications: READ_CREATE_UPDATE_EXPORT,
    reports: ["read", "export"],
    settings: ["read", "update", "approve"],
    organizations: ["read", "update", "export", "approve"],
    branches: ALL_ACTIONS,
    feature_flags: ["read", "update", "approve"],
    licenses: READ_ONLY,
    compliance: READ_CREATE_UPDATE_EXPORT,
    backups: ["read", "create", "export"],
    system_health: READ_ONLY,
    content: ALL_ACTIONS,
    audit_logs: ["read", "export"],
  },
  gym_admin: {
    users: READ_CREATE_UPDATE_EXPORT,
    roles: ["read", "update", "approve"],
    profiles: READ_CREATE_UPDATE,
    members: READ_CREATE_UPDATE_EXPORT,
    trainers: READ_CREATE_UPDATE,
    membership_plans: ALL_ACTIONS,
    memberships: READ_CREATE_UPDATE_EXPORT,
    payments: ["read", "create", "update", "export", "approve"],
    attendance: READ_CREATE_UPDATE_EXPORT,
    classes: ALL_ACTIONS,
    class_bookings: READ_CREATE_UPDATE,
    leads: READ_CREATE_UPDATE_EXPORT,
    notifications: READ_CREATE_UPDATE,
    reports: ["read", "export"],
    settings: ["read", "update", "approve"],
    organizations: ["read", "update"],
    branches: ALL_ACTIONS,
    feature_flags: ["read", "update", "approve"],
    licenses: READ_ONLY,
    compliance: READ_CREATE_UPDATE_EXPORT,
    backups: ["read", "create"],
    system_health: READ_ONLY,
    content: ALL_ACTIONS,
    audit_logs: ["read"],
  },
  reception_staff: {
    users: ["read", "create", "update"],
    profiles: READ_CREATE_UPDATE,
    members: READ_CREATE_UPDATE,
    trainers: READ_ONLY,
    membership_plans: READ_ONLY,
    memberships: READ_CREATE_UPDATE,
    payments: ["read", "create", "update"],
    attendance: READ_CREATE_UPDATE,
    classes: READ_ONLY,
    class_bookings: READ_CREATE_UPDATE,
    leads: READ_CREATE_UPDATE,
    notifications: ["read", "create"],
    reports: READ_ONLY,
    settings: READ_ONLY,
    organizations: READ_ONLY,
    branches: READ_ONLY,
    feature_flags: READ_ONLY,
    licenses: READ_ONLY,
    compliance: ["read", "create"],
    backups: READ_ONLY,
    system_health: READ_ONLY,
    content: READ_ONLY,
  },
  trainer: {
    users: READ_ONLY,
    profiles: ["read", "update"],
    members: ["read", "update"],
    trainers: ["read", "update"],
    membership_plans: READ_ONLY,
    memberships: READ_ONLY,
    attendance: ["read", "create", "update"],
    classes: ["read", "update"],
    class_bookings: READ_ONLY,
    notifications: ["read", "create", "update"],
    reports: READ_ONLY,
    settings: ["read", "update"],
    organizations: READ_ONLY,
    branches: READ_ONLY,
    feature_flags: READ_ONLY,
    licenses: READ_ONLY,
    compliance: READ_ONLY,
    system_health: READ_ONLY,
    content: READ_ONLY,
  },
  member: {
    users: ["read", "create", "update"],
    profiles: ["read", "update"],
    members: ["read", "create", "update"],
    trainers: READ_ONLY,
    membership_plans: READ_ONLY,
    memberships: ["read", "create"],
    payments: ["read", "create"],
    attendance: READ_ONLY,
    classes: READ_ONLY,
    class_bookings: ["read", "create", "update", "delete"],
    notifications: ["read", "update"],
    reports: READ_ONLY,
    settings: ["read", "update"],
    organizations: READ_ONLY,
    branches: READ_ONLY,
    compliance: ["read", "create"],
    content: READ_ONLY,
  },
} as const;

export const ROLE_PRIORITY: RoleName[] = [
  "super_admin",
  "organization_owner",
  "gym_admin",
  "reception_staff",
  "trainer",
  "member",
];

export function getPrimaryRole(roles: readonly RoleName[]): RoleName | null {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
}

export function can(role: RoleName, resource: AuthResource, action: PermissionAction): boolean {
  return Boolean(ROLE_PERMISSIONS[role]?.[resource]?.includes(action));
}

export function canAny(roles: readonly RoleName[], resource: AuthResource, action: PermissionAction): boolean {
  return roles.some((role) => can(role, resource, action));
}

export function hasRequiredRole(roles: readonly RoleName[], allowedRoles: readonly RoleName[]): boolean {
  return allowedRoles.some((role) => roles.includes(role));
}

export function getRoleRedirect(roles: readonly RoleName[]): string {
  const primaryRole = getPrimaryRole(roles);

  if (!primaryRole) return "/unauthorized";
  if (primaryRole === "super_admin") return "/super-admin";
  if (primaryRole === "organization_owner") return "/owner";
  if (primaryRole === "gym_admin") return "/admin";
  if (primaryRole === "reception_staff") return "/reception";
  if (primaryRole === "trainer") return "/trainer";
  return "/member";
}
