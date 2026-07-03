import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOrganizationEntitlementsMock,
  checkFeatureAccessMock,
  canCreateResourceMock,
  writeAuditLogMock,
} = vi.hoisted(() => ({
  getOrganizationEntitlementsMock: vi.fn(),
  checkFeatureAccessMock: vi.fn(),
  canCreateResourceMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/features/entitlement", () => ({
  getOrganizationEntitlements: getOrganizationEntitlementsMock,
  checkFeatureAccess: checkFeatureAccessMock,
  canCreateResource: canCreateResourceMock,
  isFeatureKey: (value: string) => value === "lead_management" || value === "member_management",
  isLimitKey: (value: string) => value === "max_members",
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

import {
  checkSubscriptionStatus,
  requireFeature,
  requireWithinLimit,
} from "@/lib/tenant/subscription-guard";

function activeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    subscriptionId: "sub-1",
    packageId: "pkg-1",
    packageName: "Growth",
    subscriptionStatus: "active",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    activeFeatureKeys: ["member_management", "lead_management"],
    limits: { max_members: 10 },
    isActive: true,
    isExpired: false,
    isScheduled: false,
    isCancelled: false,
    reason: null,
    message: null,
    warnings: [],
    ...overrides,
  };
}

describe("subscription-guard canonical adapters", () => {
  beforeEach(() => {
    getOrganizationEntitlementsMock.mockReset();
    checkFeatureAccessMock.mockReset();
    canCreateResourceMock.mockReset();
    writeAuditLogMock.mockReset();
  });

  it("uses canonical snapshot for active subscription status", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(activeSnapshot());

    await expect(checkSubscriptionStatus("org-1")).resolves.toEqual({ ok: true, status: "active" });
  });

  it("returns canonical denial message for inactive subscriptions", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(activeSnapshot({
      isActive: false,
      subscriptionStatus: "suspended",
      reason: "PLAN_SUSPENDED",
      message: "Your subscription has been suspended.",
    }));

    await expect(checkSubscriptionStatus("org-1")).resolves.toMatchObject({
      ok: false,
      status: "suspended",
      error: "Your subscription has been suspended.",
    });
  });

  it("requires feature access through canonical entitlement checks", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(activeSnapshot());
    checkFeatureAccessMock.mockResolvedValue({
      allowed: false,
      reason: "FEATURE_NOT_INCLUDED",
      message: "Locked on current plan.",
    });

    await expect(requireFeature("org-1", "lead_management", "test-action")).resolves.toEqual({
      ok: false,
      error: "Locked on current plan.",
    });
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it("enforces resource limits through canonical limit checks", async () => {
    canCreateResourceMock.mockResolvedValue({
      allowed: false,
      limitKey: "max_members",
      currentUsage: 10,
      limitValue: 10,
      isUnlimited: false,
      remaining: 0,
      reason: "LIMIT_REACHED",
      message: "Your current plan allows only 10 members.",
    });

    await expect(requireWithinLimit("org-1", "max_members", 10)).resolves.toEqual({
      ok: false,
      error: "Your plan limits Max Members to 10. You currently have 10. Upgrade your plan to increase this limit.",
      limit: 10,
    });
  });
});
