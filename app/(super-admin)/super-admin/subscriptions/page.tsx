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

  try {
    const sb = supabase as never as {
      from(t: string): { select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> };
    };

    const [orgsRes, pkgsRes, subsRes, featuresRes, limitsRes, pricingRes] = await Promise.all([
      supabase.from("organizations").select("id, name, billing_email, primary_domain").order("name").limit(500),
      supabase.from("packages").select("*").order("sort_order").limit(50),
      supabase.from("organization_subscriptions").select("id, organization_id, package_id, status, started_at, expires_at").limit(500),
      sb.from("package_features").select("package_id, feature_code, value"),
      sb.from("package_limits").select("package_id, limit_code, value"),
      sb.from("package_pricing").select("package_id, billing_period, price, currency"),
    ]);

    // Build feature and limit maps per package
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

    const packages = (pkgsRes.data ?? []).map((p: any) => {
      const pkgId = p.id;
      const pkgPricing = pricingByPackage[pkgId] ?? [];
      const monthlyPrice = pkgPricing.find((pr: any) => pr.billing_period === "monthly")?.price ?? p.price ?? 0;

      return {
        ...p,
        price: monthlyPrice,
        max_members: p.max_members ?? limitsByPackage[pkgId]?.max_members ?? 0,
        max_branches: p.max_branches ?? limitsByPackage[pkgId]?.max_branches ?? 0,
        max_trainers: p.max_trainers ?? limitsByPackage[pkgId]?.max_trainers ?? 0,
        max_staff: p.max_staff ?? limitsByPackage[pkgId]?.max_staff ?? 0,
        max_storage_gb: p.max_storage_gb ?? limitsByPackage[pkgId]?.max_storage_gb ?? 0,
        max_api_calls: p.max_api_calls ?? limitsByPackage[pkgId]?.max_api_calls ?? 0,
        sort_order: p.sort_order ?? 0,
        trial_days: p.trial_days ?? 0,
        _features: featuresByPackage[pkgId] ?? {},
        _limits: limitsByPackage[pkgId] ?? {},
        _pricing: pkgPricing,
      };
    });

    return {
      error: null as string | null,
      organizations: orgsRes.data ?? [],
      packages,
      subscriptions: (subsRes.data ?? []).map((s: any) => ({
        ...s,
        started_at: s.started_at ?? null,
        expires_at: s.expires_at ?? null,
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to load data",
      organizations: [],
      packages: [],
      subscriptions: [],
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
