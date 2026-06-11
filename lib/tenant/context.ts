import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { siteConfig } from "@/data/site";
import { normalizeDomain } from "@/features/enterprise/lib/business-rules";
import { resolveTenantByHost, type TenantResolution } from "@/features/enterprise/services/tenant-domain-service";
import { readTenantHeader } from "./header-protocol";

export type TenantBrand = {
  name: string;
  shortName: string;
  initial: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
};

export type TenantBranch = {
  id: string | null;
  name: string | null;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  timezone: string | null;
  currency: string | null;
};

export type TenantContext = {
  resolved: boolean;
  source: "middleware" | "server" | "fallback";
  organizationId: string | null;
  organizationName: string | null;
  gymId: string | null;
  gymName: string | null;
  tenantConfigId: string | null;
  tenantKey: string | null;
  domain: string | null;
  domainType: string | null;
  routingMode: string | null;
  planTier: string | null;
  brand: TenantBrand;
  branch: TenantBranch;
};

type HeaderLike = Pick<Headers, "get">;

export async function getTenantContext(): Promise<TenantContext> {
  noStore();

  const requestHeaders = await headers();
  const headerContext = getTenantContextFromHeaders(requestHeaders);

  if (headerContext) {
    return headerContext;
  }

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const tenant = host ? await resolveTenantByHost(host).catch(() => null) : null;

  if (tenant) {
    return tenantResolutionToContext(tenant, "server");
  }

  return createFallbackTenantContext(host);
}

export function getTenantContextFromHeaders(headersList: HeaderLike): TenantContext | null {
  if (readTenantHeader(headersList, "resolved") !== "true") {
    return null;
  }

  const brandName = readTenantHeader(headersList, "brandName") ?? siteConfig.name;
  const organizationName = readTenantHeader(headersList, "organizationName");
  const branchName = readTenantHeader(headersList, "branchName");
  const gymName = readTenantHeader(headersList, "gymName");

  return {
    resolved: true,
    source: "middleware",
    organizationId: readTenantHeader(headersList, "organizationId"),
    organizationName,
    gymId: readTenantHeader(headersList, "gymId"),
    gymName,
    tenantConfigId: readTenantHeader(headersList, "tenantConfigId"),
    tenantKey: readTenantHeader(headersList, "tenantKey"),
    domain: readTenantHeader(headersList, "domain"),
    domainType: readTenantHeader(headersList, "domainType"),
    routingMode: readTenantHeader(headersList, "routingMode"),
    planTier: readTenantHeader(headersList, "planTier"),
    brand: {
      name: brandName,
      shortName: buildShortBrandName(brandName),
      initial: buildBrandInitial(brandName),
      logoUrl: readTenantHeader(headersList, "logoUrl"),
      faviconUrl: readTenantHeader(headersList, "faviconUrl"),
      primaryColor: readTenantHeader(headersList, "primaryColor"),
      secondaryColor: readTenantHeader(headersList, "secondaryColor"),
      accentColor: readTenantHeader(headersList, "accentColor")
    },
    branch: {
      id: readTenantHeader(headersList, "branchId"),
      name: branchName,
      code: readTenantHeader(headersList, "branchCode"),
      phone: readTenantHeader(headersList, "branchPhone"),
      email: readTenantHeader(headersList, "branchEmail"),
      address: readTenantHeader(headersList, "branchAddress"),
      city: readTenantHeader(headersList, "branchCity"),
      state: readTenantHeader(headersList, "branchState"),
      country: readTenantHeader(headersList, "branchCountry"),
      postalCode: readTenantHeader(headersList, "branchPostalCode"),
      timezone: readTenantHeader(headersList, "branchTimezone"),
      currency: readTenantHeader(headersList, "branchCurrency")
    }
  };
}

export function tenantResolutionToContext(tenant: TenantResolution, source: TenantContext["source"] = "server"): TenantContext {
  const brandName = tenant.brand.name ?? tenant.organizationName ?? tenant.gymName ?? siteConfig.name;

  return {
    resolved: true,
    source,
    organizationId: tenant.organizationId,
    organizationName: tenant.organizationName,
    gymId: tenant.gymId,
    gymName: tenant.gymName,
    tenantConfigId: tenant.tenantConfigId,
    tenantKey: tenant.tenantKey,
    domain: tenant.domain,
    domainType: tenant.domainType,
    routingMode: tenant.routingMode,
    planTier: tenant.planTier,
    brand: {
      name: brandName,
      shortName: buildShortBrandName(brandName),
      initial: buildBrandInitial(brandName),
      logoUrl: tenant.brand.logoUrl,
      faviconUrl: tenant.brand.faviconUrl,
      primaryColor: tenant.brand.primaryColor,
      secondaryColor: tenant.brand.secondaryColor,
      accentColor: tenant.brand.accentColor
    },
    branch: {
      id: tenant.branchId,
      name: tenant.branchName,
      code: tenant.branchCode,
      phone: tenant.branch.phone,
      email: tenant.branch.email,
      address: tenant.branch.address,
      city: tenant.branch.city,
      state: tenant.branch.state,
      country: tenant.branch.country,
      postalCode: tenant.branch.postalCode,
      timezone: tenant.branch.timezone,
      currency: tenant.branch.currency
    }
  };
}

export function createFallbackTenantContext(host?: string | null): TenantContext {
  const domain = normalizeDomain(host ?? "") ?? null;

  return {
    resolved: false,
    source: "fallback",
    organizationId: null,
    organizationName: siteConfig.name,
    gymId: null,
    gymName: siteConfig.name,
    tenantConfigId: null,
    tenantKey: "apex-performance-club",
    domain,
    domainType: null,
    routingMode: null,
    planTier: null,
    brand: {
      name: siteConfig.name,
      shortName: siteConfig.shortName,
      initial: buildBrandInitial(siteConfig.name),
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null
    },
    branch: {
      id: null,
      name: null,
      code: null,
      phone: siteConfig.phone,
      email: siteConfig.email,
      address: siteConfig.address,
      city: null,
      state: null,
      country: "IN",
      postalCode: null,
      timezone: "Asia/Kolkata",
      currency: "INR"
    }
  };
}

export function buildShortBrandName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return siteConfig.shortName;
  }

  if (words.length === 1) {
    return (words[0] ?? siteConfig.shortName).slice(0, 12);
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function buildBrandInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "A";
}
