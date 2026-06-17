"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, Download, Dumbbell, Eye, Gauge, TrendingUp, UsersRound } from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart as RechartsLine, Pie, PieChart as RechartsPie, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type AnalyticsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

const CHART_COLORS = ["#111315", "#16a34a", "#0891b2", "#f59e0b", "#dc2626", "#8b5cf6", "#ec4899", "#14b8a6"];

export function AnalyticsEnterpriseModule({ dashboard, moduleData }: AnalyticsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "members" | "utilization">("overview");
  const [detailMetric, setDetailMetric] = useState<Record<string, unknown> | null>(null);

  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q }); }, [navigate]);
  const branchMetrics = (moduleData?.items ?? dashboard.branchMetrics) as typeof dashboard.branchMetrics;

  // ── Compute aggregated data ──
  const revenueTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(m.revenue_amount ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, revenue]) => ({ date, revenue }));
  }, [branchMetrics]);

  const memberTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      byMonth.set(month, Math.max(byMonth.get(month) ?? 0, Number(m.active_members ?? 0)));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, members]) => ({ date, members }));
  }, [branchMetrics]);

  const attendanceTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(m.attendance_count ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, attendance]) => ({ date, attendance }));
  }, [branchMetrics]);

  const revenueByBranch = useMemo(() => {
    const byBranch = new Map<string, number>();
    for (const m of branchMetrics) {
      const name = dashboard.branches.find((b) => b.id === m.branch_id)?.name ?? "Unknown";
      byBranch.set(name, (byBranch.get(name) ?? 0) + Number(m.revenue_amount ?? 0));
    }
    return Array.from(byBranch.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [branchMetrics, dashboard.branches]);

  const trainerUtilTrend = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const m of branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(Number(m.trainer_utilization ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, vals]) => ({
      date, avgUtil: vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : 0
    }));
  }, [branchMetrics]);

  const classUtilTrend = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const m of branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(Number(m.class_utilization ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, vals]) => ({
      date, avgUtil: vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : 0
    }));
  }, [branchMetrics]);

  const planDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plan of dashboard.membershipPlans) {
      counts.set(plan.plan_type, (counts.get(plan.plan_type) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name: formatEnterpriseLabel(name), value }));
  }, [dashboard.membershipPlans]);

  // KPIs with MoM
  const latestRev = revenueTrend[revenueTrend.length - 1]?.revenue ?? 0;
  const prevRev = revenueTrend[revenueTrend.length - 2]?.revenue ?? 0;
  const revMom = prevRev > 0 ? Math.round(((latestRev - prevRev) / prevRev) * 100) : 0;
  const latestMem = memberTrend[memberTrend.length - 1]?.members ?? 0;
  const prevMem = memberTrend[memberTrend.length - 2]?.members ?? 0;
  const memMom = prevMem > 0 ? Math.round(((latestMem - prevMem) / prevMem) * 100) : 0;

  const items = branchMetrics.slice(0, 200).map((m) => ({
    id: m.id,
    title: dashboard.branches.find((b) => b.id === m.branch_id)?.name ?? "Unknown",
    subtitle: m.metric_date ? new Date(m.metric_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A",
    meta: `${formatCurrency(Number(m.revenue_amount ?? 0))} revenue · ${m.attendance_count ?? 0} visits · ${m.active_members ?? 0} members`,
    badge: `${m.trainer_utilization ?? 0}%`,
    badgeVariant: (Number(m.trainer_utilization ?? 0) >= 80 ? "warning" : Number(m.trainer_utilization ?? 0) >= 50 ? "info" : "neutral") as "warning" | "info" | "neutral",
    sections: [
      { label: "Revenue", value: formatCurrency(Number(m.revenue_amount ?? 0)) },
      { label: "Attendance", value: String(m.attendance_count ?? 0) },
      { label: "Members", value: String(m.active_members ?? 0) },
      { label: "Trainer Util", value: `${m.trainer_utilization ?? 0}%` },
      { label: "Class Util", value: `${m.class_utilization ?? 0}%` },
      { label: "Storage", value: `${m.storage_mb ?? 0} MB` },
    ],
    actions: [{ label: "Details", onClick: () => setDetailMetric(m as never), variant: "secondary" as const, icon: <Eye className="size-3.5" /> }]
  }));

  const totalItems = moduleData?.items?.length ?? branchMetrics.length;

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Branch metric snapshots collected" icon={<BarChart3 className="size-5" />} label="Snapshots" value={formatCompactNumber(branchMetrics.length)} />
        <StatCard detail="Month-over-month revenue change" icon={revMom >= 0 ? <TrendingUp className="size-5" /> : <ArrowDown className="size-5" />} label="Revenue MoM" status={revMom >= 0 ? "good" : "risk"} value={`${revMom >= 0 ? "+" : ""}${revMom}%`} />
        <StatCard detail="Month-over-month member change" icon={memMom >= 0 ? <TrendingUp className="size-5" /> : <ArrowDown className="size-5" />} label="Member MoM" status={memMom >= 0 ? "good" : "risk"} value={`${memMom >= 0 ? "+" : ""}${memMom}%`} />
        <StatCard detail="Avg trainer utilization" icon={<Dumbbell className="size-5" />} label="Trainer Util" value={`${dashboard.metrics.avgTrainerUtilization}%`} />
        <StatCard detail="Avg class utilization" icon={<CalendarDays className="size-5" />} label="Class Util" value={`${dashboard.metrics.avgClassUtilization}%`} />
        <StatCard detail="Storage used across all branches" icon={<Gauge className="size-5" />} label="Storage" value={`${formatCompactNumber(dashboard.metrics.storageMb)} MB`} />
      </section>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["overview", "revenue", "members", "utilization"] as const).map((tab) => (
          <button key={tab} className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab} type="button">
            {tab === "overview" ? "Overview" : tab === "revenue" ? "Revenue" : tab === "members" ? "Members" : "Utilization"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {activeTab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Revenue Trend</p><h3 className="text-2xl font-black">Revenue Over Time</h3></CardHeader>
            <CardContent className="h-64">
              {revenueTrend.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={revenueTrend}>
                    <Tooltip />
                    <Line dataKey="revenue" stroke="#111315" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Members</p><h3 className="text-2xl font-black">Member Growth</h3></CardHeader>
            <CardContent className="h-64">
              {memberTrend.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={memberTrend}>
                    <Tooltip />
                    <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance</p><h3 className="text-2xl font-black">Attendance Trend</h3></CardHeader>
            <CardContent className="h-64">
              {attendanceTrend.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={attendanceTrend}>
                    <Tooltip />
                    <Line dataKey="attendance" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Plans</p><h3 className="text-2xl font-black">Plan Distribution</h3></CardHeader>
            <CardContent className="h-64">
              {planDistribution.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">No plan data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {planDistribution.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: REVENUE ═══ */}
      {activeTab === "revenue" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Revenue Trend</h3><p className="text-sm text-muted-foreground">Monthly revenue over time</p></CardHeader>
            <CardContent className="h-72">
              {revenueTrend.length === 0 ? <p className="pt-20 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={revenueTrend}>
                    <Tooltip />
                    <Line dataKey="revenue" stroke="#111315" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Revenue by Branch</h3><p className="text-sm text-muted-foreground">Total revenue per branch</p></CardHeader>
            <CardContent className="h-72">
              {revenueByBranch.length === 0 ? <p className="pt-20 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByBranch} layout="vertical">
                    <Tooltip />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {revenueByBranch.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                    </Bar>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: MEMBERS ═══ */}
      {activeTab === "members" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Member Growth</h3><p className="text-sm text-muted-foreground">Active members over time</p></CardHeader>
            <CardContent className="h-72">
              {memberTrend.length === 0 ? <p className="pt-20 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={memberTrend}>
                    <Tooltip />
                    <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Cohort Summary</h3></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {memberTrend.length >= 2 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-md border border-border bg-background p-4 text-center">
                      <p className="text-xs text-muted-foreground">Latest Month</p>
                      <p className="text-2xl font-black">{formatCompactNumber(latestMem)}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4 text-center">
                      <p className="text-xs text-muted-foreground">Previous Month</p>
                      <p className="text-2xl font-black">{formatCompactNumber(prevMem)}</p>
                    </div>
                    <div className={`rounded-md border p-4 text-center ${memMom >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className="text-xs text-muted-foreground">Growth</p>
                      <p className={`text-2xl font-black ${memMom >= 0 ? "text-green-700" : "text-red-700"}`}>{memMom >= 0 ? "+" : ""}{memMom}%</p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4 text-center">
                      <p className="text-xs text-muted-foreground">Retention</p>
                      <p className="text-2xl font-black">{prevMem > 0 ? Math.min(100, Math.round((latestMem / prevMem) * 100)) : 100}%</p>
                    </div>
                  </div>
                ) : <p className="pt-8 text-center text-sm text-muted-foreground">Need at least 2 months of data</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: UTILIZATION ═══ */}
      {activeTab === "utilization" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Trainer Utilization</h3><p className="text-sm text-muted-foreground">Average trainer utilization over time</p></CardHeader>
            <CardContent className="h-72">
              {trainerUtilTrend.length === 0 ? <p className="pt-20 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={trainerUtilTrend}>
                    <Tooltip />
                    <Line dataKey="avgUtil" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Class Utilization</h3><p className="text-sm text-muted-foreground">Average class fill rate over time</p></CardHeader>
            <CardContent className="h-72">
              {classUtilTrend.length === 0 ? <p className="pt-20 text-center text-sm text-muted-foreground">No data</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={classUtilTrend}>
                    <Tooltip />
                    <Line dataKey="avgUtil" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ RAW DATA ═══ */}
      <FilterBar searchPlaceholder="Filter by branch..." onApply={handleApply} activeFilters={filters as unknown as Record<string, string>} />
      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => {
            const data = branchMetrics.filter((m) => ids.includes(m.id)).map((m) => ({
              branch: dashboard.branches.find((b) => b.id === m.branch_id)?.name, date: m.metric_date,
              revenue: m.revenue_amount, attendance: m.attendance_count, members: m.active_members,
              trainerUtil: m.trainer_utilization, classUtil: m.class_utilization, storage: m.storage_mb
            }));
            exportToCSV(data, "metrics-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(branchMetrics.map((m) => ({
          branch_id: m.branch_id, date: m.metric_date, revenue: m.revenue_amount,
          attendance: m.attendance_count, members: m.active_members,
          trainerUtil: m.trainer_utilization, classUtil: m.class_utilization
        })), "all-metrics")}
        headerTitle="Branch Metrics"
        items={items}
        totalItems={totalItems}
        totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />
    </div>
  );
}
