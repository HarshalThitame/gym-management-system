import { describe, expect, it } from "vitest";

import {
  evaluateEffectiveSubscription,
  evaluateFeatureAccess,
  evaluateEntitlementSnapshot,
  type SubscriptionInput,
  type PackageInput,
} from "@/features/entitlement/entitlement-evaluate";
import type { FeatureKey } from "@/features/entitlement/feature-registry";
import {
  EntitlementError,
  entitlementUserMessage,
  entitlementHttpStatusCode,
} from "@/features/entitlement/entitlement-errors";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSub(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
    id: "sub-1",
    organizationId: "org-1",
    packageId: "pkg-1",
    status: "active",
    startedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2026-12-31T23:59:59Z",
    trialEndsAt: null,
    cancelledAt: null,
    replacedAt: null,
    scheduledStartDate: null,
    ...overrides,
  };
}

const PKG: PackageInput = {
  id: "pkg-1",
  name: "Growth",
  slug: "growth",
  isActive: true,
};

const GROWTH_FEATURES: FeatureKey[] = [
  "member_management",
  "trainer_management",
  "class_booking",
  "qr_attendance",
  "manual_attendance",
  "attendance_reports",
  "billing_invoices",
  "lead_management",
  "basic_reports",
  "advanced_reports",
];

const BILLING_ONLY_FEATURES: FeatureKey[] = [
  ...GROWTH_FEATURES,
  "receipts",
];

const NOW = new Date("2026-06-18T12:00:00Z").getTime();
const FUTURE = "2026-12-31T23:59:59Z";
const PAST = "2026-01-01T00:00:00Z";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Entitlement resolver — effective subscription", () => {
  it("1. No subscription → not effective, NO_SUBSCRIPTION", () => {
    const result = evaluateEffectiveSubscription(null, NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("NO_SUBSCRIPTION");
  });

  it("2. Active subscription with future expiry → effective", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "active", expiresAt: FUTURE }), NOW);
    expect(result.effective).toBe(true);
    expect(result.denialReason).toBeNull();
  });

  it("3. Active subscription with null expiry → effective (never expires)", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "active", expiresAt: null }), NOW);
    expect(result.effective).toBe(true);
  });

  it("4. Active subscription with past expiry → denied, PLAN_EXPIRED", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "active", expiresAt: PAST }), NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_EXPIRED");
  });

  it("5. Trial with future trial end → effective", () => {
    const result = evaluateEffectiveSubscription(
      makeSub({ status: "trial", trialEndsAt: FUTURE, expiresAt: null }),
      NOW,
    );
    expect(result.effective).toBe(true);
  });

  it("6. Trial with past trial end → denied, PLAN_EXPIRED", () => {
    const result = evaluateEffectiveSubscription(
      makeSub({ status: "trial", trialEndsAt: PAST, expiresAt: null }),
      NOW,
    );
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_EXPIRED");
  });

  it("7. Cancelled subscription → denied immediately (Phase 2 cancel-immediate)", () => {
    const result = evaluateEffectiveSubscription(
      makeSub({ status: "cancelled", cancelledAt: "2026-06-15T00:00:00Z", expiresAt: FUTURE }),
      NOW,
    );
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_CANCELLED");
  });

  it("8. Suspended subscription → denied", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "suspended" }), NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_SUSPENDED");
  });

  it("9. Expired subscription → denied", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "expired" }), NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_EXPIRED");
  });

  it("10. Replaced subscription → denied", () => {
    const result = evaluateEffectiveSubscription(
      makeSub({ status: "replaced", replacedAt: "2026-06-10T00:00:00Z" }),
      NOW,
    );
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_REPLACED");
  });

  it("11. Payment failed → denied, PAYMENT_REQUIRED", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "payment_failed" }), NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PAYMENT_REQUIRED");
  });

  it("12. Payment pending → denied, PAYMENT_REQUIRED", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "payment_pending" }), NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PAYMENT_REQUIRED");
  });

  it("13. Pending activation → denied, PLAN_NOT_STARTED", () => {
    const result = evaluateEffectiveSubscription(makeSub({ status: "pending_activation" }), NOW);
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_NOT_STARTED");
  });

  it("14. Scheduled with future start date → denied, PLAN_NOT_STARTED", () => {
    const result = evaluateEffectiveSubscription(
      makeSub({ status: "scheduled", scheduledStartDate: FUTURE }),
      NOW,
    );
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_NOT_STARTED");
  });

  it("15. Scheduled with past start date → denied (must be activated by cron)", () => {
    const result = evaluateEffectiveSubscription(
      makeSub({ status: "scheduled", scheduledStartDate: PAST }),
      NOW,
    );
    expect(result.effective).toBe(false);
    expect(result.denialReason).toBe("PLAN_NOT_STARTED");
  });
});

