"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Building2, Calendar, CreditCard, Download, Dumbbell, Gauge, Globe2, MessageSquare, Plus, RefreshCw, ShieldCheck, Tags, TrendingUp, UserRoundPlus, UsersRound, Clock } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { AnimatedContainer } from "@/components/motion";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { PlanSummaryCard } from "@/features/organization-owner/entitlements";
import { UsageDashboardCard } from "@/features/organization-owner/entitlements";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { getOrgNewLeadsCount } from "@/features/organization-owner/actions/lead-actions";
import { getCrossBranchCheckInsToday } from "@/features/organization-owner/actions/cross-branch-actions";
import { DashboardHeroSection, CinematicMetricsGrid, AnimatedLineChart, ActivityTimeline, OrganizationOverviewCard } from "./dashboard";

type EnterpriseDashboardProps = {
  dashboard: OrganizationOwnerDashboard;
  planContext?: OrgPlanContext | null | undefined;
};

/* ─── Main Dashboard ─── */
export function EnterpriseDashboard({ dashboard, planContext }: EnterpriseDashboardProps) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [refreshing, setRefreshing] = useState(false);
  const [newLeadsThisMonth, setNewLeadsThisMonth] = useState(0);
  const [crossBranchCheckIns, setCrossBranchCheckIns] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => window.location.reload(), 500);
  }, []);

  useEffect(() => {
    if (planContext?.features?.leadManagement) {
      getOrgNewLeadsCount(dashboard.organization.id).then(setNewLeadsThisMonth).catch(() => {});
    }
    if (planContext?.features?.crossBranchMemberAccess) {
      getCrossBranchCheckInsToday(dashboard.organization.id).then(setCrossBranchCheckIns).catch(() => {});
    }
  }, [dashboard.organization.id, planContext?.features?.leadManagement, planContext?.features?.crossBranchMemberAccess]);

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
      {/* ═══ CINEMATIC HERO SECTION ═══ */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="rounded-lg border border-border/50 bg-surface p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex items-start gap-4">
            <div className="hidden rounded-xl bg-accent/10 p-3 md:block">
              <Building2 className="size-8 text-accent" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black md:text-3xl lg:text-4xl">{dashboard.organization.name}</h1>
                <EnterpriseStatusBadge status={dashboard.organization.status} />
                <EnterpriseStatusBadge status="active" />
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Tenant command center · {dashboard.gyms.length} gym{dashboard.gyms.length !== 1 ? "s" : ""} · {dashboard.branches.length} branche{dashboard.branches.length !== 1 ? "s" : ""}
                {planContext ? <span className="ml-2">· <span className="font-semibold">{planContext.packageName}</span> plan</span> : null}
              </p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-wrap items-center gap-3">
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
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:border-border-strong disabled:opacity-50 transition-all" disabled={refreshing} onClick={handleRefresh} type="button">
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </motion.button>
            {planContext ? <ButtonLink href="/organization/plan" size="sm" variant="secondary">Manage Plan</ButtonLink> : null}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ PLAN STATUS ═══ */}
      <PlanSummaryCard />

      {/* ═══ USAGE LIMITS ═══ */}
      <UsageDashboardCard />

      {/* ═══ CINEMATIC METRICS GRID ═══ */}
      <CinematicMetricsGrid
        metrics={[
          {
            icon: CreditCard,
            label: "Revenue",
            value: kpis.revenue.value,
            trend: kpis.revenue.trend ? { value: kpis.revenue.trend.value, isPositive: kpis.revenue.trend.positive } : undefined,
            gradient: { from: "from-emerald-500", to: "to-green-500" },
            accentColor: "bg-emerald-500",
            sparklineData: sparklines.revenue,
          },
          {
            icon: UsersRound,
            label: "Active Members",
            value: kpis.members.value,
            trend: kpis.members.trend ? { value: kpis.members.trend.value, isPositive: kpis.members.trend.positive } : undefined,
            gradient: { from: "from-blue-500", to: "to-cyan-500" },
            accentColor: "bg-blue-500",
            sparklineData: sparklines.members,
          },
          {
            icon: Activity,
            label: "Attendance",
            value: kpis.attendance.value,
            trend: kpis.attendance.trend ? { value: kpis.attendance.trend.value, isPositive: kpis.attendance.trend.positive } : undefined,
            gradient: { from: "from-purple-500", to: "to-pink-500" },
            accentColor: "bg-purple-500",
            sparklineData: sparklines.attendance,
          },
          {
            icon: TrendingUp,
            label: "New This Month",
            value: String(newThisMonth),
            gradient: { from: "from-orange-500", to: "to-red-500" },
            accentColor: "bg-orange-500",
            sparklineData: [10, 15, 20, 25, 30, 35, newThisMonth],
          },
          {
            icon: Building2,
            label: "Gyms",
            value: String(dashboard.gyms.length),
            gradient: { from: "from-indigo-500", to: "to-purple-500" },
            accentColor: "bg-indigo-500",
            sparklineData: [dashboard.gyms.length, dashboard.gyms.length, dashboard.gyms.length, dashboard.gyms.length],
          },
          {
            icon: UsersRound,
            label: "Staff",
            value: formatCompactNumber(staffCount),
            gradient: { from: "from-cyan-500", to: "to-blue-500" },
            accentColor: "bg-cyan-500",
            sparklineData: [staffCount * 0.7, staffCount * 0.75, staffCount * 0.8, staffCount * 0.85, staffCount * 0.9, staffCount * 0.95, staffCount],
          },
          {
            icon: Dumbbell,
            label: "Trainers",
            value: formatCompactNumber(dashboard.trainers.length),
            gradient: { from: "from-pink-500", to: "to-rose-500" },
            accentColor: "bg-pink-500",
            sparklineData: [dashboard.trainers.length * 0.6, dashboard.trainers.length * 0.7, dashboard.trainers.length * 0.8, dashboard.trainers.length * 0.85, dashboard.trainers.length * 0.9, dashboard.trainers.length * 0.95, dashboard.trainers.length],
          },
          {
            icon: Tags,
            label: "Active Memberships",
            value: formatCompactNumber(activeMemberships),
            gradient: { from: "from-violet-500", to: "to-purple-500" },
            accentColor: "bg-violet-500",
            sparklineData: [activeMemberships * 0.5, activeMemberships * 0.6, activeMemberships * 0.7, activeMemberships * 0.8, activeMemberships * 0.9, activeMemberships * 0.95, activeMemberships],
          },
          {
            icon: AlertTriangle,
            label: "Expiring Soon",
            value: String(expiryCount),
            trend: expiryCount > 0 ? { value: expiryCount, isPositive: false } : undefined,
            gradient: { from: "from-yellow-500", to: "to-orange-500" },
            accentColor: "bg-yellow-500",
            sparklineData: [expiryCount, expiryCount, expiryCount, expiryCount, expiryCount, expiryCount, expiryCount],
          },
          ...(planContext?.features?.leadManagement
            ? [
                {
                  icon: UserRoundPlus,
                  label: "New Leads",
                  value: formatCompactNumber(newLeadsThisMonth),
                  gradient: { from: "from-lime-500", to: "to-green-500" },
                  accentColor: "bg-lime-500",
                  sparklineData: [newLeadsThisMonth * 0.3, newLeadsThisMonth * 0.4, newLeadsThisMonth * 0.5, newLeadsThisMonth * 0.6, newLeadsThisMonth * 0.7, newLeadsThisMonth * 0.8, newLeadsThisMonth],
                },
              ]
            : []),
          ...(planContext?.features?.crossBranchMemberAccess
            ? [
                {
                  icon: Globe2,
                  label: "Cross-Gym Check-ins",
                  value: String(crossBranchCheckIns),
                  gradient: { from: "from-sky-500", to: "to-blue-500" },
                  accentColor: "bg-sky-500",
                  sparklineData: [crossBranchCheckIns * 0.4, crossBranchCheckIns * 0.5, crossBranchCheckIns * 0.6, crossBranchCheckIns * 0.7, crossBranchCheckIns * 0.8, crossBranchCheckIns * 0.9, crossBranchCheckIns],
                },
              ]
            : []),
          ...(planContext?.features?.corporateBulkMemberships
            ? [
                {
                  icon: Building2,
                  label: "Corporate Members",
                  value: "Enterprise",
                  gradient: { from: "from-amber-500", to: "to-yellow-500" },
                  accentColor: "bg-amber-500",
                  sparklineData: [1, 1, 1, 1, 1, 1, 1],
                },
              ]
            : []),
          {
            icon: ShieldCheck,
            label: "Security Alerts",
            value: formatCompactNumber(dashboard.metrics.openSecurityEvents),
            trend: dashboard.metrics.openSecurityEvents > 0 ? { value: dashboard.metrics.openSecurityEvents, isPositive: false } : undefined,
            gradient: { from: "from-red-500", to: "to-rose-500" },
            accentColor: "bg-red-500",
            sparklineData: [dashboard.metrics.openSecurityEvents, dashboard.metrics.openSecurityEvents, dashboard.metrics.openSecurityEvents, dashboard.metrics.openSecurityEvents],
          },
        ]}
      />

      {/* ═══ CINEMATIC CHARTS SECTION ═══ */}
      <AnimatedContainer stagger className="grid gap-5 xl:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Revenue Trend</p>
                  <h3 className="text-2xl font-black">Revenue Over Time</h3>
                </div>
                {kpis.revenue.trend ? (
                  <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${kpis.revenue.trend.positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {kpis.revenue.trend.positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {kpis.revenue.trend.value}% vs last month
                  </motion.span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No revenue data available yet.</p>
              ) : (
                <AnimatedLineChart
                  data={chartData}
                  dataKey="revenue"
                  xAxisKey="date"
                  strokeColor="#3b82f6"
                  fillGradientFrom="#3b82f6"
                  fillGradientTo="#8b5cf6"
                  height={300}
                  showLegend={false}
                  darkMode={true}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Members</p>
                  <h3 className="text-2xl font-black">Member Growth</h3>
                </div>
                {kpis.members.trend ? (
                  <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${kpis.members.trend.positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {kpis.members.trend.positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {kpis.members.trend.value}% vs last month
                  </motion.span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <AnimatedLineChart
                data={chartData}
                dataKey="members"
                xAxisKey="date"
                strokeColor="#10b981"
                fillGradientFrom="#10b981"
                fillGradientTo="#059669"
                height={300}
                showLegend={false}
                darkMode={true}
              />
            </CardContent>
          </Card>
        </motion.div>
      </AnimatedContainer>

      {/* ═══ BRANCH PERFORMANCE + ACTIVITY TIMELINE ═══ */}
      <AnimatedContainer stagger className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Branch Performance</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {branchPerformance.map((b, i) => (
                  <motion.div key={b.slug} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ x: 4 }} className="flex items-center justify-between rounded-md border border-border bg-background p-3 transition-all hover:border-border-strong cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-xs font-black text-muted-foreground">{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCompactNumber(b.members)} members · {formatCompactNumber(b.attendance)} visits</p>
                      </div>
                    </div>
                    <p className="text-sm font-black">{formatCurrency(b.revenue)}</p>
                  </motion.div>
                ))}
                {branchPerformance.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No branch data available yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <ActivityTimeline
            items={recentActivity.map((event) => ({
              id: event.id,
              title: formatEnterpriseLabel(event.event_type),
              description: formatEnterpriseLabel(event.entity_type),
              timestamp: new Date(event.created_at),
              type:
                event.severity === "critical" ? "alert" :
                event.severity === "warning" ? "alert" :
                event.severity === "notice" ? "update" : "activity",
            }))}
          />
        </motion.div>
      </AnimatedContainer>

      {/* ═══ SECURITY ALERTS SECTION ═══ */}
      <AnimatedContainer stagger>
        {openAlerts.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-amber-500" />
                    <h3 className="text-xl font-black">Security Alerts</h3>
                  </div>
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{openAlerts.length} open</motion.span>
                </div>
              </CardHeader>
              <CardContent>
                <motion.div className="space-y-3">
                  {openAlerts.map((alert, i) => (
                    <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ x: 4 }} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 transition-all">
                      <div>
                        <p className="text-sm font-bold text-amber-900">{formatEnterpriseLabel(alert.event_type)}</p>
                        <p className="text-xs text-amber-700">{alert.description ?? ""}</p>
                      </div>
                      <EnterpriseStatusBadge status={alert.severity} />
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatedContainer>

      {/* ═══ QUICK ACTIONS SECTION ═══ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="rounded-lg border border-border bg-surface p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Quick Actions</p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ staggerChildren: 0.1, delayChildren: 0.2 }} className="mt-3 flex flex-wrap gap-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
            <ButtonLink href="/organization/members" size="sm" variant="secondary"><Plus className="size-3.5" /> Add Member</ButtonLink>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17, delay: 0.1 }}>
            <ButtonLink href="/organization/branches" size="sm" variant="secondary"><Plus className="size-3.5" /> Create Location</ButtonLink>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17, delay: 0.2 }}>
            <ButtonLink href="/organization/memberships" size="sm" variant="secondary"><Plus className="size-3.5" /> New Plan</ButtonLink>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17, delay: 0.3 }}>
            <ButtonLink href="/organization/trainers" size="sm" variant="secondary"><Plus className="size-3.5" /> Add Trainer</ButtonLink>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17, delay: 0.4 }}>
            <ButtonLink href="/organization/revenue" size="sm" variant="secondary"><Download className="size-3.5" /> Revenue Report</ButtonLink>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17, delay: 0.5 }}>
            <ButtonLink href="/organization/support" size="sm" variant="secondary"><MessageSquare className="size-3.5" /> Get Support</ButtonLink>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
