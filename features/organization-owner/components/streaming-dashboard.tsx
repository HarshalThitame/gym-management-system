import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EnterpriseDashboard } from "@/features/organization-owner/components/enterprise-dashboard";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";

export function StreamingDashboard({ dashboard, planContext }: { dashboard: OrganizationOwnerDashboard; planContext?: OrgPlanContext | null }) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <EnterpriseDashboard dashboard={dashboard} planContext={planContext} />
    </Suspense>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5 md:p-7">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-8 w-72" />
          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
