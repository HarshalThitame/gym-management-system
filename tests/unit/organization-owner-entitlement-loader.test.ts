import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertUserBelongsToOrganizationMock,
  getOrganizationEntitlementsMock,
  getOrgFeatureFlagsMock,
} = vi.hoisted(() => ({
  assertUserBelongsToOrganizationMock: vi.fn(),
  getOrganizationEntitlementsMock: vi.fn(),
  getOrgFeatureFlagsMock: vi.fn(),
}));

vi.mock("@/features/entitlement", () => ({
  assertUserBelongsToOrganization: assertUserBelongsToOrganizationMock,
  getOrganizationEntitlements: getOrganizationEntitlementsMock,
}));

vi.mock("@/lib/tenant/feature-resolver", () => ({
  getOrgFeatureFlags: getOrgFeatureFlagsMock,
}));

import { getEntitlementSummaryAction } from "@/features/organization-owner/entitlements/entitlement-loader";

describe("organization owner entitlement loader", () => {
  beforeEach(() => {
    assertUserBelongsToOrganizationMock.mockReset();
    getOrganizationEntitlementsMock.mockReset();
    getOrgFeatureFlagsMock.mockReset();
  });

  it("validates tenant ownership before returning entitlement data", async () => {
    assertUserBelongsToOrganizationMock.mockRejectedValue(new Error("forbidden"));

    await expect(getEntitlementSummaryAction("org-2")).rejects.toThrow("forbidden");
    expect(getOrganizationEntitlementsMock).not.toHaveBeenCalled();
  });

  it("returns resolved org feature flags alongside canonical plan data", async () => {
    assertUserBelongsToOrganizationMock.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      roles: ["organization_owner"],
      primaryRole: "organization_owner",
      isSuperAdmin: false,
    });
    getOrganizationEntitlementsMock.mockResolvedValue({
      organizationId: "org-1",
      subscriptionId: "sub-1",
      packageId: "pkg-1",
      packageName: "Growth",
      subscriptionStatus: "active",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-12-31T00:00:00Z",
      activeFeatureKeys: ["member_management"],
      limits: { max_members: 100 },
      isActive: true,
      isExpired: false,
      isScheduled: false,
      isCancelled: false,
      reason: null,
      message: null,
      warnings: [],
    });
    getOrgFeatureFlagsMock.mockResolvedValue({
      memberManagement: true,
      maxMembers: 100,
    });

    await expect(getEntitlementSummaryAction("org-1")).resolves.toMatchObject({
      organizationId: "org-1",
      plan: {
        packageId: "pkg-1",
        name: "Growth",
        status: "active",
      },
      features: {
        active: ["member_management"],
      },
      limits: { max_members: 100 },
      allFeatures: {
        memberManagement: true,
        maxMembers: 100,
      },
    });
  });
});
