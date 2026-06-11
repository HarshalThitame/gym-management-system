export const tenantHeaderNames = {
  resolved: "x-tenant-resolved",
  organizationId: "x-tenant-organization-id",
  organizationName: "x-tenant-organization-name",
  branchId: "x-tenant-branch-id",
  branchName: "x-tenant-branch-name",
  branchCode: "x-tenant-branch-code",
  gymId: "x-tenant-gym-id",
  gymName: "x-tenant-gym-name",
  tenantConfigId: "x-tenant-config-id",
  tenantKey: "x-tenant-key",
  domain: "x-tenant-domain",
  domainType: "x-tenant-domain-type",
  routingMode: "x-tenant-routing-mode",
  planTier: "x-tenant-plan-tier",
  brandName: "x-tenant-brand-name",
  logoUrl: "x-tenant-logo-url",
  faviconUrl: "x-tenant-favicon-url",
  primaryColor: "x-tenant-primary-color",
  secondaryColor: "x-tenant-secondary-color",
  accentColor: "x-tenant-accent-color",
  branchPhone: "x-tenant-branch-phone",
  branchEmail: "x-tenant-branch-email",
  branchAddress: "x-tenant-branch-address",
  branchCity: "x-tenant-branch-city",
  branchState: "x-tenant-branch-state",
  branchCountry: "x-tenant-branch-country",
  branchPostalCode: "x-tenant-branch-postal-code",
  branchTimezone: "x-tenant-branch-timezone",
  branchCurrency: "x-tenant-branch-currency"
} as const;

export type TenantHeaderKey = keyof typeof tenantHeaderNames;

export type TenantHeaderValueMap = Partial<Record<TenantHeaderKey, string | null>>;

export function encodeTenantHeaderValue(value: string | null | undefined) {
  return value ? encodeURIComponent(value) : null;
}

export function decodeTenantHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function writeTenantHeaders(headers: Headers, values: TenantHeaderValueMap) {
  for (const [key, headerName] of Object.entries(tenantHeaderNames) as Array<[TenantHeaderKey, string]>) {
    const value = values[key];

    if (value === undefined || value === null || value === "") {
      headers.delete(headerName);
      continue;
    }

    headers.set(headerName, encodeTenantHeaderValue(value) ?? "");
  }
}

export function clearTenantHeaders(headers: Headers) {
  for (const headerName of Object.values(tenantHeaderNames)) {
    headers.delete(headerName);
  }
}

export function readTenantHeader(headers: Pick<Headers, "get">, key: TenantHeaderKey) {
  return decodeTenantHeaderValue(headers.get(tenantHeaderNames[key]));
}
