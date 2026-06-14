"use client";

import { useCallback } from "react";
import { BarChart3, Dumbbell, Gauge, CalendarDays } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";

type AnalyticsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function AnalyticsEnterpriseModule({ dashboard, moduleData }: AnalyticsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q }); }, [navigate]);
  const metrics = (moduleData?.items ?? dashboard.branchMetrics) as typeof dashboard.branchMetrics;

  const items = metrics.map((m) => ({
    id: m.id, title: dashboard.branches.find((b) => b.id === m.branch_id)?.name ?? "Unknown",
    subtitle: m.metric_date ? new Date(m.metric_date).toLocaleDateString("en-IN") : "N/A",
    meta: `${formatCurrency(Number(m.revenue_amount ?? 0))} · ${m.attendance_count ?? 0} visits`,
    badge: `${m.trainer_utilization ?? 0}%`, badgeVariant: "info" as const,
    sections: [{ label: "Revenue", value: formatCurrency(Number(m.revenue_amount ?? 0)) }, { label: "Attendance", value: String(m.attendance_count ?? 0) }, { label: "Trainer Util", value: `${m.trainer_utilization ?? 0}%` }, { label: "Class Util", value: `${m.class_utilization ?? 0}%` }]
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Snapshots" icon={<BarChart3 className="size-5" />} label="Snapshots" value={String(metrics.length)} />
        <StatCard detail="Storage" icon={<Gauge className="size-5" />} label="Storage" value={`${dashboard.metrics.storageMb} MB`} />
        <StatCard detail="Trainer utilization" icon={<Dumbbell className="size-5" />} label="Trainer" value={`${dashboard.metrics.avgTrainerUtilization}%`} />
        <StatCard detail="Class utilization" icon={<CalendarDays className="size-5" />} label="Class" value={`${dashboard.metrics.avgClassUtilization}%`} />
      </section>
      <FilterBar searchPlaceholder="Filter by branch..." onApply={handleApply} activeFilters={filters as unknown as unknown as unknown as Record<string, string>} />
      <DataList headerTitle="Branch Metrics" items={items} totalItems={metrics.length} totalPages={Math.ceil(metrics.length / 12)} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
    </div>
  );
}
