import { can as rbacCan } from "@/lib/rbac";
import type { AuthResource, PermissionAction } from "@/types/auth";

export function orgOwnerCan(resource: AuthResource, action: PermissionAction): boolean {
  return rbacCan("organization_owner", resource, action);
}

export function ensureOrgScope(organizationId: string, resourceOrganizationId: string): void {
  if (organizationId !== resourceOrganizationId) {
    throw new Error("Cross-organization access denied.");
  }
}

export function buildOrgScopeFilter(organizationId: string): { organizationId: string } {
  return { organizationId };
}
