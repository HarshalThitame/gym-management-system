import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getActivePackagesAction, getOrgSubscriptionAction, getUsageHistoryAction, getOrgUsageAction } from "@/features/organization-owner/actions/plan-data-actions";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { RoleName } from "@/types/auth";

export const revalidate = 120;

export const metadata: Metadata = createMetadata({
  title: "Subscription & Plan",
  description: "Manage your organization's subscription, usage, plans, billing, and add-ons.",
  path: "/organization/plan",
});

const orgOwnerRole = ["organization_owner"] as const satisfies readonly RoleName[];

async function PlanContent() {
  const ctx = await requireRole(orgOwnerRole, "/organization/plan") as { organizationId?: string; email?: string };
  const organizationId = ctx.organizationId ?? null;
  if (!organizationId) redirect("/unauthorized?reason=organization_scope");

  const [planContext, allPackages, currentSubscription, usageHistory, orgUsage] = await Promise.all([
    getOrgPlanContext(organizationId),
    getActivePackagesAction(),
    getOrgSubscriptionAction(),
    getUsageHistoryAction(),
    getOrgUsageAction(),
  ]);

  // Get org name and billing email
  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, billing_email")
    .eq("id", organizationId as never)
    .maybeSingle();
  const orgRecord = org as unknown as { name: string; billing_email: string | null } | null;
  const organizationName = orgRecord?.name ?? "Your Organization";
  const customerEmail = orgRecord?.billing_email ?? ctx.email ?? "";

  const { EnterprisePlanManagement } = await import("@/features/organization-owner/components/enterprise-plan-management");

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/organization", label: "Dashboard" }, { href: "/organization/plan", label: "Plan" }]} />
      <EnterprisePlanManagement
        organizationId={organizationId}
        planContext={planContext}
        allPackages={allPackages}
        currentSubscription={currentSubscription}
        usageHistory={usageHistory}
        orgUsage={orgUsage}
        organizationName={organizationName}
        customerEmail={customerEmail}
      />
    </div>
  );
}

export default function OrganizationPlanPage() {
  return (
    <Suspense fallback={<PlanFallback />}>
      <PlanContent />
    </Suspense>
  );
}

function PlanFallback() {
  return (
    <div className="space-y-6">
      <div className="flex gap-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-6">
            <Skeleton className="h-5 w-24" /><Skeleton className="mt-4 h-8 w-32" />
            <div className="mt-4 space-y-3"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
