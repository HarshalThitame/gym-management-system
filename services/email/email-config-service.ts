import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgEmailConfig = {
  from: string | null;
  replyTo: string | null;
  fromName: string | null;
  verifiedDomain: string | null;
  logoUrl: string | null;
};

export async function getOrgEmailConfig(organizationId: string): Promise<OrgEmailConfig> {
  const supabase = await createSupabaseServerClient();

  const [configResult, domainsResult] = await Promise.all([
    supabase
      .from("tenant_configs")
      .select("email_branding, brand_name, logo_url, primary_color")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("tenant_domains")
      .select("domain, status, metadata")
      .eq("organization_id", organizationId)
      .eq("domain_type", "email_sending")
      .eq("status", "verified")
      .limit(1)
      .maybeSingle(),
  ]);

  const branding = configResult.data?.email_branding as Record<string, unknown> | null;
  const brandName = configResult.data?.brand_name ?? null;
  const logoUrl = configResult.data?.logo_url ?? null;

  const emailBranding = (branding ?? {}) as Record<string, unknown>;
  const fromName = (emailBranding.fromName as string) || brandName;
  const replyTo = (emailBranding.replyTo as string) || null;

  let from: string | null = null;
  let verifiedDomain: string | null = null;

  if (domainsResult.data) {
    verifiedDomain = domainsResult.data.domain;
    const localPart = emailBranding.fromEmailLocalPart as string || "noreply";
    from = fromName
      ? `${fromName} <${localPart}@${verifiedDomain}>`
      : `${localPart}@${verifiedDomain}`;
  }

  return {
    from,
    replyTo,
    fromName,
    verifiedDomain,
    logoUrl,
  };
}

export async function getOrgEmailConfigOrDefault(
  organizationId: string
): Promise<Required<Pick<OrgEmailConfig, "from" | "replyTo">> & OrgEmailConfig> {
  const config = await getOrgEmailConfig(organizationId);
  const globalFrom = process.env.RESEND_FROM_EMAIL;

  return {
    ...config,
    from: config.from || globalFrom || null,
    replyTo: config.replyTo || null,
  };
}
