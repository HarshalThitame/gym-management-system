import { NextResponse, type NextRequest } from "next/server";
import { canAny, hasRequiredRole } from "@/lib/rbac";
import { canAccessResolvedTenant } from "@/lib/tenant/access";
import { getTenantContext, type TenantContext } from "@/lib/tenant/context";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import type { AuthContext, AuthResource, PermissionAction, RoleName } from "@/types/auth";
import { getAuthContext } from "./session";

type ApiAuthOptions = {
  unauthenticatedMessage?: string;
  inactiveMessage?: string;
  forbiddenMessage?: string;
  tenantDeniedMessage?: string;
};

type ApiAuthenticatedContext = AuthContext & {
  userId: string;
};

type ApiAuthSuccess = {
  ok: true;
  context: ApiAuthenticatedContext;
  tenant: TenantContext;
};

type ApiOptionalAuthSuccess = {
  ok: true;
  context: ApiAuthenticatedContext | null;
  tenant: TenantContext | null;
};

type ApiAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;
export type ApiOptionalAuthResult = ApiOptionalAuthSuccess | ApiAuthFailure;

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function requireApiAuth(options: ApiAuthOptions = {}): Promise<ApiAuthResult> {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return {
      ok: false,
      response: apiError("UNAUTHENTICATED", options.unauthenticatedMessage ?? "Sign in to continue.", 401)
    };
  }

  if (!context.isActive) {
    return {
      ok: false,
      response: apiError("ACCOUNT_INACTIVE", options.inactiveMessage ?? "Your account is not active.", 403)
    };
  }

  const tenant = await getTenantContext();

  if (!canAccessResolvedTenant(context, tenant)) {
    return {
      ok: false,
      response: apiError("TENANT_ACCESS_DENIED", options.tenantDeniedMessage ?? "This account cannot access the requested tenant.", 403)
    };
  }

  return { ok: true, context: context as ApiAuthenticatedContext, tenant };
}

export async function getOptionalApiAuth(options: ApiAuthOptions = {}): Promise<ApiOptionalAuthResult> {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return { ok: true, context: null, tenant: null };
  }

  if (!context.isActive) {
    return {
      ok: false,
      response: apiError("ACCOUNT_INACTIVE", options.inactiveMessage ?? "Your account is not active.", 403)
    };
  }

  const tenant = await getTenantContext();

  if (!canAccessResolvedTenant(context, tenant)) {
    return {
      ok: false,
      response: apiError("TENANT_ACCESS_DENIED", options.tenantDeniedMessage ?? "This account cannot access the requested tenant.", 403)
    };
  }

  return { ok: true, context: context as ApiAuthenticatedContext, tenant };
}

export async function requireApiRole(allowedRoles: readonly RoleName[], options: ApiAuthOptions = {}): Promise<ApiAuthResult> {
  const auth = await requireApiAuth(options);

  if (!auth.ok) {
    return auth;
  }

  if (!hasRequiredRole(auth.context.roles, allowedRoles)) {
    return {
      ok: false,
      response: apiError("FORBIDDEN", options.forbiddenMessage ?? "You do not have permission to perform this action.", 403)
    };
  }

  return auth;
}

export async function requireApiPrimaryRole(allowedRoles: readonly RoleName[], options: ApiAuthOptions = {}): Promise<ApiAuthResult> {
  const auth = await requireApiAuth(options);

  if (!auth.ok) {
    return auth;
  }

  if (!auth.context.primaryRole || !allowedRoles.includes(auth.context.primaryRole)) {
    return {
      ok: false,
      response: apiError("FORBIDDEN", options.forbiddenMessage ?? "You do not have permission to perform this action.", 403)
    };
  }

  return auth;
}

export async function requireApiPermission(resource: AuthResource, action: PermissionAction, options: ApiAuthOptions = {}): Promise<ApiAuthResult> {
  const auth = await requireApiAuth(options);

  if (!auth.ok) {
    return auth;
  }

  if (!canAny(auth.context.roles, resource, action)) {
    return {
      ok: false,
      response: apiError("FORBIDDEN", options.forbiddenMessage ?? "You do not have permission to perform this action.", 403)
    };
  }

  return auth;
}

export async function requireActiveSubscriptionForApi(organizationId: string, request: NextRequest) {
  void request;
  const planContext = await getOrgPlanContext(organizationId);

  if (planContext.status === "suspended" || planContext.status === "cancelled") {
    return NextResponse.json({ error: "Subscription suspended", reason: "subscription_suspended" }, { status: 403 });
  }

  return null;
}

export function getApiTenantGymId(context: Pick<AuthContext, "profile">, tenant: Pick<TenantContext, "resolved" | "gymId">) {
  return tenant.resolved && tenant.gymId ? tenant.gymId : context.profile?.gym_id ?? null;
}

export function requireApiTenantGymScope(context: Pick<AuthContext, "primaryRole" | "profile">, tenant: Pick<TenantContext, "resolved" | "gymId">) {
  const gymId = getApiTenantGymId(context, tenant);

  if (context.primaryRole !== "super_admin" && !gymId) {
    return {
      ok: false as const,
      response: apiError("TENANT_SCOPE_REQUIRED", "This request requires a tenant gym scope for your role.", 403)
    };
  }

  return {
    ok: true as const,
    gymId
  };
}

export function getApiTenantOrganizationId(context: Pick<AuthContext, "organizationId">, tenant: Pick<TenantContext, "resolved" | "organizationId">) {
  return tenant.resolved && tenant.organizationId ? tenant.organizationId : context.organizationId ?? null;
}

export function getApiTenantBranchId(tenant: Pick<TenantContext, "resolved" | "branch">) {
  return tenant.resolved ? tenant.branch.id : null;
}
