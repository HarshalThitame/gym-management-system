import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

export const revalidate = 60; // ISR: revalidate dashboard every 60 seconds

export const metadata: Metadata = createMetadata({
  title: "Organization Owner Dashboard",
  description: "Tenant-safe organization command center for owned gyms, branches, members, staff, revenue, domains, and audit activity.",
  path: "/organization"
});

async function DashboardContent() {
  const context = await requireOrganizationOwner("/organization");
  const [dashboard, planContext] = await Promise.all([
    getOrganizationOwnerDashboard(context),
    getOrgPlanContext(context.organizationId)
  ]);

  const { StreamingDashboard } = await import("@/features/organization-owner/components/streaming-dashboard");
  return <StreamingDashboard dashboard={dashboard} planContext={planContext} />;
}

export default function OrganizationOwnerDashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <section className="rounded-lg border border-border bg-surface p-6 md:p-8">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-4 h-10 w-72" />
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        </section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-5 md:p-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-9 w-20" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
