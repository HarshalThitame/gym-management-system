import "server-only";

import { NextResponse } from "next/server";
import { requireOrganizationFeatureAccess } from "./action-guards";
import { EntitlementError, isEntitlementError, mapEntitlementErrorToHttpResponse } from "./entitlement-errors";
import type { FeatureKey } from "./feature-registry";

// ─── API route guard ───────────────────────────────────────────────────────

/**
 * Guard for API routes. Combines tenant safety + feature entitlement.
 * Returns null on success, or a NextResponse (403/402) on denial.
 *
 * Usage:
 *   const denied = await requireApiFeatureAccess(orgId, "member_management");
 *   if (denied) return denied;
 *
 * Super Admin bypasses the org membership check (but NOT the feature check
 * — super-admin routes don't typically need feature access; if they do,
 * call requireFeatureAccess separately).
 */
export async function requireApiFeatureAccess(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<NextResponse | null> {
  try {
    await requireOrganizationFeatureAccess({
      organizationId,
      featureKey,
      actionName: "api_request",
    });
    return null;
  } catch (error) {
    if (isEntitlementError(error)) {
      const { status, body } = mapEntitlementErrorToHttpResponse(error);
      return NextResponse.json(body, { status });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Multi-feature API guard: requires ALL listed features.
 */
export async function requireApiFeatureAccessAll(
  organizationId: string,
  featureKeys: FeatureKey[],
): Promise<NextResponse | null> {
  try {
    await requireOrganizationFeatureAccess({
      organizationId,
      featureKey: featureKeys,
      actionName: "api_request",
    });
    return null;
  } catch (error) {
    if (isEntitlementError(error)) {
      const { status, body } = mapEntitlementErrorToHttpResponse(error);
      return NextResponse.json(body, { status });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── API entitlement error response helper ─────────────────────────────────

/**
 * Wraps an API handler with entitlement error catching.
 * If the handler throws an EntitlementError, returns a clean 403/402 response.
 */
export function withEntitlementErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (isEntitlementError(error)) {
        const { status, body } = mapEntitlementErrorToHttpResponse(error);
        return NextResponse.json(body, { status });
      }
      throw error;
    }
  };
}

export { EntitlementError, isEntitlementError };
