"use client";

import { useCallback } from "react";
import { CalendarCheck } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type AttendanceEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function AttendanceEnterpriseModule({ dashboard, moduleData }: AttendanceEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const logs = (moduleData?.items ?? dashboard.attendanceLogs) as typeof dashboard.attendanceLogs;
  const items = logs.map((log) => ({
    id: log.id, title: formatEnterpriseLabel(log.action), subtitle: log.source ? formatEnterpriseLabel(log.source) : undefined,
    meta: `${log.message ?? ""} · ${new Date(log.occurred_at).toLocaleDateString("en-IN")}`,
    badge: log.result, badgeVariant: (log.result === "success" ? "success" : log.result === "denied" ? "error" : "warning") as "success" | "error" | "warning",
    sections: [{ label: "Action", value: formatEnterpriseLabel(log.action) }, { label: "Result", value: log.result }, { label: "Date", value: new Date(log.occurred_at).toLocaleDateString("en-IN") }]
  }));
  const totalItems = moduleData?.items?.length ?? dashboard.attendanceLogs.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total logs" icon={<CalendarCheck className="size-5" />} label="Total" value={String(logs.length)} />
        <StatCard detail="Successful" icon={<CalendarCheck className="size-5" />} label="Success" value={String(logs.filter((l) => l.result === "success").length)} />
        <StatCard detail="Denied" icon={<CalendarCheck className="size-5" />} label="Denied" value={String(logs.filter((l) => l.result === "denied").length)} />
        <StatCard detail="From branch metrics" icon={<CalendarCheck className="size-5" />} label="Metric" value={String(dashboard.metrics.totalAttendance)} />
      </section>
      <FilterBar filterGroups={[{ key: "status", label: "Result", options: [{ value: "success", label: "Success" }, { value: "denied", label: "Denied" }] }]} searchPlaceholder="Search attendance..." onApply={handleApply} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerTitle="Attendance" items={items} totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
    </div>
  );
}
