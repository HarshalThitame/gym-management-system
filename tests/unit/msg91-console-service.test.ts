import { describe, expect, it } from "vitest";
import { isStale, makePreview } from "@/features/organization-owner/services/msg91-console-service";

describe("msg91-console-service", () => {
  it("truncates long previews deterministically", () => {
    expect(makePreview("  Hello   MSG91   console   with    extra spaces  ")).toBe("Hello MSG91 console with extra spaces");

    const longText = "A".repeat(160);
    expect(makePreview(longText)).toHaveLength(140);
    expect(makePreview(longText).endsWith("...")).toBe(true);
  });

  it("detects stale activity windows", () => {
    expect(isStale(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), 24)).toBe(true);
    expect(isStale(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), 24)).toBe(false);
  });
});

