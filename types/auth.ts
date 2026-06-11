export const roleNames = ["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer", "member"] as const;

export type RoleName = (typeof roleNames)[number];

export type StaffRoleName = Extract<RoleName, "super_admin" | "organization_owner" | "gym_admin" | "reception_staff">;

export const permissionActions = ["read", "create", "update", "delete", "export", "approve"] as const;

export type PermissionAction = (typeof permissionActions)[number];

export const authResources = [
  "users",
  "roles",
  "profiles",
  "members",
  "trainers",
  "membership_plans",
  "memberships",
  "payments",
  "attendance",
  "classes",
  "class_bookings",
  "leads",
  "notifications",
  "reports",
  "settings",
  "organizations",
  "branches",
  "feature_flags",
  "licenses",
  "compliance",
  "backups",
  "system_health",
  "content",
  "audit_logs"
] as const;

export type AuthResource = (typeof authResources)[number];

export type ProfileStatus = "active" | "invited" | "suspended" | "archived";

export type AuthProfile = {
  id: string;
  gym_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export type AuthContext = {
  userId: string | null;
  email: string | null;
  profile: AuthProfile | null;
  organizationId: string | null;
  roles: RoleName[];
  primaryRole: RoleName | null;
  isAuthenticated: boolean;
  isActive: boolean;
};

export function isRoleName(value: string): value is RoleName {
  return roleNames.includes(value as RoleName);
}
