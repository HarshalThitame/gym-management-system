import "server-only";

import { requireFeatureAccess } from "./entitlement-service";
import { assertUserBelongsToOrganization } from "./auth-context";
import { EntitlementError, isEntitlementError, type EntitlementDeniedReason } from "./entitlement-errors";
import type { FeatureKey } from "./feature-registry";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { writeAuditLog } from "@/lib/audit";
import { canAny } from "@/lib/rbac";
import type { AuthResource, PermissionAction } from "@/types/auth";

export type RequireOrganizationFeatureAccessInput = {
  organizationId: string;
  featureKey: FeatureKey | readonly FeatureKey[];
  actionName: string;
  permission?: {
    resource: AuthResource;
    action: PermissionAction;
  };
  allowSuperAdminBypass?: boolean;
};

/**
 * Canonical organization backend guard.
 *
 * Authentication and tenant membership are resolved from the server session;
 * client-supplied user/package/feature values are never trusted. Existing
 * role guards may run before this helper, or callers may provide `permission`
 * to keep RBAC separate from package entitlement evaluation.
 */
export async function requireOrganizationFeatureAccess({
  organizationId,
  featureKey,
  actionName,
  permission,
  allowSuperAdminBypass = false,
}: RequireOrganizationFeatureAccessInput): Promise<{
  organizationId: string;
  userId: string;
  isSuperAdmin: boolean;
}> {
  const authCtx = await assertUserBelongsToOrganization(organizationId);

  if (permission && !canAny(authCtx.roles, permission.resource, permission.action)) {
    throw new EntitlementError("UNAUTHORIZED_ORG_ACCESS", organizationId, null);
  }

  if (authCtx.isSuperAdmin && allowSuperAdminBypass) {
    return authCtx;
  }

  const featureKeys = Array.isArray(featureKey) ? featureKey : [featureKey];
  try {
    for (const key of featureKeys) {
      await requireFeatureAccess(authCtx.organizationId, key);
    }
  } catch (error) {
    if (isEntitlementError(error)) {
      await writeAuditLog({
        actorId: authCtx.userId,
        action: "entitlement.feature_denied",
        entityType: "organization",
        entityId: organizationId,
        metadata: {
          actionName,
          featureKey: error.featureKey,
          reason: error.reason,
        },
      }).catch(() => undefined);
    }
    throw error;
  }

  return authCtx;
}

// ─── Server action guard ───────────────────────────────────────────────────

/**
 * Guard for org-owner server actions. Combines:
 *   1. Tenant safety (user belongs to org)
 *   2. Package feature entitlement check
 *
 * Usage at the top of a server action:
 *   const { organizationId, userId } = await requireOrgFeatureAccess(
 *     ctx.organizationId, "member_management"
 *   );
 *
 * Throws EntitlementError on denial. Catch it in the action and return
 * a typed error result, or use `entitlementActionCatch` in the catch block.
 */
export async function requireOrgFeatureAccess(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<{ organizationId: string; userId: string }> {
  const authCtx = await requireOrganizationFeatureAccess({
    organizationId,
    featureKey,
    actionName: "organization_action",
  });
  return { organizationId: authCtx.organizationId, userId: authCtx.userId };
}

/**
 * Multi-feature guard: requires ALL listed features.
 * Use when an operation needs multiple features (e.g., QR check-in needs
 * both `attendance_reports` and `qr_attendance`).
 */
export async function requireOrgFeatureAccessAll(
  organizationId: string,
  featureKeys: FeatureKey[],
): Promise<{ organizationId: string; userId: string }> {
  const authCtx = await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: featureKeys,
    actionName: "organization_action",
  });
  return { organizationId: authCtx.organizationId, userId: authCtx.userId };
}

// ─── Server action error catcher ───────────────────────────────────────────

/**
 * Converts an EntitlementError into a typed AuthActionState error.
 * Use in the catch block of server actions:
 *   } catch (e) {
 *     return entitlementActionCatch(prevState, e, "Failed to save member.");
 *   }
 */
export function entitlementActionCatch(
  prevState: AuthActionState,
  error: unknown,
  fallbackMessage: string,
): AuthActionState {
  if (isEntitlementError(error)) {
    return {
      ...prevState,
      status: "error",
      success: false,
      error: "FEATURE_LOCKED",
      reason: error.reason,
      message: error.message,
      featureKey: error.featureKey,
    };
  }
  return {
    ...prevState,
    status: "error",
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

/**
 * Converts an EntitlementError into a simple action state (for bulk actions
 * that use { status, message } instead of AuthActionState).
 */
export function entitlementSimpleCatch(
  error: unknown,
  fallbackMessage: string,
): {
  status: "error";
  message: string;
  success?: false;
  error?: "FEATURE_LOCKED";
  reason?: string;
  featureKey?: string | null;
} {
  if (isEntitlementError(error)) {
    return {
      status: "error",
      success: false,
      error: "FEATURE_LOCKED",
      reason: error.reason,
      message: error.message,
      featureKey: error.featureKey,
    };
  }
  return {
    status: "error",
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

// ─── Re-exports for convenience ────────────────────────────────────────────

export { EntitlementError, isEntitlementError };
export type { EntitlementDeniedReason };
