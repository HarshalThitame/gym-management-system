import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthContextMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthContext: getAuthContextMock,
}));

import {
  assertUserBelongsToOrganization,
} from "@/features/entitlement/auth-context";
import {
  EntitlementError,
  mapEntitlementErrorToHttpResponse,
} from "@/features/entitlement/entitlement-errors";
import { entitlementActionCatch } from "@/features/entitlement/action-guards";
import {
  evaluateEffectiveSubscription,
  evaluateFeatureAccess,
  type PackageInput,
  type SubscriptionInput,
} from "@/features/entitlement/entitlement-evaluate";
import type { FeatureKey } from "@/features/entitlement/feature-registry";

const activePackage: PackageInput = {
  id: "pkg-lite",
  name: "Lite",
  slug: "lite",
  isActive: true,
};

const activeSubscription: SubscriptionInput = {
  id: "sub-lite",
  organizationId: "org-a",
  packageId: "pkg-lite",
  status: "active",
  startedAt: "2026-01-01T00:00:00Z",
  expiresAt: "2026-12-31T23:59:59Z",
  trialEndsAt: null,
  cancelledAt: null,
  replacedAt: null,
  scheduledStartDate: null,
};

const effective = {
  effective: true,
  status: "active" as const,
  denialReason: null,
  message: null,
};

function authContext(roles: Array<"super_admin" | "organization_owner">, organizationId: string | null) {
  return {
    userId: "user-1",
    email: "owner@example.com",
    profile: null,
    organizationId,
    roles,
    primaryRole: roles[0] ?? null,
    isAuthenticated: true,
    isActive: true,
  };
}

describe("Phase 4 backend entitlement protection", () => {
  beforeEach(() => {
    getAuthContextMock.mockReset();
  });

  it("rejects a client-supplied cross-tenant organization ID", async () => {
    getAuthContextMock.mockResolvedValue(authContext(["organization_owner"], "org-a"));

    await expect(assertUserBelongsToOrganization("org-b")).rejects.toMatchObject({
      reason: "UNAUTHORIZED_ORG_ACCESS",
      organizationId: "org-b",
      statusCode: 403,
    });
  });

  it("allows Super Admin membership bypass without changing platform route entitlements", async () => {
    getAuthContextMock.mockResolvedValue(authContext(["super_admin"], null));

    await expect(assertUserBelongsToOrganization("org-b")).resolves.toMatchObject({
      userId: "user-1",
      organizationId: "org-b",
      isSuperAdmin: true,
    });
  });

  it("returns the required 403 API body for a locked feature", () => {
    const response = mapEntitlementErrorToHttpResponse(
      new EntitlementError("FEATURE_NOT_INCLUDED", "org-a", "lead_management"),
    );

    expect(response).toEqual({
      status: 403,
      body: {
        error: "FEATURE_LOCKED",
        reason: "FEATURE_NOT_INCLUDED",
        message: "This feature is not included in your current plan. Please upgrade to access it.",
        featureKey: "lead_management",
      },
    });
  });

  it("returns a typed server-action result instead of throwing", () => {
    const result = entitlementActionCatch(
      { status: "idle", message: "" },
      new EntitlementError("FEATURE_NOT_INCLUDED", "org-a", "lead_management"),
      "Lead creation failed.",
    );

    expect(result).toMatchObject({
      status: "error",
      success: false,
      error: "FEATURE_LOCKED",
      reason: "FEATURE_NOT_INCLUDED",
      featureKey: "lead_management",
    });
  });

  it("allows Lite member operations but denies CRM", () => {
    const features: FeatureKey[] = ["member_management", "manual_attendance"];
    expect(evaluateFeatureAccess("member_management", effective, features, activePackage).allowed).toBe(true);
    expect(evaluateFeatureAccess("lead_management", effective, features, activePackage)).toMatchObject({
      allowed: false,
      reason: "FEATURE_NOT_INCLUDED",
    });
  });

  it("requires the advanced attendance feature in addition to base attendance", () => {
    const features: FeatureKey[] = ["manual_attendance"];
    expect(evaluateFeatureAccess("qr_attendance", effective, features, activePackage)).toMatchObject({
      allowed: false,
      reason: "FEATURE_NOT_INCLUDED",
    });
    expect(evaluateFeatureAccess("biometric_attendance", effective, features, activePackage)).toMatchObject({
      allowed: false,
      reason: "FEATURE_NOT_INCLUDED",
    });
  });

  it("denies expired, scheduled, and replaced subscriptions", () => {
    const now = new Date("2026-06-18T12:00:00Z").getTime();
    expect(evaluateEffectiveSubscription({ ...activeSubscription, status: "expired" }, now).denialReason).toBe("PLAN_EXPIRED");
    expect(evaluateEffectiveSubscription({
      ...activeSubscription,
      status: "scheduled",
      scheduledStartDate: "2026-07-01T00:00:00Z",
    }, now).denialReason).toBe("PLAN_NOT_STARTED");
    expect(evaluateEffectiveSubscription({ ...activeSubscription, status: "replaced" }, now).denialReason).toBe("PLAN_REPLACED");
  });

  it("keeps SaaS purchase, verification, and webhook flows free of package feature guards", () => {
    const exemptFiles = [
      "features/subscription/razorpay-order-action.ts",
      "features/subscription/razorpay-verify-action.ts",
      "app/api/webhooks/razorpay/route.ts",
      "features/super-admin/actions/package-management-actions.ts",
    ];

    for (const file of exemptFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/require(?:Organization|Api)?FeatureAccess/);
    }
  });
});
