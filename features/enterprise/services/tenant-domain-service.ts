import { normalizeDomain } from "@/features/enterprise/lib/business-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantResolutionRow } from "@/types/enterprise";

export type TenantResolution = {
  organizationId: string;
  organizationName: string | null;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  gymId: string | null;
  gymName: string | null;
  tenantConfigId: string | null;
  tenantKey: string | null;
  domain: string;
  domainType: string | null;
  routingMode: string | null;
  planTier: string | null;
  brand: {
    name: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  };
  branch: {
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
  raw: TenantResolutionRow;
};

export async function resolveTenantByHost(host: string): Promise<TenantResolution | null> {
  const normalizedHost = normalizeDomain(host);

  if (!normalizedHost) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_tenant_by_host", { request_host: normalizedHost });

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0] ?? null;
  return row ? toTenantResolution(row) : null;
}

function toTenantResolution(row: TenantResolutionRow): TenantResolution | null {
  if (!row.organization_id || !row.domain) {
    return null;
  }

  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    branchCode: row.branch_code,
    gymId: row.gym_id,
    gymName: row.gym_name,
    tenantConfigId: row.tenant_config_id,
    tenantKey: row.tenant_key,
    domain: row.domain,
    domainType: row.domain_type,
    routingMode: row.routing_mode,
    planTier: row.plan_tier,
    brand: {
      name: row.brand_name,
      logoUrl: row.logo_url,
      faviconUrl: row.favicon_url,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color
    },
    branch: {
      phone: row.branch_phone,
      email: row.branch_email,
      address: row.branch_address,
      city: row.branch_city,
      state: row.branch_state,
      country: row.branch_country,
      postalCode: row.branch_postal_code,
      timezone: row.branch_timezone,
      currency: row.branch_currency
    },
    raw: row
  };
}
