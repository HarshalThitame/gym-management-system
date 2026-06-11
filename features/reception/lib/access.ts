import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/context";
import type { AuthContext, RoleName } from "@/types/auth";

export type ReceptionScope = AuthContext & {
  gymId: string;
  branchId: string | null;
  scopedOrganizationId: string | null;
};

export async function requireReceptionScope(nextPath = "/reception"): Promise<ReceptionScope> {
  return requireGymFrontDeskScope(["reception_staff"], nextPath);
}

export async function requireGymFrontDeskScope(allowedRoles: readonly RoleName[], nextPath = "/reception"): Promise<ReceptionScope> {
  const context = await requireRole(allowedRoles, nextPath);
  const hasOperationalGymRole = context.roles.includes("gym_admin") || context.roles.includes("reception_staff");

  if (context.primaryRole === "super_admin" && !hasOperationalGymRole) {
    redirect("/super-admin");
  }

  const tenant = await getTenantContext();
  const gymId = tenant.resolved && tenant.gymId ? tenant.gymId : context.profile?.gym_id ?? null;

  if (!gymId) {
    redirect("/unauthorized?reason=gym_scope");
  }

  return {
    ...context,
    gymId,
    branchId: tenant.resolved ? tenant.branch.id : null,
    scopedOrganizationId: tenant.resolved && tenant.organizationId ? tenant.organizationId : context.organizationId
  };
}
