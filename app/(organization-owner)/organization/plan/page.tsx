import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { OrgSubscriptionManagement } from "@/features/organization-owner/components/OrgSubscriptionManagement";
import type { RoleName } from "@/types/auth";

export const metadata: Metadata = createMetadata({
  title: "Subscription & Plan",
  description: "Manage your organization's subscription, view usage, compare plans, and manage add-ons.",
  path: "/organization/plan",
});

const orgOwnerRole = ["organization_owner"] as const satisfies readonly RoleName[];

export default async function OrganizationPlanPage() {
  await requireRole(orgOwnerRole, "/organization/plan");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const organizationId = (profile as unknown as { organization_id: string | null })?.organization_id;
  if (!organizationId) redirect("/unauthorized?reason=organization_scope");

  const [planContext, subData] = await Promise.all([
    getOrgPlanContext(organizationId),
    getSubscriptionInfo(organizationId),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Subscription</p>
        <h1 className="mt-2 text-3xl font-black">Subscription & Plan</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Review usage, compare plans, manage add-ons, and track subscription changes.
        </p>
      </section>

      <OrgSubscriptionManagement
        organizationId={organizationId}
        planContext={planContext}
        startedAt={subData?.startedAt ?? null}
        subscriptionId={subData?.subscriptionId ?? null}
      />
    </div>
  );
}

async function getSubscriptionInfo(organizationId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("organization_subscriptions")
      .select("id, started_at")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    const row = data as unknown as { id: string; started_at: string };
    return { subscriptionId: row.id, startedAt: row.started_at };
  } catch {
    return null;
  }
}
