import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

export const revalidate = 60;

export const metadata: Metadata = createMetadata({
  title: "Organization Owner Dashboard",
  description: "Enterprise command center for organization gyms, members, revenue, attendance, and security.",
  path: "/organization"
});

async function DashboardContent() {
  const context = await requireOrganizationOwner("/organization");
  const [dashboard, planContext] = await Promise.all([
    getOrganizationOwnerDashboard(context),
    getOrgPlanContext(context.organizationId)
  ]);

  const { EnterpriseDashboard } = await import("@/features/organization-owner/components/enterprise-dashboard");
  return <EnterpriseDashboard dashboard={dashboard} planContext={planContext} />;
}

export default function OrganizationOwnerDashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <DashboardContent />
      </div>
    </Suspense>
  );
}

function DashboardPageFallback() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-5 md:p-7">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-96" />
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5 md:p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-9 w-24" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
