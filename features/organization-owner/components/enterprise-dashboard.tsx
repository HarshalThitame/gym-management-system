"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Building2, Calendar, CreditCard, Download, Dumbbell, Gauge, Globe2, MessageSquare, Plus, RefreshCw, ShieldCheck, Tags, TrendingUp, UsersRound } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";

type EnterpriseDashboardProps = {
  dashboard: OrganizationOwnerDashboard;
  planContext?: OrgPlanContext | null | undefined;
};

/* ─── Mini Sparkline ─── */
function Sparkline({ data, color = "#111315" }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-8" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 60;
  const h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg className="h-7 w-[60px] shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

/* ─── Enhanced KPI Widget ─── */
type EnhancedKpiWidgetProps = {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean } | null;
  sparklineData?: number[];
  status?: "good" | "watch" | "risk";
};

function EnhancedKpiWidget({ label, value, detail, icon, trend, sparklineData, status }: EnhancedKpiWidgetProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 transition-all hover:border-border-strong hover:shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-accent/10 p-1.5 text-foreground">{icon}</div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            {status ? (
              <span className={`size-2 shrink-0 rounded-full ${status === "good" ? "bg-green-500" : status === "watch" ? "bg-amber-500" : "bg-red-500"}`} />
            ) : null}
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-3xl font-black leading-none">{value}</p>
            {trend ? (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${trend.positive ? "text-green-600" : "text-red-600"}`}>
                {trend.positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {Math.abs(trend.value)}%
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        {sparklineData ? <Sparkline color={status === "risk" ? "#dc2626" : status === "watch" ? "#f59e0b" : "#16a34a"} data={sparklineData} /> : null}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export function EnterpriseDashboard({ dashboard, planContext }: EnterpriseDashboardProps) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => window.location.reload(), 500);
  }, []);

  // ── Compute KPIs with trends ──
  const { kpis, sparklines } = useMemo(() => {
    const branchMetrics = dashboard.branchMetrics;
    const now = new Date();
    const currentMonth = branchMetrics.filter((m) => m.metric_date?.startsWith(now.toISOString().slice(0, 7)));
    const prevMonth = branchMetrics.filter((m) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return m.metric_date?.startsWith(d.toISOString().slice(0, 7));
    });

    const currRevenue = currentMonth.reduce((s, m) => s + Number(m.revenue_amount ?? 0), 0);
    const prevRevenue = prevMonth.reduce((s, m) => s + Number(m.revenue_amount ?? 0), 0);
    const currMembers = Math.max(0, ...currentMonth.map((m) => Number(m.active_members ?? 0)));
    const prevMembers = Math.max(0, ...prevMonth.map((m) => Number(m.active_members ?? 0)));
    const currAttendance = currentMonth.reduce((s, m) => s + Number(m.attendance_count ?? 0), 0);
    const prevAttendance = prevMonth.reduce((s, m) => s + Number(m.attendance_count ?? 0), 0);

    const revenueTrend = prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const memberTrend = prevMembers > 0 ? ((currMembers - prevMembers) / prevMembers) * 100 : 0;
    const attendanceTrend = prevAttendance > 0 ? ((currAttendance - prevAttendance) / prevAttendance) * 100 : 0;

    // Build sparkline data (last 6 months)
    const sparklineRevenue: number[] = [];
    const sparklineMembers: number[] = [];
    const sparklineAttendance: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = d.toISOString().slice(0, 7);
      const monthData = branchMetrics.filter((m) => m.metric_date?.startsWith(prefix));
      sparklineRevenue.push(monthData.reduce((s, m) => s + Number(m.revenue_amount ?? 0), 0));
      sparklineMembers.push(Math.max(0, ...monthData.map((m) => Number(m.active_members ?? 0))));
      sparklineAttendance.push(monthData.reduce((s, m) => s + Number(m.attendance_count ?? 0), 0));
    }

    return {
      kpis: {
        revenue: { value: formatCurrency(currRevenue || dashboard.metrics.totalRevenue), trend: revenueTrend !== 0 ? { value: Math.abs(Math.round(revenueTrend)), positive: revenueTrend > 0 } : null, status: (revenueTrend < -10 ? "risk" : revenueTrend < 0 ? "watch" : "good") as "good" | "watch" | "risk" },
        members: { value: formatCompactNumber(currMembers || dashboard.metrics.activeMembers), trend: memberTrend !== 0 ? { value: Math.abs(Math.round(memberTrend)), positive: memberTrend > 0 } : null, status: (memberTrend < -5 ? "risk" : memberTrend < 0 ? "watch" : "good") as "good" | "watch" | "risk" },
        attendance: { value: formatCompactNumber(currAttendance || dashboard.metrics.totalAttendance), trend: attendanceTrend !== 0 ? { value: Math.abs(Math.round(attendanceTrend)), positive: attendanceTrend > 0 } : null, status: "good" as const },
      },
      sparklines: { revenue: sparklineRevenue, members: sparklineMembers, attendance: sparklineAttendance }
    };
  }, [dashboard]);

  // ── Compute chart data ──
  const chartData = useMemo(() => {
    const byMonth = new Map<string, { revenue: number; members: number; attendance: number }>();
    for (const m of dashboard.branchMetrics) {
      if (!m.metric_date) continue;
      const key = m.metric_date.slice(0, 7);
      const prev = byMonth.get(key) ?? { revenue: 0, members: 0, attendance: 0 };
      byMonth.set(key, {
        revenue: prev.revenue + Number(m.revenue_amount ?? 0),
        members: Math.max(prev.members, Number(m.active_members ?? 0)),
        attendance: prev.attendance + Number(m.attendance_count ?? 0)
      });
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, data]) => ({ date, ...data }));
  }, [dashboard.branchMetrics]);

  // ── Compute branch performance ──
  const branchPerformance = useMemo(() => {
    return dashboard.branches.map((b) => {
      const bm = dashboard.branchMetrics.filter((m) => m.branch_id === b.id);
      const rev = bm.reduce((s, m) => s + Number(m.revenue_amount ?? 0), 0);
      const att = bm.reduce((s, m) => s + Number(m.attendance_count ?? 0), 0);
      const mem = Math.max(0, ...bm.map((m) => Number(m.active_members ?? 0)));
      return { name: b.name, revenue: rev, attendance: att, members: mem, slug: b.slug };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [dashboard.branches, dashboard.branchMetrics]);

  // ── Recent activity ──
  const recentActivity = dashboard.activityEvents.slice(0, 8);
  const openAlerts = dashboard.securityEvents.filter((e) => e.status === "open" || e.status === "investigating").slice(0, 5);

  // ── Quick stats ──
  const activeMemberships = dashboard.memberships.filter((m) => m.status === "active").length;
  const staffCount = dashboard.branchUsers.filter((u) => u.role_name !== "member" && u.role_name !== "trainer").length;
  const newThisMonth = dashboard.members.filter((m) => {
    if (!m.joined_at) return false;
    const jd = new Date(m.joined_at);
    const now = new Date();
    return jd.getMonth() === now.getMonth() && jd.getFullYear() === now.getFullYear();
  }).length;
  const expiryCount = dashboard.memberships.filter((m) => {
    if (!m.end_date || m.status !== "active") return false;
    const exp = new Date(m.end_date).getTime();
    const now = Date.now();
    return exp > now && exp < now + 30 * 86400000;
  }).length;

  return (
    <div className="space-y-6">
      {/* ═══ HERO SECTION ═══ */}
      <section className="rounded-lg border border-border bg-surface p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden rounded-xl bg-accent/10 p-3 md:block">
              <Building2 className="size-8 text-accent" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black md:text-3xl lg:text-4xl">{dashboard.organization.name}</h1>
                <EnterpriseStatusBadge status={dashboard.organization.status} />
                <EnterpriseStatusBadge status={dashboard.organization.organization_type} />
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Tenant command center · {dashboard.gyms.length} gym{dashboard.gyms.length !== 1 ? "s" : ""} · {dashboard.branches.length} branche{dashboard.branches.length !== 1 ? "s" : ""}
                {planContext ? <span className="ml-2">· <span className="font-semibold">{planContext.packageName}</span> plan</span> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
              <Calendar className="size-3.5" />
              <span className="hidden sm:inline">Period: </span>
              <select className="border-none bg-transparent p-0 text-xs font-bold text-foreground focus:outline-none" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="1y">1 year</option>
              </select>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:border-border-strong disabled:opacity-50" disabled={refreshing} onClick={handleRefresh} type="button">
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            {planContext ? <ButtonLink href="/organization/plan" size="sm" variant="secondary">Manage Plan</ButtonLink> : null}
          </div>
        </div>
      </section>

      {/* ═══ KPI GRID ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EnhancedKpiWidget detail="Total revenue from all branches" icon={<CreditCard className="size-4" />} label="Revenue" value={kpis.revenue.value} trend={kpis.revenue.trend} sparklineData={sparklines.revenue} status={kpis.revenue.status} />
        <EnhancedKpiWidget detail="Active member profiles across all gyms" icon={<UsersRound className="size-4" />} label="Active Members" value={kpis.members.value} trend={kpis.members.trend} sparklineData={sparklines.members} status={kpis.members.status} />
        <EnhancedKpiWidget detail="Check-ins this period" icon={<Activity className="size-4" />} label="Attendance" value={kpis.attendance.value} trend={kpis.attendance.trend} sparklineData={sparklines.attendance} />
        <EnhancedKpiWidget detail="New members joined this month" icon={<TrendingUp className="size-4" />} label="New This Month" value={String(newThisMonth)} />
        <EnhancedKpiWidget detail="Total gym locations" icon={<Building2 className="size-4" />} label="Gyms" value={String(dashboard.gyms.length)} />
        <EnhancedKpiWidget detail="Total staff across all branches" icon={<UsersRound className="size-4" />} label="Staff" value={formatCompactNumber(staffCount)} />
        <EnhancedKpiWidget detail="Trainers across all gyms" icon={<Dumbbell className="size-4" />} label="Trainers" value={formatCompactNumber(dashboard.trainers.length)} />
        <EnhancedKpiWidget detail="Active membership subscriptions" icon={<Tags className="size-4" />} label="Active Memberships" value={formatCompactNumber(activeMemberships)} />
        <EnhancedKpiWidget detail="Memberships expiring in 30 days" icon={<AlertTriangle className="size-4" />} label="Expiring Soon" value={String(expiryCount)} status={(expiryCount > 10 ? "risk" : expiryCount > 5 ? "watch" : "good") as "good" | "watch" | "risk"} />
        <EnhancedKpiWidget detail="Open or investigating security events" icon={<ShieldCheck className="size-4" />} label="Security Alerts" value={formatCompactNumber(dashboard.metrics.openSecurityEvents)} status={(dashboard.metrics.openSecurityEvents > 0 ? "watch" : "good") as "good" | "watch" | "risk"} />
      </div>

      {/* ═══ CHARTS SECTION ═══ */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Revenue Trend</p>
                <h3 className="text-2xl font-black">Revenue Over Time</h3>
              </div>
              {kpis.revenue.trend ? (
                <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${kpis.revenue.trend.positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {kpis.revenue.trend.positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {kpis.revenue.trend.value}% vs last month
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No revenue data available yet.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={chartData}>
                    <Tooltip />
                    <Line dataKey="revenue" stroke="#111315" strokeWidth={2} dot={{ r: 3, fill: "#111315" }} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Members</p>
                <h3 className="text-2xl font-black">Member Growth</h3>
              </div>
              {kpis.members.trend ? (
                <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${kpis.members.trend.positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {kpis.members.trend.positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {kpis.members.trend.value}% vs last month
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={chartData}>
                  <Tooltip />
                  <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ BRANCH PERFORMANCE + ACTIVITY ═══ */}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Branch Performance</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {branchPerformance.map((b, i) => (
                <div key={b.slug} className="flex items-center justify-between rounded-md border border-border bg-background p-3 transition-all hover:border-border-strong">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-xs font-black text-muted-foreground">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCompactNumber(b.members)} members · {formatCompactNumber(b.attendance)} visits</p>
                    </div>
                  </div>
                  <p className="text-sm font-black">{formatCurrency(b.revenue)}</p>
                </div>
              ))}
              {branchPerformance.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No branch data available yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">Recent Activity</h3>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{dashboard.activityEvents.length} total</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : recentActivity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-md p-2 transition-all hover:bg-surface-muted">
                  <div className={`mt-1 size-2 shrink-0 rounded-full ${
                    event.severity === "critical" ? "bg-red-500" :
                    event.severity === "warning" ? "bg-amber-500" :
                    event.severity === "notice" ? "bg-blue-500" : "bg-gray-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{formatEnterpriseLabel(event.event_type)}</p>
                    <p className="text-xs text-muted-foreground">{formatEnterpriseLabel(event.entity_type)} · {new Date(event.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ ALERTS BAR ═══ */}
      {openAlerts.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                <h3 className="text-xl font-black">Security Alerts</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{openAlerts.length} open</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div>
                    <p className="text-sm font-bold text-amber-900">{formatEnterpriseLabel(alert.event_type)}</p>
                    <p className="text-xs text-amber-700">{alert.description ?? ""}</p>
                  </div>
                  <EnterpriseStatusBadge status={alert.severity} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══ QUICK ACTIONS ═══ */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Quick Actions</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href="/organization/members" size="sm" variant="secondary"><Plus className="size-3.5" /> Add Member</ButtonLink>
          <ButtonLink href="/organization/branches" size="sm" variant="secondary"><Plus className="size-3.5" /> Create Location</ButtonLink>
          <ButtonLink href="/organization/memberships" size="sm" variant="secondary"><Plus className="size-3.5" /> New Plan</ButtonLink>
          <ButtonLink href="/organization/trainers" size="sm" variant="secondary"><Plus className="size-3.5" /> Add Trainer</ButtonLink>
          <ButtonLink href="/organization/revenue" size="sm" variant="secondary"><Download className="size-3.5" /> Revenue Report</ButtonLink>
          <ButtonLink href="/organization/support" size="sm" variant="secondary"><MessageSquare className="size-3.5" /> Get Support</ButtonLink>
        </div>
      </div>
    </div>
  );
}
