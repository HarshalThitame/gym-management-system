import { redirect } from "next/navigation";
import { getRoleRedirect, hasRequiredRole } from "@/lib/rbac";
import { sanitizeRedirectPath } from "./redirects";
import { getAuthContext } from "./session";
import type { AuthContext, RoleName } from "@/types/auth";

export async function requireAuth(nextPath = "/member"): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context.isAuthenticated) {
    redirect(`/login?next=${encodeURIComponent(sanitizeRedirectPath(nextPath, "/member"))}`);
  }

  if (!context.isActive) {
    redirect("/login?error=inactive");
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
