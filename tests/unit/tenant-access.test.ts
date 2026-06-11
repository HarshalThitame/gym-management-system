import { describe, expect, it } from "vitest";
import { getApiTenantBranchId, getApiTenantGymId, getApiTenantOrganizationId } from "@/lib/auth/api-guards";
import { canAccessResolvedTenant } from "@/lib/tenant/access";
import type { AuthContext } from "@/types/auth";
import type { TenantContext } from "@/lib/tenant/context";

function authContext(input: Partial<AuthContext>): AuthContext {
  return {
    userId: "user_1",
    email: "member@example.com",
    profile: {
      id: "user_1",
      gym_id: "gym_1",
      full_name: "Member",
      email: "member@example.com",
      phone: null,
      avatar_url: null,
      status: "active",
      emergency_contact_name: null,
      emergency_contact_phone: null
    },
    organizationId: "org_1",
    roles: ["member"],
    primaryRole: "member",
    isAuthenticated: true,
    isActive: true,
    ...input
  };
}

function tenantContext(input: Partial<TenantContext>): TenantContext {
  return {
    resolved: true,
    source: "middleware",
    organizationId: "org_1",
    organizationName: "Apex Group",
    gymId: "gym_1",
    gymName: "Apex Performance Club",
    tenantConfigId: "tenant_config_1",
    tenantKey: "apex-performance-club",
    domain: "apexgymmanagementsystem.vercel.app",
    domainType: "system",
    routingMode: "branch",
    planTier: "enterprise",
    brand: {
      name: "Apex Performance Club",
      shortName: "AP",
      initial: "A",
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null
    },
    branch: {
      id: "branch_1",
      name: "Baner Flagship",
      code: "APX-BANER",
      phone: null,
      email: null,
      address: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
      timezone: null,
      currency: null
    },
    ...input
  };
}

describe("tenant access enforcement", () => {
  it("allows access when the user profile gym matches the resolved tenant gym", () => {
    expect(canAccessResolvedTenant(authContext({}), tenantContext({}))).toBe(true);
  });

  it("allows organization owners to access branches across their organization", () => {
    expect(canAccessResolvedTenant(authContext({ organizationId: "org_1", roles: ["organization_owner"], primaryRole: "organization_owner" }), tenantContext({ gymId: "gym_2", organizationId: "org_1" }))).toBe(true);
  });

  it("denies same-organization cross-branch access for non-owner tenant roles", () => {
    expect(canAccessResolvedTenant(authContext({ organizationId: "org_1" }), tenantContext({ gymId: "gym_2", organizationId: "org_1" }))).toBe(false);
  });

  it("denies access to a different resolved tenant", () => {
    expect(canAccessResolvedTenant(authContext({ organizationId: "org_1" }), tenantContext({ gymId: "gym_2", organizationId: "org_2" }))).toBe(false);
  });

  it("allows super admins to access every tenant", () => {
    expect(canAccessResolvedTenant(authContext({ roles: ["super_admin"], primaryRole: "super_admin" }), tenantContext({ gymId: "gym_2", organizationId: "org_2" }))).toBe(true);
  });

  it("allows unresolved tenant fallback so local development and unknown public hosts still render", () => {
    expect(canAccessResolvedTenant(authContext({ organizationId: null }), tenantContext({ resolved: false, organizationId: null, gymId: null }))).toBe(true);
  });

  it("uses resolved tenant scope for API route data when a tenant domain is known", () => {
    const context = authContext({ profile: { ...authContext({}).profile!, gym_id: "gym_profile" }, organizationId: "org_profile" });
    const tenant = tenantContext({ gymId: "gym_domain", organizationId: "org_domain", branch: { ...tenantContext({}).branch, id: "branch_domain" } });

    expect(getApiTenantGymId(context, tenant)).toBe("gym_domain");
    expect(getApiTenantOrganizationId(context, tenant)).toBe("org_domain");
    expect(getApiTenantBranchId(tenant)).toBe("branch_domain");
  });

  it("falls back to the authenticated profile scope when no tenant domain is resolved", () => {
    const context = authContext({ profile: { ...authContext({}).profile!, gym_id: "gym_profile" }, organizationId: "org_profile" });
    const tenant = tenantContext({ resolved: false, gymId: null, organizationId: null });

    expect(getApiTenantGymId(context, tenant)).toBe("gym_profile");
    expect(getApiTenantOrganizationId(context, tenant)).toBe("org_profile");
    expect(getApiTenantBranchId(tenant)).toBeNull();
  });
});
