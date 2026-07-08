import { describe, expect, it } from "vitest";
import { resolveUnauthorizedReason } from "@/lib/auth/unauthorized-state";

describe("unauthorized state resolution", () => {
  it("keeps explicit subscription reasons intact", () => {
    expect(resolveUnauthorizedReason("subscription_cancelled", null)).toBe("subscription_cancelled");
    expect(resolveUnauthorizedReason("subscription_suspended", null)).toBe("subscription_suspended");
  });

  it("uses live subscription status when the query reason is missing", () => {
    expect(resolveUnauthorizedReason(undefined, "cancelled")).toBe("subscription_cancelled");
    expect(resolveUnauthorizedReason(null, "suspended")).toBe("subscription_suspended");
  });

  it("falls back to access pending when there is no subscription context", () => {
    expect(resolveUnauthorizedReason(undefined, null)).toBe("access_pending");
  });
});
