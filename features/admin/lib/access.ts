import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/context";
import type { AuthContext } from "@/types/auth";

export type GymAdminScope = AuthContext & {
  gymId: string;
  branchId: string | null;
  scopedOrganizationId: string | null;
  isSuperAdminScope: boolean;
};

export async function requireGymAdminScope(nextPath = "/admin"): Promise<GymAdminScope> {
  const context = await requireRole(["super_admin", "gym_admin"], nextPath);
  const hasGymOperatorRole = context.roles.includes("gym_admin");

  if (context.primaryRole === "super_admin" && !hasGymOperatorRole) {
    redirect("/super-admin");
  }

  const tenant = await getTenantContext();
  const gymId = tenant.resolved && tenant.gymId ? tenant.gymId : context.profile?.gym_id ?? null;

  if (!gymId) {
    redirect(context.roles.includes("super_admin") ? "/super-admin" : "/unauthorized?reason=gym_scope");
  }

  return {
    ...context,
    gymId,
    branchId: tenant.resolved ? tenant.branch.id : null,
    scopedOrganizationId: tenant.resolved && tenant.organizationId ? tenant.organizationId : context.organizationId,
    isSuperAdminScope: context.roles.includes("super_admin")
  };
}

export function canManageGymFinancials(scope: Pick<GymAdminScope, "roles">) {
  return scope.roles.includes("super_admin") || scope.roles.includes("gym_admin");
}
