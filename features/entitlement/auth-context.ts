import "server-only";

import { getAuthContext } from "@/lib/auth/session";
import type { AuthContext, RoleName } from "@/types/auth";
import { EntitlementError } from "./entitlement-errors";

// ─── Types ─────────────────────────────────────────────────────────────────

/** AuthContext with userId guaranteed non-null (post-authentication). */
export type AuthenticatedContext = AuthContext & { userId: string };

export type OrganizationAuthContext = {
  userId: string;
  organizationId: string;
  roles: RoleName[];
  primaryRole: RoleName | null;
  isSuperAdmin: boolean;
};

// ─── getAuthenticatedUser ──────────────────────────────────────────────────

/**
 * Returns the authenticated user's AuthContext, or throws if not authenticated.
 * The returned context has userId guaranteed non-null.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedContext> {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.userId) {
    throw new EntitlementError("UNAUTHORIZED_ORG_ACCESS", "", null);
  }
  return ctx as AuthenticatedContext;
}

// ─── getOrganizationForCurrentUser ─────────────────────────────────────────

/**
 * Returns the organization ID for the currently authenticated user.
 * Throws if the user is not associated with any organization.
 */
export async function getOrganizationForCurrentUser(): Promise<string> {
  const ctx = await getAuthenticatedUser();
  if (!ctx.organizationId) {
    throw new EntitlementError("UNAUTHORIZED_ORG_ACCESS", "", null);
  }
  return ctx.organizationId;
}

// ─── assertUserBelongsToOrganization ───────────────────────────────────────

/**
 * Validates that the currently authenticated user belongs to the specified
 * organization. Super Admins bypass this check.
 *
 * Throws EntitlementError(UNAUTHORIZED_ORG_ACCESS) if the user does not belong
 * to the organization.
 *
 * This is the canonical guard to call before any entitlement check that
 * accepts an organizationId parameter — it prevents client-supplied org IDs
 * from being used to access another tenant's data.
 */
export async function assertUserBelongsToOrganization(
  organizationId: string,
): Promise<OrganizationAuthContext> {
  const ctx = await getAuthenticatedUser();
  const isSuperAdmin = ctx.roles.includes("super_admin");

  // Super Admin bypasses org membership check (for admin-only routes/actions).
  if (isSuperAdmin) {
    return {
      userId: ctx.userId,
      organizationId,
      roles: ctx.roles,
      primaryRole: ctx.primaryRole,
      isSuperAdmin: true,
    };
  }

  // All other roles must match their resolved organization.
  if (ctx.organizationId !== organizationId) {
    throw new EntitlementError("UNAUTHORIZED_ORG_ACCESS", organizationId, null);
  }

  return {
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    roles: ctx.roles,
    primaryRole: ctx.primaryRole,
    isSuperAdmin: false,
  };
}

// ─── getCurrentUserOrganizationContext ─────────────────────────────────────

/**
 * Returns the authenticated user's organization context.
 * Convenience for org-owner actions that always operate on their own org.
 */
export async function getCurrentUserOrganizationContext(): Promise<OrganizationAuthContext> {
  const ctx = await getAuthenticatedUser();
  const isSuperAdmin = ctx.roles.includes("super_admin");

  if (!isSuperAdmin && !ctx.organizationId) {
    throw new EntitlementError("UNAUTHORIZED_ORG_ACCESS", "", null);
  }

  return {
    userId: ctx.userId,
    organizationId: ctx.organizationId ?? "",
    roles: ctx.roles,
    primaryRole: ctx.primaryRole,
    isSuperAdmin,
  };
}

// ─── isSuperAdminContext ───────────────────────────────────────────────────

/**
 * Returns true if the current user is a super admin.
 * Use to bypass entitlement checks on super-admin-only routes.
 */
export async function isSuperAdminContext(): Promise<boolean> {
  const ctx = await getAuthContext();
  return ctx.roles.includes("super_admin");
}
