import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getActivePackagesAction, getOrgSubscriptionAction, getUsageHistoryAction } from "@/features/organization-owner/actions/plan-data-actions";
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
  const ctx = await requireRole(orgOwnerRole, "/organization/plan") as { organizationId?: string };
  const organizationId = ctx.organizationId ?? null;
  if (!organizationId) redirect("/unauthorized?reason=organization_scope");

  const [planContext, allPackages, currentSubscription, usageHistory] = await Promise.all([
    getOrgPlanContext(organizationId),
    getActivePackagesAction(),
    getOrgSubscriptionAction(),
    getUsageHistoryAction(),
  ]);

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
