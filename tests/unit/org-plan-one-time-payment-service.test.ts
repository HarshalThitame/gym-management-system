import { describe, expect, it } from "vitest";
import {
  getOrgPlanOneTimeCheckoutExpiresAt,
  isOrgPlanOneTimeCheckoutExpired,
  ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS,
} from "@/features/billing/services/org-plan-one-time-payment-utils";

describe("org plan one-time checkout TTL", () => {
  it("expires pending checkouts after 30 minutes", () => {
    const createdAt = new Date("2026-07-18T10:00:00.000Z");
    const expiresAt = getOrgPlanOneTimeCheckoutExpiresAt(createdAt);

    expect(expiresAt.toISOString()).toBe("2026-07-18T10:30:00.000Z");
    expect(ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS).toBe(30 * 60 * 1000);
  });

  it("treats timestamps at or beyond the TTL as expired", () => {
    const createdAt = new Date("2026-07-18T10:00:00.000Z");
    expect(isOrgPlanOneTimeCheckoutExpired(createdAt, new Date("2026-07-18T10:29:59.999Z"))).toBe(false);
    expect(isOrgPlanOneTimeCheckoutExpired(createdAt, new Date("2026-07-18T10:30:00.000Z"))).toBe(true);
    expect(isOrgPlanOneTimeCheckoutExpired(createdAt, new Date("2026-07-18T10:45:00.000Z"))).toBe(true);
  });
});
