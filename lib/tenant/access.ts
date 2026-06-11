import type { AuthContext } from "@/types/auth";
import type { TenantContext } from "./context";

export function canAccessResolvedTenant(context: Pick<AuthContext, "organizationId" | "profile" | "roles">, tenant: Pick<TenantContext, "resolved" | "organizationId" | "gymId">) {
  if (!tenant.resolved) {
    return true;
  }

  if (context.roles.includes("super_admin")) {
    return true;
  }

  if (tenant.gymId && context.profile?.gym_id === tenant.gymId) {
    return true;
  }

  if (tenant.organizationId && context.organizationId === tenant.organizationId && context.roles.includes("organization_owner")) {
    return true;
  }

  return false;
}
