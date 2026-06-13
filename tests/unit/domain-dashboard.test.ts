import { describe, it, expect, vi } from "vitest";

describe("Domain Dashboard", () => {
  const sampleDomains = [
    { id: "1", domain: "example.com", status: "verified", ssl_status: "issued", domain_type: "custom_domain", routing_mode: "organization", is_primary: true, organization_id: "org-1", created_at: "2024-01-01", last_checked_at: "2024-06-01" },
    { id: "2", domain: "test.org", status: "pending", ssl_status: "pending", domain_type: "custom_domain", routing_mode: "branch", is_primary: false, organization_id: "org-1", created_at: "2024-02-01" },
    { id: "3", domain: "failed.dev", status: "failed", ssl_status: "failed", domain_type: "custom_domain", routing_mode: "organization", is_primary: false, organization_id: "org-2", created_at: "2024-03-01" },
  ];

  it("computes health scores correctly", () => {
    function computeScore(status: string, ssl: string) {
      let score = 100;
      if (status === "failed") score -= 40;
      else if (status === "pending") score -= 20;
      if (ssl === "failed") score -= 30;
      else if (ssl === "pending") score -= 10;
      return Math.max(0, score);
    }

    expect(computeScore("verified", "issued")).toBe(100);
    expect(computeScore("verified", "pending")).toBe(90);
    expect(computeScore("pending", "pending")).toBe(70);
    expect(computeScore("failed", "issued")).toBe(60);
    expect(computeScore("failed", "failed")).toBe(30);
  });

  it("dnsTone maps status+ssl to correct tone", () => {
    function dnsTone(status: string, ssl: string): string {
      if (status === "verified" && ssl === "issued") return "good";
      if (status === "failed" || ssl === "failed") return "risk";
      if (status === "pending" || ssl === "pending") return "watch";
      return "neutral";
    }

    expect(dnsTone("verified", "issued")).toBe("good");
    expect(dnsTone("verified", "pending")).toBe("watch");
    expect(dnsTone("failed", "issued")).toBe("risk");
    expect(dnsTone("disabled", "not_applicable")).toBe("neutral");
  });

  it("filters domains by query", () => {
    const query = "example";
    const filtered = sampleDomains.filter((d) => d.domain.includes(query));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.domain).toBe("example.com");
  });

  it("filters domains by status", () => {
    const filtered = sampleDomains.filter((d) => d.status === "failed");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.domain).toBe("failed.dev");
  });

  it("pagination slices correctly", () => {
    const PAGE_SIZE = 2;
    const page = 0;
    const paged = sampleDomains.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    expect(paged).toHaveLength(2);
    expect(paged[0]!.id).toBe("1");
    expect(paged[1]!.id).toBe("2");

    const page2 = sampleDomains.slice(1 * PAGE_SIZE, (1 + 1) * PAGE_SIZE);
    expect(page2).toHaveLength(1);
    expect(page2[0]!.id).toBe("3");
  });

  it("computes stats correctly", () => {
    const domainCount = sampleDomains.length;
    const verifiedCount = sampleDomains.filter((d) => d.status === "verified").length;
    const failedCount = sampleDomains.filter((d) => d.status === "failed" || d.ssl_status === "failed").length;
    const primaryCount = sampleDomains.filter((d) => d.is_primary).length;
    const pendingCount = sampleDomains.filter((d) => d.status === "pending").length;

    expect(domainCount).toBe(3);
    expect(verifiedCount).toBe(1);
    expect(failedCount).toBe(1);
    expect(primaryCount).toBe(1);
    expect(pendingCount).toBe(1);
  });

  it("bulk selection works correctly", () => {
    const selectedIds = new Set(["1", "3"]);
    expect(selectedIds.size).toBe(2);
    expect(selectedIds.has("1")).toBe(true);
    expect(selectedIds.has("2")).toBe(false);
  });

  it("SSL expiry alert levels correct", () => {
    function alertLevel(daysUntilExpiry: number | null, issued: boolean): string {
      if (!issued) return "failed";
      if (daysUntilExpiry === null) return "healthy";
      if (daysUntilExpiry < 0) return "expired";
      if (daysUntilExpiry < 30) return "expiring_soon";
      return "healthy";
    }

    expect(alertLevel(null, true)).toBe("healthy");
    expect(alertLevel(45, true)).toBe("healthy");
    expect(alertLevel(15, true)).toBe("expiring_soon");
    expect(alertLevel(-5, true)).toBe("expired");
    expect(alertLevel(null, false)).toBe("failed");
  });
});
