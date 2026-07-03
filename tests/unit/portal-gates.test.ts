import { describe, expect, it } from "vitest";
import {
  buildPortalNavFromEntitlements,
  canAccessPortalHref,
  getPortalRouteGate,
  validatePortalRegistryFeatureKeys,
} from "@/features/entitlement";
import { normalizePackageTier } from "@/features/entitlement/package-tier";
import { scanPortalFilesForLegacyFeatureChecks, validatePortalGateRegistry } from "@/features/entitlement/portal-gate-validator";

describe("portal entitlement gates", () => {
  it("filters non-owner nav items from canonical entitlements", () => {
    const navItems = buildPortalNavFromEntitlements("member", ["class_booking", "goal_tracking"]);

    expect(navItems.map((item) => item.href)).toEqual([
      "/member",
      "/member/membership",
      "/member/payments",
      "/member/attendance",
      "/member/classes",
      "/member/fitness",
      "/member/profile",
      "/member/settings",
      "/member/survey",
    ]);
  });

  it("maps direct routes to portal feature gates", () => {
    expect(getPortalRouteGate("trainer", "/trainer/ai")).toMatchObject({
      featureKey: "ai_recommendations",
      visibilityMode: "hidden_if_locked",
    });
    expect(getPortalRouteGate("gym-admin", "/admin/members/new")).toMatchObject({
      featureKey: "member_management",
    });
  });

  it("checks href access using canonical feature keys", () => {
    expect(canAccessPortalHref("reception", "/reception/payments", ["billing_invoices"])).toBe(true);
    expect(canAccessPortalHref("reception", "/reception/payments", [])).toBe(false);
  });

  it("normalizes legacy middle-tier plan names to growth", () => {
    expect(normalizePackageTier("professional")).toBe("growth");
    expect(normalizePackageTier("standard")).toBe("growth");
    expect(normalizePackageTier("growth")).toBe("growth");
  });

  it("validates registry keys and route coverage", () => {
    expect(validatePortalRegistryFeatureKeys()).toBe(true);
    expect(validatePortalGateRegistry()).toEqual({ valid: true, errors: [] });
  });

  it("flags remaining legacy feature-check files for follow-up", () => {
    const legacyHits = scanPortalFilesForLegacyFeatureChecks();

    expect(legacyHits).not.toContain("app/(member)/member/ai-coach/page.tsx");
    expect(legacyHits).not.toContain("app/(trainer)/trainer/ai/page.tsx");
  });
});
