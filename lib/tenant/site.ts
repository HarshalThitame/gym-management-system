import type { CSSProperties } from "react";
import { siteConfig } from "@/data/site";
import { getTenantContext, type TenantContext } from "./context";

export type TenantSiteConfig = typeof siteConfig & {
  tenant: TenantContext;
  brandInitial: string;
  domain: string | null;
  branchName: string | null;
};

type TenantThemeStyle = CSSProperties & {
  "--color-accent"?: string;
  "--color-secondary"?: string;
  "--ring"?: string;
};

export async function getTenantSiteConfig() {
  return buildTenantSiteConfig(await getTenantContext());
}

export function buildTenantSiteConfig(tenant: TenantContext): TenantSiteConfig {
  const branchAddress = formatTenantAddress(tenant);
  const phone = tenant.branch.phone ?? siteConfig.phone;
  const email = tenant.branch.email ?? siteConfig.email;

  return {
    ...siteConfig,
    name: tenant.brand.name,
    shortName: tenant.brand.shortName,
    phone,
    email,
    address: branchAddress ?? siteConfig.address,
    whatsapp: normalizeWhatsappNumber(phone) ?? siteConfig.whatsapp,
    tenant,
    brandInitial: tenant.brand.initial,
    domain: tenant.domain,
    branchName: tenant.branch.name
  };
}

export function buildTenantThemeStyle(tenant: TenantContext): TenantThemeStyle | undefined {
  const style: TenantThemeStyle = {};
  const accentColor = tenant.brand.accentColor;
  const secondaryColor = tenant.brand.secondaryColor;

  if (isHexColor(accentColor)) {
    style["--color-accent"] = accentColor;
    style["--ring"] = accentColor;
  }

  if (isHexColor(secondaryColor)) {
    style["--color-secondary"] = secondaryColor;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function formatTenantAddress(tenant: TenantContext) {
  const parts = [
    tenant.branch.address,
    tenant.branch.city,
    tenant.branch.state,
    tenant.branch.postalCode,
    tenant.branch.country
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

function isHexColor(value: string | null): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}
