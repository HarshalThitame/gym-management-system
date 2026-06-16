/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { ButtonLink } from "@/components/ui/button";
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
    const [orgsRes, pkgsRes, subsRes] = await Promise.all([
      supabase.from("organizations").select("id, name, billing_email, primary_domain").order("name").limit(500),
      supabase.from("packages").select("*").order("sort_order").limit(50),
      supabase.from("organization_subscriptions").select("id, organization_id, package_id, status, started_at, expires_at").limit(500),
    ]);
    return {
      error: null as string | null,
      organizations: orgsRes.data ?? [],
      packages: (pkgsRes.data ?? []).map((p: any) => ({ ...p, max_members: p.max_members ?? 0, max_branches: p.max_branches ?? 0, max_trainers: p.max_trainers ?? 0, max_storage_gb: p.max_storage_gb ?? 0, max_api_calls: p.max_api_calls ?? 0, price: p.price ?? 0, sort_order: p.sort_order ?? 0, trial_days: p.trial_days ?? 0 })),
      subscriptions: (subsRes.data ?? []).map((s: any) => ({ ...s, started_at: s.started_at ?? null, expires_at: s.expires_at ?? null })),
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
        <p className="text-4xl">&#9888;&#65039;</p>
        <h1 className="text-2xl font-black">Subscription Management</h1>
        <p className="text-muted-foreground max-w-md">{data.error}</p>
        <ButtonLink href="/super-admin/subscriptions" variant="primary">Retry</ButtonLink>
      </div>
    );
  }

  return <SubscriptionsClient data={data} />;
}
