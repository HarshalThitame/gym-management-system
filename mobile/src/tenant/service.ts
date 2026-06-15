import { getSupabaseClient } from "@/api/supabase";

export interface TenantResolution {
  organizationId: string | null;
  organizationName: string | null;
  gymId: string | null;
  gymName: string | null;
  branchId: string | null;
  branchName: string | null;
  tenantConfigId: string | null;
  tenantKey: string | null;
  domain: string | null;
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
}

export interface TenantContext {
  organizationId: string | null;
  organizationName: string | null;
  gymId: string | null;
  gymName: string | null;
  branchId: string | null;
  branchName: string | null;
  planTier: string | null;
  brand: {
    name: string;
    shortName: string;
    initial: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  };
  resolved: boolean;
}

export async function resolveTenant(domain: string): Promise<TenantResolution | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("resolve_tenant_by_host", {
      request_host: domain,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const tenant = data[0] as Record<string, unknown>;
    return {
      organizationId: (tenant.organization_id as string) ?? null,
      organizationName: (tenant.organization_name as string) ?? null,
      gymId: (tenant.gym_id as string) ?? null,
      gymName: (tenant.gym_name as string) ?? null,
      branchId: (tenant.branch_id as string) ?? null,
      branchName: (tenant.branch_name as string) ?? null,
      tenantConfigId: (tenant.tenant_config_id as string) ?? null,
      tenantKey: (tenant.tenant_key as string) ?? null,
      domain: (tenant.domain as string) ?? null,
      domainType: (tenant.domain_type as string) ?? null,
      routingMode: (tenant.routing_mode as string) ?? null,
      planTier: (tenant.plan_tier as string) ?? null,
      brand: {
        name: (tenant.brand_name as string) ?? null,
        logoUrl: (tenant.logo_url as string) ?? null,
        faviconUrl: (tenant.favicon_url as string) ?? null,
        primaryColor: (tenant.primary_color as string) ?? null,
        secondaryColor: (tenant.secondary_color as string) ?? null,
        accentColor: (tenant.accent_color as string) ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function resolveTenantByOrganizationId(organizationId: string): Promise<TenantResolution | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tenant_configs")
      .select(`
        id,
        tenant_key,
        plan_tier,
        brand_name,
        logo_url,
        favicon_url,
        primary_color,
        secondary_color,
        accent_color,
        organizations!inner(name, slug)
      `)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !data) return null;

    const org = data.organizations as unknown as { name: string; slug: string };
    return {
      organizationId,
      organizationName: org.name,
      gymId: null,
      gymName: null,
      branchId: null,
      branchName: null,
      tenantConfigId: data.id,
      tenantKey: data.tenant_key,
      domain: null,
      domainType: null,
      routingMode: null,
      planTier: data.plan_tier,
      brand: {
        name: data.brand_name,
        logoUrl: data.logo_url,
        faviconUrl: data.favicon_url,
        primaryColor: data.primary_color,
        secondaryColor: data.secondary_color,
        accentColor: data.accent_color,
      },
    };
  } catch {
    return null;
  }
}

export function createTenantContext(resolution: TenantResolution | null, organizationName?: string | null): TenantContext {
  if (!resolution) {
    return {
      organizationId: null,
      organizationName: organizationName ?? null,
      gymId: null,
      gymName: null,
      branchId: null,
      branchName: null,
      planTier: null,
      brand: {
        name: "Apex Performance Club",
        shortName: "Apex",
        initial: "A",
        logoUrl: null,
        faviconUrl: null,
        primaryColor: null,
        secondaryColor: null,
        accentColor: null,
      },
      resolved: false,
    };
  }

  const brandName = resolution.brand.name ?? resolution.organizationName ?? "Apex Performance Club";
  const name = brandName;
  const words = name.trim().split(/\s+/).filter(Boolean);
  const shortName = words.length === 1
    ? name.slice(0, 12)
    : words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const initial = name.trim().charAt(0).toUpperCase();

  return {
    organizationId: resolution.organizationId,
    organizationName: resolution.organizationName,
    gymId: resolution.gymId,
    gymName: resolution.gymName,
    branchId: resolution.branchId,
    branchName: resolution.branchName,
    planTier: resolution.planTier,
    brand: {
      name,
      shortName,
      initial,
      logoUrl: resolution.brand.logoUrl,
      faviconUrl: resolution.brand.faviconUrl,
      primaryColor: resolution.brand.primaryColor,
      secondaryColor: resolution.brand.secondaryColor,
      accentColor: resolution.brand.accentColor,
    },
    resolved: true,
  };
}

export function canAccessTenant(
  userOrgId: string | null,
  userGymId: string | null,
  userRoles: readonly string[],
  targetOrgId: string | null,
  targetGymId: string | null
): boolean {
  if (userRoles.includes("super_admin")) return true;

  if (targetGymId && userGymId === targetGymId) return true;

  if (targetOrgId && userOrgId === targetOrgId && userRoles.includes("organization_owner")) {
    return true;
  }

  return false;
}
