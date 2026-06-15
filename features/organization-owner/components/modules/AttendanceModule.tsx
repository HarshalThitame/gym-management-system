"use client";

import { useCallback, useMemo, useState } from "react";
import { Activity, CalendarCheck, Clock, Download, Eye, Percent, TrendingUp, XCircle } from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart as RechartsLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type AttendanceEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

const CHART_COLORS = ["#16a34a", "#dc2626", "#f59e0b", "#0891b2"];

export function AttendanceEnterpriseModule({ dashboard, moduleData }: AttendanceEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [detailLog, setDetailLog] = useState<Record<string, unknown> | null>(null);
  const [chartTab, setChartTab] = useState<"trend" | "hour" | "weekday">("trend");

  const logs = (moduleData?.items ?? dashboard.attendanceLogs) as typeof dashboard.attendanceLogs;

  const handleApply = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, status: f.status, dateFrom: f.dateFrom, dateTo: f.dateTo });
  }, [navigate]);

  // ── KPIs ──
  const successLogs = logs.filter((l) => l.result === "success");
  const deniedLogs = logs.filter((l) => l.result === "denied");
  const successRate = logs.length > 0 ? Math.round((successLogs.length / logs.length) * 100) : 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter((l) => l.occurred_at?.startsWith(todayStr)).length;
  const peakHour = useMemo(() => {
    const hours = new Map<number, number>();
    for (const l of logs) {
      const h = new Date(l.occurred_at).getHours();
      hours.set(h, (hours.get(h) ?? 0) + 1);
    }
    let maxH = 0, maxC = 0;
    hours.forEach((c, h) => { if (c > maxC) { maxC = c; maxH = h; } });
    return `${maxH.toString().padStart(2, "0")}:00`;
  }, [logs]);

  // ── Attendance Trend (daily) ──
  const dailyTrend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const l of logs) {
      const day = l.occurred_at?.slice(0, 10) ?? "unknown";
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return Array.from(byDay.entries()).slice(-30).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [logs]);

  // ── Hour Distribution ──
  const hourDist = useMemo(() => {
    const hours = new Map<number, number>();
    for (const l of logs) {
      const h = new Date(l.occurred_at).getHours();
      hours.set(h, (hours.get(h) ?? 0) + 1);
    }
    return Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, "0")}:00`, count: hours.get(i) ?? 0 }));
  }, [logs]);

  // ── Weekday Distribution ──
  const weekdayDist = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    for (const l of logs) {
      const d = new Date(l.occurred_at).getDay();
      counts[d]++;
    }
    return days.map((name, i) => ({ name, count: counts[i] }));
  }, [logs]);

  // ── Items ──
  const items = logs.slice(0, 200).map((log) => {
    const member = log.member_id ? dashboard.members.find((m) => m.id === log.member_id) : null;
    const gym = log.gym_id ? dashboard.gyms.find((g) => g.id === log.gym_id) : null;
    return {
      id: log.id,
      title: member?.full_name ?? formatEnterpriseLabel(log.action),
      subtitle: member ? `${member.member_code} · ${member.phone}` : undefined,
      meta: `${gym?.name ?? "—"} · ${log.source ? formatEnterpriseLabel(log.source) : ""} · ${log.message ?? ""} · ${new Date(log.occurred_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      badge: log.result,
      badgeVariant: (log.result === "success" ? "success" : log.result === "denied" ? "error" : "warning") as "success" | "error" | "warning",
      status: log.result,
      sections: [
        { label: "Member", value: member?.full_name ?? "—" },
        { label: "Action", value: formatEnterpriseLabel(log.action) },
        { label: "Branch", value: gym?.name ?? "—" },
        { label: "Time", value: new Date(log.occurred_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailLog(log as unknown as Record<string, unknown>), variant: "secondary" as const, icon: <Eye className="size-3.5" /> }
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? logs.length;

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total attendance records" icon={<CalendarCheck className="size-5" />} label="Total Logs" value={formatCompactNumber(logs.length)} />
        <StatCard detail="Successful check-ins" icon={<Activity className="size-5" />} label="Success" value={formatCompactNumber(successLogs.length)} />
        <StatCard detail="Denied access attempts" icon={<XCircle className="size-5" />} label="Denied" status={deniedLogs.length > 0 ? "risk" : "good"} value={formatCompactNumber(deniedLogs.length)} />
        <StatCard detail="Check-in success rate" icon={<Percent className="size-5" />} label="Success Rate" status={successRate >= 95 ? "good" : successRate >= 85 ? "watch" : "risk"} value={`${successRate}%`} />
        <StatCard detail="Check-ins today" icon={<TrendingUp className="size-5" />} label="Today" value={formatCompactNumber(todayCount)} />
        <StatCard detail="Busiest hour of the day" icon={<Clock className="size-5" />} label="Peak Hour" value={peakHour} />
        <StatCard detail="From branch metric snapshots" icon={<CalendarCheck className="size-5" />} label="Metric" value={formatCompactNumber(dashboard.metrics.totalAttendance)} />
      </section>

      {/* ═══ CHARTS ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Analytics</p><h3 className="text-2xl font-black">Attendance Analytics</h3></div>
            <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
              <button className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${chartTab === "trend" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setChartTab("trend")} type="button">Daily</button>
              <button className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${chartTab === "hour" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setChartTab("hour")} type="button">Hourly</button>
              <button className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${chartTab === "weekday" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setChartTab("weekday")} type="button">Weekday</button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartTab === "trend" ? (
            dailyTrend.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No attendance data yet.</p> : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLine data={dailyTrend}>
                    <Tooltip />
                    <Line dataKey="count" stroke="#111315" strokeWidth={2} dot={{ r: 2 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                  </RechartsLine>
                </ResponsiveContainer>
              </div>
            )
          ) : chartTab === "hour" ? (
            hourDist.every((h) => h.count === 0) ? <p className="py-12 text-center text-sm text-muted-foreground">No hourly data yet.</p> : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourDist}>
                    <Tooltip />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {hourDist.map((h, i) => <Cell key={i} {...{ fill: h.count > 0 ? CHART_COLORS[0] : "#e5e7eb" } as any} />)}
                    </Bar>
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            weekdayDist.every((d) => d.count === 0) ? <p className="py-12 text-center text-sm text-muted-foreground">No weekday data yet.</p> : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayDist}>
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {weekdayDist.map((d, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                    </Bar>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* ═══ FILTERS + DATA LIST ═══ */}
      <FilterBar
        filterGroups={[        { key: "status", label: "Result", options: [
          { value: "success", label: "Success" }, { value: "denied", label: "Denied" }, { value: "warning", label: "Warning" }, { value: "reversed", label: "Reversed" }
        ]}]}
        searchPlaceholder="Search by member name, action, or branch..."
        onApply={handleApply}
        activeFilters={filters as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => {
            const data = logs.filter((l) => ids.includes(l.id)).map((l) => ({
              action: l.action, result: l.result, member: dashboard.members.find((m) => m.id === l.member_id)?.full_name,
              gym: dashboard.gyms.find((g) => g.id === l.gym_id)?.name, time: l.occurred_at
            }));
            exportToCSV(data, "attendance-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(logs.slice(0, 500).map((l) => ({
          action: l.action, result: l.result, source: l.source, member_id: l.member_id, gym_id: l.gym_id, time: l.occurred_at
        })), "all-attendance")}
        headerTitle="Attendance Logs"
        items={items}
        totalItems={totalItems}
        totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ DETAIL PANEL ═══ */}
      {detailLog ? <AttendanceDetailPanel log={detailLog} dashboard={dashboard} onClose={() => setDetailLog(null)} /> : null}
    </div>
  );
}

function AttendanceDetailPanel({ log, dashboard, onClose }: { log: Record<string, unknown>; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const member = log.member_id ? dashboard.members.find((m) => m.id === log.member_id) : null;
  const gym = log.gym_id ? dashboard.gyms.find((g) => g.id === log.gym_id) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Attendance details">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{formatEnterpriseLabel(log.action as string)}</h2>
              <EnterpriseStatusBadge status={log.result as string} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{new Date(log.occurred_at as string).toLocaleString("en-IN")}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Activity className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Access Event</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Action</p><p className="text-sm font-bold">{formatEnterpriseLabel(log.action as string)}</p></div>
              <div><p className="text-xs text-muted-foreground">Result</p><EnterpriseStatusBadge status={log.result as string} /></div>
              <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-bold">{log.source ? formatEnterpriseLabel(log.source as string) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Message</p><p className="text-sm font-bold">{log.message as string ?? "—"}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Timestamp</p><p className="text-sm font-bold">{new Date(log.occurred_at as string).toLocaleString("en-IN")}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Member</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-bold">{member?.full_name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Code</p><p className="text-sm font-bold">{member?.member_code ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-bold">{member?.phone ?? "—"}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Location</h3></CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{gym?.name ?? "—"}</p></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


