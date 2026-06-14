import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCharts } from "@/features/organization-owner/components/org-owner-dashboard-charts";
import { CustomizableDashboard } from "@/features/organization-owner/components/customizable-dashboard";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";

function KpiGridFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5 md:p-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-9 w-16" />
          <Skeleton className="mt-2 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function ChartsFallback() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      ))}
    </div>
  );
}

function ActivityFallback() {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-8 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-14 w-full rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type StreamingDashboardProps = {
  dashboard: OrganizationOwnerDashboard;
  planContext?: OrgPlanContext | null;
};

export function StreamingDashboard({ dashboard, planContext }: StreamingDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Hero — loaded immediately */}
      <section className="rounded-lg border border-border bg-surface p-4 md:p-6 lg:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:text-xs">Organization Owner Portal</p>
        <h2 className="mt-2 text-2xl font-black md:mt-3 md:text-3xl lg:text-4xl">{dashboard.organization.name}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground md:mt-3 md:text-sm">Tenant-safe command center for your organization.</p>
      </section>

      {/* KPI grid — streamed */}
      <Suspense fallback={<KpiGridFallback />}>
        <CustomizableDashboard dashboard={dashboard} />
      </Suspense>

      {/* Charts — streamed (heavier) */}
      <Suspense fallback={<ChartsFallback />}>
        <DashboardCharts dashboard={dashboard} />
      </Suspense>

      {/* Activity + Security — streamed */}
      <Suspense fallback={<ActivityFallback />}>
        <DashboardActivitySection dashboard={dashboard} />
      </Suspense>
    </div>
  );
}

function DashboardActivitySection({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const recentActivity = dashboard.activityEvents.slice(0, 5);
  const alerts = dashboard.securityEvents.filter((e) => e.status === "open" || e.status === "investigating").slice(0, 5);
  const topBranches = [...dashboard.branchMetrics].sort((a, b) => Number(b.revenue_amount ?? 0) - Number(a.revenue_amount ?? 0)).slice(0, 5);

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organization Modules</p>
          <h2 className="mt-1 text-2xl font-black">Owner Workspaces</h2>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-2xl font-black">Top Branch Performance</h2>
          <div className="mt-4 space-y-3">
            {topBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branch metric snapshots yet.</p>
            ) : topBranches.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <p className="text-sm font-bold">{dashboard.branches.find((b) => b.id === m.branch_id)?.name ?? "Unknown"}</p>
                <span className="text-xs font-semibold text-muted-foreground">{m.metric_date}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-2xl font-black">Recent Activity</h2>
          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : recentActivity.map((event) => (
              <div key={event.id} className="rounded-md border border-border bg-background p-3">
                <p className="text-sm font-bold">{event.event_type.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleDateString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-2xl font-black">Security Alerts</h2>
          <div className="mt-4 space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open alerts.</p>
            ) : alerts.map((event) => (
              <div key={event.id} className="rounded-md border border-border bg-background p-3">
                <p className="text-sm font-bold">{event.event_type.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{event.description ?? ""}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
