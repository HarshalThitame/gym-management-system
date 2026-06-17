/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { SubscriptionsClient } from "./subscriptions-client";

export const metadata: Metadata = createMetadata({
  title: "Subscription Management",
  description: "Enterprise subscription lifecycle, package management, and plan assignment across all tenant organizations.",
  path: "/super-admin/subscriptions",
});

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = await createSupabaseServerClient();
  const sb = supabase as never as {
    from(t: string): { select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> };
  };

  try {
    const [orgsRes, pkgsRes, subsRes, featuresRes, limitsRes, pricingRes, invoicesRes, eventsRes] = await Promise.all([
      supabase.from("organizations").select("id, name, billing_email, primary_domain").order("name"),
      supabase.from("packages").select("*").order("sort_order"),
      supabase.from("organization_subscriptions").select("id, organization_id, package_id, status, started_at, expires_at, billing_period, trial_ends_at, price_override, next_billing_date, last_billing_date, cancelled_at, notes, created_at, updated_at, auto_renew"),
      sb.from("package_features").select("package_id, feature_code, value"),
      sb.from("package_limits").select("package_id, limit_code, value"),
      sb.from("package_pricing").select("package_id, billing_period, price, currency"),
      sb.from("org_subscription_invoices").select("id, organization_id, subscription_id, invoice_number, status, total_amount, currency, issued_at, due_at, paid_at, razorpay_order_id, billing_period_start, billing_period_end"),
      sb.from("subscription_events").select("id, organization_id, subscription_id, event_type, actor_id, reason, created_at, metadata"),
    ]);

    const featuresByPackage: Record<string, Record<string, any>> = {};
    for (const f of (featuresRes.data ?? []) as any[]) {
      const pkgId = f.package_id as string;
      if (!featuresByPackage[pkgId]) featuresByPackage[pkgId] = {};
      featuresByPackage[pkgId][f.feature_code as string] = f.value;
    }

    const limitsByPackage: Record<string, Record<string, number>> = {};
    for (const l of (limitsRes.data ?? []) as any[]) {
      const pkgId = l.package_id as string;
      if (!limitsByPackage[pkgId]) limitsByPackage[pkgId] = {};
      limitsByPackage[pkgId][l.limit_code as string] = l.value as number;
    }

    const pricingByPackage: Record<string, any[]> = {};
    for (const p of (pricingRes.data ?? []) as any[]) {
      const pkgId = p.package_id as string;
      if (!pricingByPackage[pkgId]) pricingByPackage[pkgId] = [];
      pricingByPackage[pkgId].push(p);
    }

    const invoicesByOrg: Record<string, any[]> = {};
    for (const inv of (invoicesRes.data ?? []) as any[]) {
      const orgId = inv.organization_id as string;
      if (!invoicesByOrg[orgId]) invoicesByOrg[orgId] = [];
      invoicesByOrg[orgId].push(inv);
    }

    const eventsByOrg: Record<string, any[]> = {};
    for (const ev of (eventsRes.data ?? []) as any[]) {
      const orgId = ev.organization_id as string;
      if (!eventsByOrg[orgId]) eventsByOrg[orgId] = [];
      eventsByOrg[orgId].push(ev);
    }

    const packages = (pkgsRes.data ?? []).map((p: any) => {
      const pkgId = p.id;
      const pkgPricing = pricingByPackage[pkgId] ?? [];
      const monthlyPrice = pkgPricing.find((pr: any) => pr.billing_period === "monthly")?.price ?? p.price ?? 0;
      return {
        ...p,
        price: monthlyPrice,
        _features: featuresByPackage[pkgId] ?? {},
        _limits: limitsByPackage[pkgId] ?? {},
        _pricing: pkgPricing,
      };
    });

    const subscriptions = (subsRes.data ?? []).map((s: any) => ({
      ...s,
      started_at: s.started_at ?? null,
      expires_at: s.expires_at ?? null,
      trial_ends_at: s.trial_ends_at ?? null,
      next_billing_date: s.next_billing_date ?? null,
      last_billing_date: s.last_billing_date ?? null,
      cancelled_at: s.cancelled_at ?? null,
      auto_renew: s.auto_renew ?? true,
    }));

    return {
      error: null as string | null,
      organizations: orgsRes.data ?? [],
      packages,
      subscriptions,
      invoicesByOrg,
      eventsByOrg,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to load data",
      organizations: [],
      packages: [],
      subscriptions: [],
      invoicesByOrg: {},
      eventsByOrg: {},
    };
  }
}

export default async function SubscriptionsPage() {
  await requireRole(["super_admin"], "/super-admin/subscriptions");
  const data = await getData();

  if (data.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="text-2xl font-black">Subscription Management</h1>
        <p className="text-muted-foreground max-w-md">{data.error}</p>
        <Link href="/super-admin/subscriptions" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Retry</Link>
      </div>
    );
  }

  return <SubscriptionsClient data={data} />;
}
