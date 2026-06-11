import { describe, expect, it } from "vitest";
import { TenantDomainLifecycleSchema, TenantDomainSchema } from "@/features/enterprise/schemas/enterprise";

const baseDomain = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  branchId: "",
  gymId: "",
  tenantConfigId: "",
  domain: "branch.apexfit.com",
  domainType: "custom_domain",
  routingMode: "organization",
  status: "pending",
  isPrimary: false
};

describe("tenant domain lifecycle schemas", () => {
  it("accepts an organization-scoped pending custom domain", () => {
    const parsed = TenantDomainSchema.safeParse(baseDomain);

    expect(parsed.success).toBe(true);
  });

  it("requires branch id for branch-routed domains", () => {
    const parsed = TenantDomainSchema.safeParse({ ...baseDomain, routingMode: "branch" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.branchId?.[0]).toBe("Select a branch for branch routing.");
  });

  it("does not allow system domains through admin onboarding", () => {
    const parsed = TenantDomainSchema.safeParse({ ...baseDomain, domainType: "system" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.domainType?.[0]).toBe("System domains are managed by deployment configuration.");
  });

  it("accepts only supported lifecycle actions", () => {
    expect(TenantDomainLifecycleSchema.safeParse({ tenantDomainId: "11111111-1111-4111-8111-111111111111", action: "set_primary" }).success).toBe(true);
    expect(TenantDomainLifecycleSchema.safeParse({ tenantDomainId: "11111111-1111-4111-8111-111111111111", action: "delete" }).success).toBe(false);
  });
});
