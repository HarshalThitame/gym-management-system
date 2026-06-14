"use client";

import { useCallback, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, Eye, ShieldCheck, XCircle } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { AuditTrailViewer } from "@/features/organization-owner/components/audit-trail-viewer";
import { ComplianceReportGenerator } from "@/features/organization-owner/components/compliance-report-generator";
import { SessionManager } from "@/features/organization-owner/components/session-manager";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type SecurityEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

const CHART_COLORS = ["#dc2626", "#f59e0b", "#0891b2", "#6b7280"];

export function SecurityEnterpriseModule({ dashboard, moduleData }: SecurityEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [tab, setTab] = useState<"overview" | "events" | "audit" | "compliance" | "sessions">("overview");
  const [detailEvent, setDetailEvent] = useState<Record<string, unknown> | null>(null);

  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const securityEvents = (moduleData?.items ?? dashboard.securityEvents) as typeof dashboard.securityEvents;
  const activityEvents = dashboard.activityEvents;

  // ── KPIs ──
  const openEvents = securityEvents.filter((e) => e.status === "open" || e.status === "investigating").length;
  const resolvedEvents = securityEvents.filter((e) => e.status === "resolved" || e.status === "dismissed").length;
  const criticalEvents = securityEvents.filter((e) => e.severity === "critical").length;
  const highEvents = securityEvents.filter((e) => e.severity === "high").length;

  // ── Severity distribution ──
  const severityDist = useMemo(() => {
    const counts = [
      { name: "Critical", value: criticalEvents },
      { name: "High", value: highEvents },
      { name: "Medium", value: securityEvents.filter((e) => e.severity === "medium").length },
      { name: "Low", value: securityEvents.filter((e) => e.severity === "low" || !e.severity).length },
    ];
    return counts.filter((c) => c.value > 0);
  }, [securityEvents, criticalEvents, highEvents]);

  const securityItems = securityEvents.slice(0, 200).map((e) => ({
    id: e.id,
    title: formatEnterpriseLabel(e.event_type),
    subtitle: e.description ?? undefined,
    meta: `Status: ${e.status} · ${new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    badge: e.severity ?? "info",
    badgeVariant: (e.severity === "critical" || e.severity === "high" ? "error" : e.severity === "medium" ? "warning" : "info") as "error" | "warning" | "info",
    status: e.status,
    sections: [
      { label: "Category", value: formatEnterpriseLabel(e.event_type) },
      { label: "Severity", value: e.severity ?? "info" },
      { label: "Status", value: e.status },
      { label: "Date", value: new Date(e.created_at).toLocaleDateString("en-IN") },
    ],
    actions: [
      { label: "Details", onClick: () => setDetailEvent(e as unknown as Record<string, unknown>), variant: "secondary" as const, icon: <Eye className="size-3.5" /> }
    ]
  }));

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "events" as const, label: "Security Events", count: securityEvents.length },
    { key: "audit" as const, label: "Audit Trail", count: activityEvents.length },
    { key: "compliance" as const, label: "Compliance" },
    { key: "sessions" as const, label: "Sessions" },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total security events recorded" icon={<ShieldCheck className="size-5" />} label="Total Events" value={String(securityEvents.length)} />
        <StatCard detail="Open or investigating events" icon={<AlertTriangle className="size-5" />} label="Open" status={openEvents > 0 ? "risk" : "good"} value={String(openEvents)} />
        <StatCard detail="Critical severity events" icon={<XCircle className="size-5" />} label="Critical" status={criticalEvents > 0 ? "risk" : "good"} value={String(criticalEvents)} />
        <StatCard detail="Resolved or dismissed events" icon={<CheckCircle2 className="size-5" />} label="Resolved" value={String(resolvedEvents)} />
        <StatCard detail="High severity events requiring attention" icon={<AlertTriangle className="size-5" />} label="High" status={highEvents > 0 ? "risk" : "good"} value={String(highEvents)} />
        <StatCard detail="Total activity log entries" icon={<Activity className="size-5" />} label="Audit Entries" value={String(activityEvents.length)} />
      </section>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition ${tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(t.key)} role="tab" aria-selected={tab === t.key} type="button">
            {t.label}
            {"count" in t ? <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px]">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {tab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Severity Distribution */}
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Distribution</p><h3 className="text-2xl font-black">Severity Breakdown</h3></CardHeader>
            <CardContent className="h-64">
              {severityDist.length === 0 ? (
                <p className="pt-16 text-center text-sm text-muted-foreground">No security events recorded.</p>
              ) : (
                <div className="flex h-full items-center gap-6">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={severityDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                          {severityDist.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {severityDist.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div><p className="text-sm font-bold">{s.name}</p><p className="text-xs text-muted-foreground">{s.value} event{s.value !== 1 ? "s" : ""}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Status</p><h3 className="text-2xl font-black">Event Status</h3></CardHeader>
            <CardContent className="space-y-4">
              {securityEvents.length === 0 ? (
                <p className="pt-8 text-center text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <>
                  {(["open", "investigating", "resolved", "dismissed"] as const).map((status) => {
                    const count = securityEvents.filter((e) => e.status === status).length;
                    const pct = securityEvents.length > 0 ? Math.round((count / securityEvents.length) * 100) : 0;
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold capitalize">{status}</span>
                          <span className="font-semibold text-muted-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                          <div className={`h-full rounded-full ${status === "open" ? "bg-red-500" : status === "investigating" ? "bg-amber-500" : status === "resolved" ? "bg-green-500" : "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: SECURITY EVENTS ═══ */}
      {tab === "events" ? (
        <div className="space-y-4">
          <FilterBar
            filterGroups={[{ key: "severity", label: "Severity", options: [
              { value: "critical", label: "Critical" }, { value: "high", label: "High" },
              { value: "medium", label: "Medium" }, { value: "low", label: "Low" }
            ]}]}
            searchPlaceholder="Search events by type or description..."
            onApply={handleApply}
            activeFilters={filters as unknown as Record<string, string>}
          />
          <DataList
            selectable
            bulkActions={[
              { label: "Export CSV", onClick: (ids) => {
                const data = securityEvents.filter((e) => ids.includes(e.id)).map((e) => ({
                  type: e.event_type, severity: e.severity, status: e.status, description: e.description, date: e.created_at
                }));
                exportToCSV(data, "security-events-selected");
              }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
            ]}
            items={securityItems}
            totalItems={securityEvents.length}
            totalPages={Math.ceil(securityEvents.length / 12)}
            currentPage={currentPage}
            onPageChange={(p) => navigate({ page: p })}
            pageSize={filters.pageSize ?? 12}
          />
        </div>
      ) : null}

      {/* ═══ TAB: AUDIT ═══ */}
      {tab === "audit" ? <AuditTrailViewer organizationId={dashboard.organization.id} /> : null}

      {/* ═══ TAB: COMPLIANCE ═══ */}
      {tab === "compliance" ? (
        <ComplianceReportGenerator organizationId={dashboard.organization.id} organizationName={dashboard.organization.name} />
      ) : null}

      {/* ═══ TAB: SESSIONS ═══ */}
      {tab === "sessions" ? (
        <div className="rounded-lg border border-border bg-surface p-6">
          <SessionManager userId={dashboard.organization.owner_user_id ?? ""} />
        </div>
      ) : null}

      {/* ═══ DETAIL PANEL ═══ */}
      {detailEvent ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={() => setDetailEvent(null)}>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Event details">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black">{formatEnterpriseLabel(detailEvent.event_type as string)}</h2>
                  <EnterpriseStatusBadge status={detailEvent.severity as string} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{new Date(detailEvent.created_at as string).toLocaleString("en-IN")}</p>
              </div>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => setDetailEvent(null)} type="button" aria-label="Close"><ShieldCheck className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <Card>
                <CardHeader><h3 className="text-lg font-black">Event Details</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{formatEnterpriseLabel(detailEvent.event_type as string)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Severity</p><EnterpriseStatusBadge status={detailEvent.severity as string} /></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-bold capitalize">{detailEvent.status as string}</p></div>
                  <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-bold">{new Date(detailEvent.created_at as string).toLocaleString("en-IN")}</p></div>
                </CardContent>
              </Card>
              {(detailEvent.description as string) ? (
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Description</h3></CardHeader>
                  <CardContent><p className="text-sm">{detailEvent.description as string}</p></CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