describe("Entitlement resolver — feature access", () => {
  const effective = { effective: true, status: "active" as const, denialReason: null, message: null };
  const notEffective = { effective: false, status: "expired" as const, denialReason: "PLAN_EXPIRED" as const, message: "expired" };

  it("allows feature included in package when subscription is effective", () => {
    const result = evaluateFeatureAccess("member_management", effective, GROWTH_FEATURES, PKG);
    expect(result.allowed).toBe(true);
  });

  it("denies feature NOT included in package → FEATURE_NOT_INCLUDED", () => {
    const result = evaluateFeatureAccess("custom_branding", effective, GROWTH_FEATURES, PKG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("FEATURE_NOT_INCLUDED");
  });

  it("denies all features when subscription is not effective", () => {
    const result = evaluateFeatureAccess("member_management", notEffective, GROWTH_FEATURES, PKG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("PLAN_EXPIRED");
  });

  it("allows cancelled subscriptions to keep billing-management features only", () => {
    const cancelled = evaluateEffectiveSubscription(
      makeSub({ status: "cancelled", cancelledAt: "2026-06-15T00:00:00Z", expiresAt: FUTURE }),
      NOW,
    );

    expect(cancelled.effective).toBe(false);
    expect(evaluateFeatureAccess("billing_invoices", cancelled, BILLING_ONLY_FEATURES, PKG)).toMatchObject({
      allowed: true,
      reason: null,
    });
    expect(evaluateFeatureAccess("receipts", cancelled, BILLING_ONLY_FEATURES, PKG)).toMatchObject({
      allowed: true,
      reason: null,
    });
    expect(evaluateFeatureAccess("member_management", cancelled, BILLING_ONLY_FEATURES, PKG)).toMatchObject({
      allowed: false,
      reason: "PLAN_CANCELLED",
    });
  });

  it("denies unknown feature key → FEATURE_UNKNOWN", () => {
    const result = evaluateFeatureAccess("nonexistent_feature" as FeatureKey, effective, GROWTH_FEATURES, PKG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("FEATURE_UNKNOWN");
  });

  it("denies feature when package is archived/inactive → FEATURE_DISABLED", () => {
    const archivedPkg: PackageInput = { ...PKG, isActive: false };
    const result = evaluateFeatureAccess("member_management", effective, GROWTH_FEATURES, archivedPkg);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("FEATURE_DISABLED");
  });

  it("does not merge features from non-effective subscriptions", () => {
    // When subscription is not effective, activeFeatureKeys should be empty
    // regardless of what packageFeatureKeys were passed.
    const snapshot = evaluateEntitlementSnapshot({
      organizationId: "org-1",
      subscription: makeSub({ status: "expired" }),
      package: PKG,
      packageFeatureKeys: GROWTH_FEATURES,
      packageLimits: { max_members: 500 },
    });
    expect(snapshot.isActive).toBe(false);
    expect(snapshot.activeFeatureKeys).toEqual([]);
    expect(snapshot.limits).toEqual({});
  });
});

describe("Entitlement resolver — snapshot", () => {
  it("produces full snapshot for active subscription", () => {
    const snapshot = evaluateEntitlementSnapshot({
      organizationId: "org-1",
      subscription: makeSub({ status: "active", expiresAt: FUTURE }),
      package: PKG,
      packageFeatureKeys: GROWTH_FEATURES,
      packageLimits: { max_members: 500, max_branches: 10 },
    });
    expect(snapshot.isActive).toBe(true);
    expect(snapshot.isExpired).toBe(false);
    expect(snapshot.isScheduled).toBe(false);
    expect(snapshot.packageName).toBe("Growth");
    expect(snapshot.activeFeatureKeys).toEqual(GROWTH_FEATURES);
    expect(snapshot.limits.max_members).toBe(500);
    expect(snapshot.reason).toBeNull();
  });

  it("produces empty snapshot for no subscription", () => {
    const snapshot = evaluateEntitlementSnapshot({
      organizationId: "org-1",
      subscription: null,
      package: null,
      packageFeatureKeys: [],
      packageLimits: {},
    });
    expect(snapshot.isActive).toBe(false);
    expect(snapshot.subscriptionStatus).toBe("none");
    expect(snapshot.activeFeatureKeys).toEqual([]);
    expect(snapshot.reason).toBe("NO_SUBSCRIPTION");
  });

  it("produces denied snapshot for cancelled subscription", () => {
    const snapshot = evaluateEntitlementSnapshot({
      organizationId: "org-1",
      subscription: makeSub({ status: "cancelled" }),
      package: PKG,
      packageFeatureKeys: GROWTH_FEATURES,
      packageLimits: { max_members: 500 },
    });
    expect(snapshot.isActive).toBe(false);
    expect(snapshot.isCancelled).toBe(true);
    expect(snapshot.activeFeatureKeys).toEqual(["billing_invoices"]);
    expect(snapshot.limits).toEqual({});
    expect(snapshot.reason).toBe("PLAN_CANCELLED");
  });

  it("includes warnings in snapshot", () => {
    const snapshot = evaluateEntitlementSnapshot({
      organizationId: "org-1",
      subscription: makeSub({ status: "active", expiresAt: FUTURE }),
      package: PKG,
      packageFeatureKeys: GROWTH_FEATURES,
      packageLimits: {},
      warnings: ["duplicate subscription detected"],
    });
    expect(snapshot.warnings).toContain("duplicate subscription detected");
  });
});

describe("Entitlement error helpers", () => {
  it("EntitlementError carries reason, orgId, featureKey, statusCode", () => {
    const err = new EntitlementError("PLAN_EXPIRED", "org-1", "member_management");
    expect(err.name).toBe("EntitlementError");
    expect(err.reason).toBe("PLAN_EXPIRED");
    expect(err.organizationId).toBe("org-1");
    expect(err.featureKey).toBe("member_management");
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain("expired");
  });

  it("returns correct user messages for each denied reason", () => {
    expect(entitlementUserMessage("NO_SUBSCRIPTION")).toContain("active subscription");
    expect(entitlementUserMessage("PLAN_EXPIRED")).toContain("expired");
    expect(entitlementUserMessage("PLAN_CANCELLED")).toContain("cancelled");
    expect(entitlementUserMessage("PLAN_SUSPENDED")).toContain("suspended");
    expect(entitlementUserMessage("PLAN_NOT_STARTED")).toContain("not started");
    expect(entitlementUserMessage("PLAN_REPLACED")).toContain("replaced");
    expect(entitlementUserMessage("PAYMENT_REQUIRED")).toContain("Payment is required");
    expect(entitlementUserMessage("FEATURE_NOT_INCLUDED")).toContain("upgrade");
    expect(entitlementUserMessage("FEATURE_UNKNOWN")).toContain("not recognized");
    expect(entitlementUserMessage("UNAUTHORIZED_ORG_ACCESS")).toContain("do not have access");
  });

  it("returns correct HTTP status codes", () => {
    expect(entitlementHttpStatusCode("NO_SUBSCRIPTION")).toBe(402);
    expect(entitlementHttpStatusCode("PAYMENT_REQUIRED")).toBe(402);
    expect(entitlementHttpStatusCode("UNAUTHORIZED_ORG_ACCESS")).toBe(403);
    expect(entitlementHttpStatusCode("ORGANIZATION_NOT_FOUND")).toBe(404);
    expect(entitlementHttpStatusCode("FEATURE_NOT_INCLUDED")).toBe(403);
  });
});
