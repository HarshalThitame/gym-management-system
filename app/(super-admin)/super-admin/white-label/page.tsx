import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSuperAdminModule } from "@/features/super-admin/lib/super-admin-modules";
import { WhiteLabelDashboard } from "./white-label-dashboard";

export const metadata: Metadata = {
  title: "White Label Branding",
  description: "Enterprise tenant branding management with theme editor, email preview, login preview, and brand health.",
};

export default async function WhiteLabelPage() {
  const mod = getSuperAdminModule("white-label");
  if (!mod) notFound();

  const supabase = await createSupabaseServerClient();

  const [configsRes, orgsRes, domainsRes] = await Promise.all([
    supabase.from("tenant_configs").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name, slug, status"),
    supabase.from("tenant_domains").select("id, organization_id, domain, status, ssl_status, is_primary"),
  ]);

  const rawConfigs = (configsRes.data ?? []) as Array<Record<string, unknown>>;
  const organizations = (orgsRes.data ?? []) as Array<Record<string, unknown>>;
  const domains = (domainsRes.data ?? []) as Array<Record<string, unknown>>;

  const configs = rawConfigs.map((c) => ({
    ...c,
    brand_colors: {
      primary: (c.primary_color as string) ?? "",
      secondary: (c.secondary_color as string) ?? "",
      accent: (c.accent_color as string) ?? "",
    },
    heading_font: ((c.typography as Record<string, unknown>)?.headingFont as string) ?? "Inter",
    body_font: ((c.typography as Record<string, unknown>)?.bodyFont as string) ?? "Inter",
    email_from_name: ((c.email_branding as Record<string, unknown>)?.fromName as string) ?? "",
    email_reply_to: ((c.email_branding as Record<string, unknown>)?.replyTo as string) ?? "",
  })) as Array<Record<string, unknown>>;

  const stats = {
    total: configs.length,
    active: configs.filter((c) => (c.status as string) === "active").length,
    enterprise: configs.filter((c) => (c.plan_tier as string) === "enterprise").length,
    withCustomDomain: configs.filter((c) => c.custom_domain).length,
  };

  return (
    <WhiteLabelDashboard
      configs={configs}
      organizations={organizations}
      domains={domains}
      stats={stats}
      module={mod}
    />
  );
}
