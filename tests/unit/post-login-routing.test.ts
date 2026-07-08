import { describe, expect, it } from "vitest";
import { resolvePostLoginPath } from "@/lib/auth/post-login-routing";

describe("post-login routing", () => {
  it("routes cancelled organization owners to billing recovery instead of blocked org pages", () => {
    expect(resolvePostLoginPath("/organization", "/organization", {
      isOrganizationOwner: true,
      subscriptionStatus: "cancelled",
    })).toBe("/organization/plan");
  });

  it("allows cancelled owners to keep the billing plan page as the destination", () => {
    expect(resolvePostLoginPath("/organization/plan", "/organization", {
      isOrganizationOwner: true,
      subscriptionStatus: "cancelled",
    })).toBe("/organization/plan");
  });

  it("keeps active owners on their requested destination", () => {
    expect(resolvePostLoginPath("/organization/settings", "/organization", {
      isOrganizationOwner: true,
      subscriptionStatus: "active",
    })).toBe("/organization/settings");
  });

  it("preserves suspended owners as an explicit access state", () => {
    expect(resolvePostLoginPath("/organization", "/organization", {
      isOrganizationOwner: true,
      subscriptionStatus: "suspended",
    })).toBe("/unauthorized?reason=subscription_suspended");
  });
});
