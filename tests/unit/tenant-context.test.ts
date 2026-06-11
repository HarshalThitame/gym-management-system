import { describe, expect, it } from "vitest";
import { getTenantContextFromHeaders } from "@/lib/tenant/context";
import { clearTenantHeaders, tenantHeaderNames, writeTenantHeaders } from "@/lib/tenant/header-protocol";
import { buildTenantSiteConfig } from "@/lib/tenant/site";

describe("tenant request context", () => {
  it("clears spoofed tenant headers before trusted middleware values are written", () => {
    const headers = new Headers({
      [tenantHeaderNames.resolved]: "true",
      [tenantHeaderNames.organizationId]: "spoofed",
      [tenantHeaderNames.brandName]: "Spoofed Gym"
    });

    clearTenantHeaders(headers);

    expect(headers.get(tenantHeaderNames.resolved)).toBeNull();
    expect(headers.get(tenantHeaderNames.organizationId)).toBeNull();
    expect(headers.get(tenantHeaderNames.brandName)).toBeNull();
  });

  it("builds tenant context from trusted request headers", () => {
    const headers = new Headers();

    writeTenantHeaders(headers, {
      resolved: "true",
      organizationId: "org_1",
      organizationName: "Apex Group",
      branchId: "branch_1",
      branchName: "Baner Flagship",
      gymId: "gym_1",
      gymName: "Apex Performance Club",
      tenantKey: "apex-performance-club",
      domain: "apexgymmanagementsystem.vercel.app",
      brandName: "Apex Performance Club",
      accentColor: "#c8f24a",
      branchPhone: "+91 98765 43210",
      branchEmail: "hello@apex.test",
      branchAddress: "Level 2",
      branchCity: "Pune",
      branchState: "Maharashtra",
      branchCountry: "IN"
    });

    const context = getTenantContextFromHeaders(headers);

    expect(context?.resolved).toBe(true);
    expect(context?.source).toBe("middleware");
    expect(context?.brand.shortName).toBe("AP");
    expect(context?.branch.name).toBe("Baner Flagship");
    expect(context?.branch.city).toBe("Pune");
  });

  it("builds tenant-aware site config from request context", () => {
    const headers = new Headers();

    writeTenantHeaders(headers, {
      resolved: "true",
      brandName: "Northside Fitness",
      branchPhone: "+1 555 111 2222",
      branchEmail: "frontdesk@northside.example",
      branchAddress: "100 Market Street",
      branchCity: "Austin",
      branchState: "Texas",
      branchCountry: "US"
    });

    const context = getTenantContextFromHeaders(headers);
    expect(context).not.toBeNull();

    const site = buildTenantSiteConfig(context!);

    expect(site.name).toBe("Northside Fitness");
    expect(site.shortName).toBe("NF");
    expect(site.whatsapp).toBe("15551112222");
    expect(site.email).toBe("frontdesk@northside.example");
    expect(site.address).toContain("Austin");
  });
});
