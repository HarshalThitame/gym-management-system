import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSuperAdminModule } from "@/features/super-admin/lib/super-admin-modules";
import { DomainDashboard } from "./domain-dashboard";

export const metadata: Metadata = {
  title: "Domain Management",
  description: "Enterprise domain lifecycle management, DNS verification, SSL monitoring, and tenant routing.",
};

export default async function SuperAdminDomainsPage() {
  const mod = getSuperAdminModule("domains");
  if (!mod) notFound();

  const supabase = await createSupabaseServerClient();

  const [domainsRes, checksRes, eventsRes, orgsRes, configsRes] = await Promise.all([
    supabase.from("tenant_domains").select("*").order("created_at", { ascending: false }),
    supabase.from("tenant_domain_latest_checks").select("*").order("checked_at", { ascending: false }),
    supabase.from("tenant_domain_latest_provider_events").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name, slug, status, primary_domain, billing_email"),
    supabase.from("tenant_configs").select("id, organization_id, subdomain, custom_domain, domain_status"),
  ]);

  const domains = (domainsRes.data ?? []) as Array<Record<string, unknown>>;
  const domainCount = domains.length;
  const verifiedCount = domains.filter((d) => (d.status as string) === "verified").length;
  const failedCount = domains.filter((d) => (d.status as string) === "failed" || (d.ssl_status as string) === "failed").length;
  const primaryCount = domains.filter((d) => d.is_primary).length;
  const pendingCount = domains.filter((d) => (d.status as string) === "pending").length;

  return (
    <DomainDashboard
      domains={domains}
      checks={(checksRes.data ?? []) as Array<Record<string, unknown>>}
      providerEvents={(eventsRes.data ?? []) as Array<Record<string, unknown>>}
      organizations={(orgsRes.data ?? []) as Array<Record<string, unknown>>}
      tenantConfigs={(configsRes.data ?? []) as Array<Record<string, unknown>>}
      stats={{ domainCount, verifiedCount, failedCount, primaryCount, pendingCount }}
      module={mod}
    />
  );
}
