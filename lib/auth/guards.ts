import { redirect } from "next/navigation";
import { getRoleRedirect, hasRequiredRole } from "@/lib/rbac";
import { canAccessResolvedTenant } from "@/lib/tenant/access";
import { getTenantContext } from "@/lib/tenant/context";
import { getOrgPlanContext, type OrgPlanContext } from "@/lib/tenant/plan-context";
import { sanitizeRedirectPath } from "./redirects";
import { getAuthContext } from "./session";
import type { AuthContext, RoleName } from "@/types/auth";

export type { OrgPlanContext };

export async function requireAuth(nextPath = "/member"): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context.isAuthenticated) {
    redirect(`/login?next=${encodeURIComponent(sanitizeRedirectPath(nextPath, "/member"))}`);
  }

  if (!context.isActive) {
    redirect("/login?error=inactive");
  }

  const tenant = await getTenantContext();
  if (!canAccessResolvedTenant(context, tenant)) {
    redirect("/unauthorized?reason=tenant");
  }

  return context;
}

export async function requireRole(allowedRoles: readonly RoleName[], nextPath: string): Promise<AuthContext> {
  const context = await requireAuth(nextPath);

  if (!hasRequiredRole(context.roles, allowedRoles)) {
    redirect(getRoleRedirect(context.roles));
  }

  return context;
}

export async function requirePrimaryRole(allowedRoles: readonly RoleName[], nextPath: string): Promise<AuthContext> {
  const context = await requireAuth(nextPath);

  if (!context.primaryRole || !allowedRoles.includes(context.primaryRole)) {
    redirect(getRoleRedirect(context.roles));
  }

  return context;
}

export async function requireActiveSubscription(organizationId: string): Promise<OrgPlanContext> {
  const planContext = await getOrgPlanContext(organizationId);

  if (planContext.status === "suspended" || planContext.status === "cancelled") {
    redirect(`/unauthorized?reason=subscription_${planContext.status}`);
  }

  return planContext;
}
