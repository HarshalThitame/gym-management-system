import { describe, expect, it } from "vitest";
import {
  buildTenantDomainDnsInstructions,
  buildTenantDomainTxtHost,
  buildTenantDomainTxtValue,
  domainStatusTone,
  matchesDnsValue
} from "@/features/enterprise/lib/domain-rules";
import type { TenantDomainRow } from "@/types/enterprise";

function domain(input: Partial<TenantDomainRow>): TenantDomainRow {
  return {
    id: "domain_1",
    organization_id: "org_1",
    branch_id: null,
    gym_id: "gym_1",
    tenant_config_id: "config_1",
    domain: "ExampleGym.com",
    normalized_domain: "examplegym.com",
    domain_type: "custom_domain",
    routing_mode: "organization",
    status: "pending",
    is_primary: true,
    ssl_status: "pending",
    verification_token: "token123",
    verified_at: null,
    last_checked_at: null,
    metadata: {},
    created_by: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...input
  };
}

describe("tenant domain DNS rules", () => {
  it("builds Vercel routing records and ownership TXT for custom domains", () => {
    const records = buildTenantDomainDnsInstructions(domain({}));

    expect(records).toEqual([
      { type: "A", host: "examplegym.com", value: "76.76.21.21", purpose: "routing", required: false },
      { type: "CNAME", host: "examplegym.com", value: "cname.vercel-dns.com", purpose: "routing", required: false },
      { type: "TXT", host: "_apex-tenant-verification.examplegym.com", value: "apex-tenant=token123", purpose: "ownership", required: true }
    ]);
  });

  it("does not require ownership TXT for system domains", () => {
    const records = buildTenantDomainDnsInstructions(domain({ domain_type: "system", domain: "apexgymmanagementsystem.vercel.app" }));

    expect(records.map((record) => record.type)).toEqual(["A", "CNAME"]);
  });

  it("treats Vercel app domains as system-managed even when legacy rows are marked custom", () => {
    const records = buildTenantDomainDnsInstructions(domain({ domain_type: "custom_domain", domain: "apexgymmanagementsystem.vercel.app" }));

    expect(records.map((record) => record.type)).toEqual(["A", "CNAME"]);
  });

  it("normalizes TXT host and value consistently", () => {
    expect(buildTenantDomainTxtHost("https://www.ExampleGym.com/path")).toBe("_apex-tenant-verification.examplegym.com");
    expect(buildTenantDomainTxtValue("abc")).toBe("apex-tenant=abc");
    expect(matchesDnsValue("cname.vercel-dns.com.", "CNAME.VERCEL-DNS.COM")).toBe(true);
  });

  it("maps domain status to operational tones", () => {
    expect(domainStatusTone("verified", "managed_by_vercel")).toBe("good");
    expect(domainStatusTone("pending", "pending")).toBe("watch");
    expect(domainStatusTone("failed", "failed")).toBe("risk");
    expect(domainStatusTone("disabled", "not_applicable")).toBe("neutral");
  });
});
