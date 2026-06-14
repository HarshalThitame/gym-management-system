"use client";

import { useCallback, useState } from "react";
import { ShieldCheck, Activity, AlertTriangle, Info } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { AuditTrailViewer } from "@/features/organization-owner/components/audit-trail-viewer";
import { ComplianceReportGenerator } from "@/features/organization-owner/components/compliance-report-generator";
import { SessionManager } from "@/features/organization-owner/components/session-manager";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type SecurityEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function SecurityEnterpriseModule({ dashboard, moduleData }: SecurityEnterpriseModuleProps) {
  const [tab, setTab] = useState<"events" | "audit" | "compliance" | "sessions">("events");
  const { filters, navigate, currentPage } = useModuleFilters();
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const securityEvents = (moduleData?.items ?? dashboard.securityEvents) as typeof dashboard.securityEvents;
  const activityEvents = dashboard.activityEvents;

  const securityItems = securityEvents.map((e) => ({
    id: e.id, title: formatEnterpriseLabel(e.event_type), subtitle: e.description ?? undefined,
    meta: new Date(e.created_at).toLocaleDateString("en-IN"),
    badge: e.severity ?? "info",
    badgeVariant: (e.severity === "critical" || e.severity === "high" ? "error" : e.severity === "medium" ? "warning" : "info") as "error" | "warning" | "info",
    sections: [{ label: "Category", value: formatEnterpriseLabel(e.event_type) }, { label: "Severity", value: e.severity ?? "info" }, { label: "Status", value: e.status }, { label: "Date", value: new Date(e.created_at).toLocaleDateString("en-IN") }]
  }));

  const tabs = [
    { key: "events" as const, label: "Security Events", count: securityEvents.length },
    { key: "audit" as const, label: "Audit Trail", count: activityEvents.length },
    { key: "compliance" as const, label: "Compliance" },
    { key: "sessions" as const, label: "Sessions" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(t.key)} role="tab" aria-selected={tab === t.key} type="button"
          >
            {t.label}
            {"count" in t ? <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px]">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "events" ? (
        <div className="space-y-4">
          <FilterBar filterGroups={[{ key: "severity", label: "Severity", options: [
            { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }
          ]}]} searchPlaceholder="Search events..." onApply={handleApply} activeFilters={filters as unknown as Record<string, string>} />
          <DataList items={securityItems} totalItems={securityEvents.length} totalPages={Math.ceil(securityEvents.length / 12)} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
        </div>
      ) : null}

      {tab === "audit" ? <AuditTrailViewer organizationId={dashboard.organization.id} /> : null}

      {tab === "compliance" ? (
        <ComplianceReportGenerator organizationId={dashboard.organization.id} organizationName={dashboard.organization.name} />
      ) : null}

      {tab === "sessions" ? (
        <div className="rounded-lg border border-border bg-surface p-6">
          <SessionManager userId={dashboard.organization.owner_user_id ?? ""} />
        </div>
      ) : null}
    </div>
  );
}
