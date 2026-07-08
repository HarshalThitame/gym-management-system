"use client";

import {
  Activity, AlertTriangle, ArrowUpRight, Banknote, BarChart3, Bell,
  CreditCard, Dumbbell, Gauge, Globe2, LineChart, PiggyBank, RefreshCcw,
  Target, TrendingUp, UsersRound, Zap, Search, FileSpreadsheet, FileJson, FileText
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import type { AuthContext } from "@/types/auth";
import type {
  EnterpriseAnalyticsDashboard, BranchScorecardPoint
} from "@/types/analytics";
import { useAnalyticsLive } from "@/features/analytics/hooks/use-analytics-live";
import { formatAnalyticsLabel, formatCompactNumber, formatCurrency } from "@/features/analytics/lib/business-rules";

type Props = { context: AuthContext; dashboard: EnterpriseAnalyticsDashboard };

type DrillLevel = "platform" | "tenant" | "organization" | "branch" | "trainer" | "member";

export function EnterpriseAnalyticsDashboardClient({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const { connected, latest, connect, disconnect } = useAnalyticsLive();
  const [activeSection, setActiveSection] = useState("executive");
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("platform");
  const [searchQuery, setSearchQuery] = useState("");
  const [showLiveFeed, setShowLiveFeed] = useState(false);
  const [nlpResult, setNlpResult] = useState<string | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { connect(); return () => disconnect(); }, [connect, disconnect]);
  useEffect(() => { if (connected) setShowLiveFeed(true); }, [connected]);

  const summary = dashboard.executiveSummary;

  const handleNlpQuery = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setNlpLoading(true);
    try {
      const res = await fetch("/api/analytics/nl-query", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setNlpResult(JSON.stringify(data.results ?? data, null, 2));
    } catch {
      setNlpResult("Query failed. Please try again.");
    } finally {
      setNlpLoading(false);
    }
  }, []);

  const suggestions: string[] = [];

  const exportFormats = [
    { label: "CSV", icon: <FileSpreadsheet className="size-4" />, href: "/api/analytics/export?format=csv&dataset=executive" },
    { label: "Excel", icon: <FileSpreadsheet className="size-4" />, href: "/api/analytics/export?format=excel&dataset=executive" },
    { label: "PDF", icon: <FileText className="size-4" />, href: "/api/analytics/export?format=pdf&dataset=executive" },
    { label: "JSON", icon: <FileJson className="size-4" />, href: "/api/analytics/export?format=json&dataset=executive" },
    { label: "PPT", icon: <FileText className="size-4" />, href: "/api/analytics/export?format=powerpoint&dataset=executive" }
  ];

  return (
    <div ref={containerRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Enterprise Header */}
      <AnimatedSection>
        <EnterpriseHeader
          connected={connected}
          dashboard={dashboard}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNlpQuery={handleNlpQuery}
          nlpLoading={nlpLoading}
          nlpResult={nlpResult}
          setNlpResult={setNlpResult}
          showLiveFeed={showLiveFeed}
          exportFormats={exportFormats}
          suggestions={suggestions}
        />
      </AnimatedSection>

      {/* Navigation */}
      <AnimatedSection delay={100}>
        <EnterpriseNav activeSection={activeSection} setActiveSection={setActiveSection} dashboard={dashboard} />
      </AnimatedSection>

      {/* Live Feed Bar */}
      {showLiveFeed && (
        <AnimatedSection delay={150}>
          <LiveFeedBar connected={connected} latest={latest} />
        </AnimatedSection>
      )}

      {/* Drill-Down Breadcrumb */}
      <AnimatedSection delay={200}>
        <DrillDownBreadcrumb level={drillLevel} setLevel={setDrillLevel} />
      </AnimatedSection>

      {/* Executive KPIs */}
      {activeSection === "executive" && (
        <AnimatedSection delay={250}>
          <ExecutiveSection dashboard={dashboard} summary={summary} />
        </AnimatedSection>
      )}

      {/* Revenue Intelligence */}
      {activeSection === "revenue" && (
        <AnimatedSection delay={300}>
          <RevenueSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Membership Analytics */}
      {activeSection === "membership" && (
        <AnimatedSection delay={300}>
          <MembershipSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Retention & Churn */}
      {activeSection === "retention" && (
        <AnimatedSection delay={300}>
          <RetentionSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Branch Performance */}
      {activeSection === "branches" && (
        <AnimatedSection delay={300}>
          <BranchSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Training */}
      {activeSection === "trainers" && (
        <AnimatedSection delay={300}>
          <TrainerSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Marketing */}
      {activeSection === "marketing" && (
        <AnimatedSection delay={300}>
          <MarketingSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Forecasting */}
      {activeSection === "forecasting" && (
        <AnimatedSection delay={300}>
          <ForecastSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Alerts */}
      {activeSection === "alerts" && (
        <AnimatedSection delay={300}>
          <AlertsSection dashboard={dashboard} />
        </AnimatedSection>
      )}

      {/* Behavior */}
      {activeSection === "behavior" && (
        <AnimatedSection delay={300}>
          <BehaviorSection dashboard={dashboard} />
        </AnimatedSection>
      )}
    </div>
  );
}

// ANIMATION COMPONENT
function AnimatedSection({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ENTERPRISE HEADER
function EnterpriseHeader({
  connected, dashboard, searchQuery, setSearchQuery,
  onNlpQuery, nlpLoading, nlpResult, setNlpResult, showLiveFeed, exportFormats, suggestions
}: {
  connected: boolean; dashboard: EnterpriseAnalyticsDashboard;
  searchQuery: string; setSearchQuery: (v: string) => void;
  onNlpQuery: (q: string) => void; nlpLoading: boolean; nlpResult: string | null;
  setNlpResult: (v: string | null) => void; showLiveFeed: boolean;
  exportFormats: Array<{ label: string; icon: React.ReactNode; href: string }>;
  suggestions: string[];
}) {
  return (
    <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
      <CardContent className="relative p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                <Zap className="mr-1 size-3" />
                Enterprise BI
              </Badge>
              <LiveStatusDot connected={connected} />
              {showLiveFeed && <Badge className="animate-pulse border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">LIVE</Badge>}
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
              Enterprise Analytics &<br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Business Intelligence</span>
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Real-time executive BI across {dashboard.branchScorecards.length} branches, {dashboard.marketingAnalytics.campaigns.length} campaigns,
              {dashboard.membershipAnalytics.cohorts.length} cohorts, and {dashboard.trainerPerformance.length} trainers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {exportFormats.map((fmt) => (
              <ButtonLink key={fmt.label} href={fmt.href} size="sm" variant="secondary" className="gap-2">
                {fmt.icon}{fmt.label}
              </ButtonLink>
            ))}
          </div>
        </div>

        {/* NLP Query Bar */}
        <div className="mt-6 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onNlpQuery(searchQuery); }}
                placeholder='Ask a question: "Show churn trends for Mumbai branches"'
                className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button onClick={() => onNlpQuery(searchQuery)} disabled={nlpLoading || !searchQuery.trim()} variant="primary" className="gap-2">
              {nlpLoading ? <RefreshCcw className="size-4 animate-spin" /> : <Zap className="size-4" />}
              {nlpLoading ? "Analyzing..." : "Ask AI"}
            </Button>
          </div>

          {!nlpResult && !nlpLoading && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSearchQuery(s); onNlpQuery(s); }}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {nlpResult && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <pre className="overflow-x-auto text-xs font-medium text-foreground/80">{nlpResult}</pre>
                <button onClick={() => setNlpResult(null)} className="shrink-0 text-muted-foreground hover:text-foreground">&times;</button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LiveStatusDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`relative flex size-2.5 ${connected ? "" : "animate-pulse"}`}>
        <span className={`absolute inline-flex size-full rounded-full opacity-75 ${connected ? "bg-green-500" : "bg-red-500"} ${connected ? "" : "animate-ping"}`} />
        <span className={`relative inline-flex size-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{connected ? "Connected" : "Connecting..."}</span>
    </div>
  );
}

function LiveFeedBar({ connected, latest }: { connected: boolean; latest: Record<string, unknown> }) {
  if (!connected) return null;
  return (
    <Card className="border-primary/10">
      <CardContent className="flex flex-wrap items-center gap-6 p-4">
        <LiveMetric label="Live Revenue" value={formatCurrency(Number(latest.revenue ?? 0))} />
        <LiveMetric label="Today Check-ins" value={formatCompactNumber(Number(latest.attendance ?? 0))} />
        <LiveMetric label="Active Subs" value={formatCompactNumber(Number(latest.activeSubscriptions ?? 0))} />
        <span className="text-xs text-muted-foreground">
          Last update: {latest.lastUpdate ? new Date(String(latest.lastUpdate)).toLocaleTimeString("en-IN") : "—"}
        </span>
      </CardContent>
    </Card>
  );
}

function LiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="font-black tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ENTERPRISE NAVIGATION
function EnterpriseNav({ activeSection, setActiveSection, dashboard }: { activeSection: string; setActiveSection: (v: string) => void; dashboard: EnterpriseAnalyticsDashboard }) {
  const navItems = [
    { id: "executive", label: "Executive", icon: <Gauge className="size-4" />, count: 15 },
    { id: "revenue", label: "Revenue", icon: <TrendingUp className="size-4" />, count: dashboard.revenueIntelligence.revenueBySource.length },
    { id: "membership", label: "Membership", icon: <UsersRound className="size-4" />, count: dashboard.membershipAnalytics.cohorts.length },
    { id: "retention", label: "Retention", icon: <AlertTriangle className="size-4" />, count: dashboard.retention.churnTrends.length },
    { id: "branches", label: "Gyms", icon: <Globe2 className="size-4" />, count: dashboard.branchScorecards.length },
    { id: "trainers", label: "Trainers", icon: <Dumbbell className="size-4" />, count: dashboard.trainerPerformance.length },
    { id: "marketing", label: "Marketing", icon: <BarChart3 className="size-4" />, count: dashboard.marketingAnalytics.campaigns.length },
    { id: "forecasting", label: "Forecast", icon: <LineChart className="size-4" />, count: dashboard.forecastScenarios.length },
    { id: "alerts", label: "Alerts", icon: <Bell className="size-4" />, count: dashboard.alerts.length },
    { id: "behavior", label: "Behavior", icon: <Activity className="size-4" />, count: dashboard.behaviorAnalytics.segments.length }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveSection(item.id)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeSection === item.id
              ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
              : "border-border bg-surface text-foreground/70 hover:border-primary/20 hover:text-foreground"
          }`}
        >
          {item.icon}
          {item.label}
          {item.count > 0 && (
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
              activeSection === item.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function DrillDownBreadcrumb({ level, setLevel }: { level: DrillLevel; setLevel: (v: DrillLevel) => void }) {
  const levels: DrillLevel[] = ["platform", "tenant", "organization", "branch", "trainer", "member"];
  const currentIdx = levels.indexOf(level);
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {levels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <button
            onClick={() => setLevel(l)}
            className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
              i <= currentIdx
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {formatAnalyticsLabel(l)}
          </button>
          {i < levels.length - 1 && <ArrowUpRight className="size-3 rotate-45 text-muted-foreground/40" />}
        </div>
      ))}
    </nav>
  );
}

// EXECUTIVE SECTION
function ExecutiveSection({ dashboard, summary }: { dashboard: EnterpriseAnalyticsDashboard; summary: EnterpriseAnalyticsDashboard["executiveSummary"] }) {
  const executiveMetrics = useMemo(() => [
    { label: "Total Revenue", value: formatCurrency(summary.totalRevenue), detail: "All-time platform revenue", icon: <CreditCard className="size-5" />, status: summary.totalRevenue > 0 ? "good" as const : "watch" as const },
    { label: "MRR", value: formatCurrency(summary.mrr), detail: "Monthly Recurring Revenue", icon: <TrendingUp className="size-5" />, status: summary.mrr > 0 ? "good" as const : "watch" as const },
    { label: "ARR", value: formatCurrency(summary.arr), detail: "Annual Recurring Revenue", icon: <TrendingUp className="size-5" />, status: summary.arr > 0 ? "good" as const : "watch" as const },
    { label: "Active Members", value: formatCompactNumber(summary.activeMembers), detail: `${summary.newMembers} new this month`, icon: <UsersRound className="size-5" />, status: "good" as const },
    { label: "Churn Rate", value: `${summary.churnRate}%`, detail: `Retention ${summary.retentionRate}%`, icon: <AlertTriangle className="size-5" />, status: summary.churnRate < 5 ? "good" as const : summary.churnRate < 10 ? "watch" as const : "risk" as const },
    { label: "LTV", value: formatCurrency(summary.lifetimeValue), detail: "Estimated lifetime value", icon: <PiggyBank className="size-5" />, status: "good" as const },
    { label: "ARPM", value: formatCurrency(summary.arpm), detail: "Avg Revenue Per Member", icon: <Banknote className="size-5" />, status: "good" as const },
    { label: "CAC", value: formatCurrency(summary.cac), detail: "Customer Acquisition Cost", icon: <Target className="size-5" />, status: "good" as const },
    { label: "NRR", value: `${summary.nrr}%`, detail: "Net Revenue Retention", icon: <RefreshCcw className="size-5" />, status: summary.nrr >= 100 ? "good" as const : "watch" as const },
    { label: "Refund Rate", value: `${summary.refundRate}%`, detail: "Refund ratio", icon: <CreditCard className="size-5" />, status: summary.refundRate < 5 ? "good" as const : "watch" as const },
    { label: "Occupancy", value: `${summary.occupancyUtilization}%`, detail: "Facility utilization", icon: <Activity className="size-5" />, status: "good" as const },
    { label: "Gym Index", value: formatCurrency(summary.branchPerformanceIndex), detail: "Avg per gym", icon: <BarChart3 className="size-5" />, status: "good" as const }
  ], [summary]);

  return (
    <section id="executive">
      <SectionHeader icon={<Gauge className="size-5" />} subtitle="Real-time enterprise KPIs across all tenants" title="Executive KPI Command Center" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {executiveMetrics.map((m, i) => (
          <AnimatedSection key={m.label} delay={i * 50}>
            <StatCard detail={m.detail} icon={m.icon} label={m.label} status={m.status} value={m.value} />
          </AnimatedSection>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Revenue Sources</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.revenueSources.map((s, i) => (
              <AnimatedSection key={s.source} delay={i * 80}>
                <MetricBar label={s.source} value={s.amount} total={dashboard.revenueSources.reduce((t, r) => t + r.amount, 0)} format="currency" />
              </AnimatedSection>
            ))}
            {dashboard.revenueSources.length === 0 && <EmptyState text="No revenue data yet" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Membership Activity</h3></CardHeader>
          <CardContent className="space-y-3">
            <MiniStat label="Active" value={formatCompactNumber(dashboard.membershipAnalytics.activeMemberships)} status="good" />
            <MiniStat label="New This Month" value={formatCompactNumber(dashboard.membershipAnalytics.newMemberships)} status="good" />
            <MiniStat label="Renewals" value={formatCompactNumber(dashboard.membershipAnalytics.renewals)} status="good" />
            <MiniStat label="Expired" value={formatCompactNumber(dashboard.membershipAnalytics.expirations)} status={dashboard.membershipAnalytics.expirations > 0 ? "watch" : "good"} />
            <MiniStat label="Churn Risk" value={formatCompactNumber(dashboard.retention.churnRiskMembers)} status={dashboard.retention.churnRiskMembers > 0 ? "risk" : "good"} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// REVENUE SECTION
function RevenueSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  const ri = dashboard.revenueIntelligence;
  return (
    <section id="revenue">
      <SectionHeader icon={<TrendingUp className="size-5" />} subtitle="MRR, ARR, deferred revenue, attribution, breakdowns" title="Revenue Intelligence" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickStat label="MRR" value={formatCurrency(ri.mrr)} />
        <QuickStat label="ARR" value={formatCurrency(ri.arr)} />
        <QuickStat label="Collected" value={formatCurrency(ri.collectedRevenue)} />
        <QuickStat label="Expansion" value={formatCurrency(ri.expansionRevenue)} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Revenue by Source</h3></CardHeader>
          <CardContent className="space-y-3">
            {ri.revenueBySource.map((s) => <MetricBar key={s.name} label={s.name} total={ri.mrr} value={s.amount} format="currency" />)}
            {ri.revenueBySource.length === 0 && <EmptyState text="No revenue sources available" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Revenue by Branch</h3></CardHeader>
          <CardContent className="space-y-2">
            {ri.revenueByBranch.slice(0, 10).map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/10">
                <p className="font-semibold">{b.name}</p>
                <p className="font-black tabular-nums">{formatCurrency(b.amount)}</p>
              </div>
            ))}
            {ri.revenueByBranch.length === 0 && <EmptyState text="No branch data" />}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// MEMBERSHIP SECTION
function MembershipSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  const ma = dashboard.membershipAnalytics;
  return (
    <section id="membership">
      <SectionHeader icon={<UsersRound className="size-5" />} subtitle="Lifecycle, cohorts, retention, churn" title="Membership Analytics" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickStat label="Active" value={formatCompactNumber(ma.activeMemberships)} />
        <QuickStat label="New" value={formatCompactNumber(ma.newMemberships)} />
        <QuickStat label="Renewals" value={formatCompactNumber(ma.renewals)} />
        <QuickStat label="Churned" value={formatCompactNumber(ma.expirations + ma.cancellations)} />
      </div>
      {ma.cohorts.length > 0 && (
        <AnimatedSection delay={100}>
          <Card className="mt-5">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black">Membership Cohorts</h3>
                <Badge variant="info">{ma.cohorts.length} cohorts</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="pb-3 pr-4">Cohort</th><th className="pb-3 pr-4">Members</th>
                    <th className="pb-3 pr-4">D7 Ret</th><th className="pb-3 pr-4">D30 Ret</th>
                    <th className="pb-3 pr-4">D90 Ret</th><th className="pb-3 pr-4">Annual</th>
                    <th className="pb-3 pr-4">Churn</th><th className="pb-3">LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {ma.cohorts.slice(0, 12).map((c) => (
                    <tr key={c.cohortDate} className="border-b border-border transition-colors hover:bg-accent/10">
                      <td className="py-3 pr-4 font-semibold">{c.cohortDate}</td>
                      <td className="py-3 pr-4">{c.memberCount}</td>
                      <td className="py-3 pr-4">{c.retentionDay7}%</td>
                      <td className="py-3 pr-4">{c.retentionDay30}%</td>
                      <td className="py-3 pr-4">{c.retentionDay90}%</td>
                      <td className="py-3 pr-4">{c.retentionAnnual ?? "—"}%</td>
                      <td className="py-3 pr-4"><Badge className={c.churnRate > 10 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}>{c.churnRate}%</Badge></td>
                      <td className="py-3 font-black tabular-nums">{formatCurrency(c.lifetimeValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}
    </section>
  );
}

// RETENTION SECTION
function RetentionSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  const r = dashboard.retention;
  return (
    <section id="retention">
      <SectionHeader icon={<AlertTriangle className="size-5" />} subtitle="Retention rates, churn trends, AI prediction" title="Retention & Churn Intelligence" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickStat label="Retention" value={`${r.retentionRate}%`} />
        <QuickStat label="Churn Rate" value={`${r.churnRate}%`} />
        <QuickStat label="At Risk" value={formatCompactNumber(r.churnRiskMembers)} />
        <QuickStat label="LTV" value={formatCurrency(r.estimatedLifetimeValue)} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Retention Funnel</h3></CardHeader>
          <CardContent className="space-y-4">
            <RetentionStage label="Day 7" rate={r.day7Retention} />
            <RetentionStage label="Day 30" rate={r.day30Retention} />
            <RetentionStage label="Day 90" rate={r.day90Retention} />
            <RetentionStage label="Annual" rate={r.annualRetention} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Churn Trends (Last 30 Days)</h3></CardHeader>
          <CardContent className="space-y-2">
            {r.churnTrends.slice(-30).reverse().map((t) => (
              <div key={t.period} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-2.5 text-sm">
                <span className="font-medium">{t.period}</span>
                <span className="text-muted-foreground">{t.churnedMembers} churned</span>
                <Badge className={t.churnRate > 5 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}>{t.churnRate}%</Badge>
              </div>
            ))}
            {r.churnTrends.length === 0 && <EmptyState text="No churn data" />}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RetentionStage({ label, rate }: { label: string; rate: number }) {
  const color = rate >= 80 ? "bg-green-500" : rate >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{label} Retention</p>
        <span className="text-lg font-black">{rate}%</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-border">
        <div className={`h-2.5 rounded-full ${color} transition-all duration-1000`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

// BRANCH SECTION
function BranchSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  const ranking = dashboard.branchRanking;
  return (
    <section id="branches">
      <SectionHeader icon={<Globe2 className="size-5" />} subtitle="Scorecards, benchmarking, ranking" title="Gym Branch & Franchise Performance Franchise Performance" />
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <ScorecardCard title="Top Performers" data={ranking.topPerformers} variant="success" />
        <ScorecardCard title="Underperformers" data={ranking.underperformers} variant="danger" />
        <ScorecardCard title="Growth Leaders" data={ranking.growthLeaders} variant="info" />
      </div>
      {dashboard.branchScorecards.length > 0 && (
        <AnimatedSection delay={150}>
          <Card className="mt-5">
            <CardHeader><h3 className="text-lg font-black">All Branch Scorecards</h3></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="pb-3 pr-3">#</th><th className="pb-3 pr-3">Branch</th>
                    <th className="pb-3 pr-3">Revenue</th><th className="pb-3 pr-3">Members</th>
                    <th className="pb-3 pr-3">Trainer%</th><th className="pb-3">Capacity%</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.branchScorecards.slice(0, 20).map((b) => (
                    <tr key={b.branchId} className="border-b border-border transition-colors hover:bg-accent/10">
                      <td className="py-3 pr-3 font-bold">{b.rank}</td>
                      <td className="py-3 pr-3 font-semibold">{b.branchName}</td>
                      <td className="py-3 pr-3 font-black tabular-nums">{formatCurrency(b.revenue)}</td>
                      <td className="py-3 pr-3">{b.memberCount}</td>
                      <td className="py-3 pr-3">{b.trainerUtilization}%</td>
                      <td className="py-3">{b.capacityUtilization}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}
    </section>
  );
}

function ScorecardCard({ title, data, variant }: { title: string; data: BranchScorecardPoint[]; variant: "success" | "danger" | "info" }) {
  const colors = { success: "text-green-600", danger: "text-red-600", info: "text-blue-600" };
  const bgColors = { success: "border-green-200 bg-green-50", danger: "border-red-200 bg-red-50", info: "border-blue-200 bg-blue-50" };
  return (
    <Card>
      <CardHeader>
        <h3 className={`text-lg font-black ${colors[variant]}`}>{title}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length > 0 ? data.map((b) => (
          <div key={b.branchId} className={`rounded-lg border ${bgColors[variant]} p-4 dark:bg-background`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{b.branchName}</p>
              <Badge className={variant === "success" ? "border-green-200 bg-green-50 text-green-700" : variant === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                {variant === "success" ? `#${b.rank}` : variant === "danger" ? `#${b.rank}` : `${b.growthRate}%`}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <span className="font-semibold">{formatCurrency(b.revenue)} rev</span>
              <span className="font-semibold">{b.memberCount} members</span>
            </div>
          </div>
        )) : <EmptyState text={`No ${title.toLowerCase()} data`} />}
      </CardContent>
    </Card>
  );
}

// TRAINER SECTION
function TrainerSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  return (
    <section id="trainers">
      <SectionHeader icon={<Dumbbell className="size-5" />} subtitle="Performance, revenue, satisfaction" title="Trainer Performance Intelligence" />
      {dashboard.trainerPerformance.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.trainerPerformance.slice(0, 12).map((t, i) => (
            <AnimatedSection key={t.trainerId} delay={i * 60}>
              <div className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-4 transition-all hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{t.trainerName}</p>
                  <Badge variant="info">#{t.rank}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <TrainerStat label="Sessions" value={String(t.sessionsDelivered)} />
                  <TrainerStat label="Revenue" value={formatCurrency(t.revenueGenerated)} />
                  <TrainerStat label="Attendance" value={`${t.attendanceRate}%`} />
                  <TrainerStat label="Satisfaction" value={`${t.customerSatisfaction}/5`} />
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      ) : <EmptyState text="Trainer data appears after sessions are tracked" />}
    </section>
  );
}

function TrainerStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-0.5 font-black tabular-nums">{value}</p></div>;
}

// MARKETING SECTION
function MarketingSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  const ma = dashboard.marketingAnalytics;
  return (
    <section id="marketing">
      <SectionHeader icon={<BarChart3 className="size-5" />} subtitle="Campaigns, attribution, channel ROI" title="Marketing Analytics & Attribution" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickStat label="Campaigns" value={formatCompactNumber(ma.campaigns.length)} />
        <QuickStat label="Leads" value={formatCompactNumber(ma.totalLeads)} />
        <QuickStat label="Conversions" value={formatCompactNumber(ma.totalConversions)} />
        <QuickStat label="Avg ROI" value={`${ma.totalRoi}%`} />
      </div>
      {ma.channelAnalysis.length > 0 && (
        <AnimatedSection delay={100}>
          <Card className="mt-5">
            <CardHeader><h3 className="text-lg font-black">Channel Performance</h3></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="pb-3 pr-4">Channel</th><th className="pb-3 pr-4">Leads</th>
                    <th className="pb-3 pr-4">Conv</th><th className="pb-3 pr-4">Revenue</th>
                    <th className="pb-3 pr-4">CAC</th><th className="pb-3">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {ma.channelAnalysis.map((c) => (
                    <tr key={c.channel} className="border-b border-border transition-colors hover:bg-accent/10">
                      <td className="py-3 pr-4 font-semibold">{formatAnalyticsLabel(c.channel)}</td>
                      <td className="py-3 pr-4">{c.leads}</td>
                      <td className="py-3 pr-4">{c.conversions}</td>
                      <td className="py-3 pr-4 font-black tabular-nums">{formatCurrency(c.revenue)}</td>
                      <td className="py-3 pr-4">{formatCurrency(c.cac)}</td>
                      <td className="py-3"><Badge className={c.roi > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>{c.roi}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}
    </section>
  );
}

// FORECAST SECTION
function ForecastSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  return (
    <section id="forecasting">
      <SectionHeader icon={<LineChart className="size-5" />} subtitle="Revenue, membership projections with scenario modeling" title="Predictive Forecasting Engine" />
      {dashboard.forecastScenarios.length > 0 && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {dashboard.forecastScenarios.map((s, i) => (
            <AnimatedSection key={s.scenario} delay={i * 100}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black">{s.label}</h3>
                    <Badge className={
                      s.scenario === "best_case" ? "border-green-200 bg-green-50 text-green-700" :
                      s.scenario === "expected_case" ? "border-blue-200 bg-blue-50 text-blue-700" :
                      s.scenario === "worst_case" ? "border-red-200 bg-red-50 text-red-700" :
                      "border-amber-200 bg-amber-50 text-amber-800"
                    }>{s.confidence}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Confidence: {s.confidence}%</p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                        <th className="pb-2 pr-4">Month</th><th className="pb-2 pr-4">Revenue</th><th className="pb-2">Members</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.revenueProjections.slice(0, 6).map((p, j) => (
                        <tr key={p.date} className="border-b border-border">
                          <td className="py-2 pr-4 font-semibold">{p.date}</td>
                          <td className="py-2 pr-4 font-black tabular-nums">{formatCurrency(p.value)}</td>
                          <td className="py-2 tabular-nums">{formatCompactNumber(s.membershipProjections[j]?.value ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      )}
      {dashboard.forecasts.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.forecasts.map((f) => (
            <div key={f.metricKey} className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{formatAnalyticsLabel(f.confidence)} confidence</p>
              <p className="mt-2 font-semibold">{f.label}</p>
              <p className="mt-3 text-3xl font-black tabular-nums">{Math.round(f.forecastValue).toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.horizonDays}-day horizon</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ALERTS SECTION
function AlertsSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  return (
    <section id="alerts">
      <SectionHeader icon={<Bell className="size-5" />} subtitle="Automated monitoring, alert triggers, notifications" title="Alerts & Monitoring" />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Active Alerts</h3>
            <p className="text-sm text-muted-foreground">Monitoring revenue, churn, attendance, and performance</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.alerts.length > 0 ? dashboard.alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/20">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{a.alert_name}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={`${a.severity === "critical" ? "border-red-200 bg-red-50 text-red-700" : a.severity === "high" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{formatAnalyticsLabel(a.severity)}</Badge>
                    <Badge className={a.is_active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>{a.is_active ? "Active" : "Paused"}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{formatAnalyticsLabel(a.condition_type)} · {a.metric_key} · Threshold: {a.threshold_value}</p>
              </div>
            )) : <EmptyState text="No active alerts configured" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Alert History</h3>
            <p className="text-sm text-muted-foreground">Recent trigger events</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.alertHistory.slice(0, 10).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                <div>
                  <p className="font-semibold">{h.metric_key}</p>
                  <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("en-IN")}</p>
                </div>
                <Badge className={h.resolved_at ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                  {h.resolved_at ? "Resolved" : "Active"}
                </Badge>
              </div>
            ))}
            {dashboard.alertHistory.length === 0 && <EmptyState text="No alert history" />}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// BEHAVIOR SECTION
function BehaviorSection({ dashboard }: { dashboard: EnterpriseAnalyticsDashboard }) {
  const ba = dashboard.behaviorAnalytics;
  return (
    <section id="behavior">
      <SectionHeader icon={<Activity className="size-5" />} subtitle="Segments, engagement, customer journey" title="Customer Behavior Intelligence" />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Behavioral Segments</h3></CardHeader>
          <CardContent className="space-y-3">
            {ba.segments.length > 0 ? ba.segments.map((s) => (
              <div key={s.segment} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{formatAnalyticsLabel(s.segment)}</p>
                  <Badge variant="info">{s.memberCount} members</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-medium">
                  <span>Check-ins: {s.checkInFrequency}/mo</span>
                  <span>Classes: {s.classAttendance}/mo</span>
                  <span>App: {s.appUsage}%</span>
                </div>
              </div>
            )) : <EmptyState text="No segment data" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Customer Journey</h3></CardHeader>
          <CardContent className="space-y-3">
            {ba.journey.length > 0 ? ba.journey.map((j, i) => (
              <div key={j.stage} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {i > 0 && <ArrowUpRight className="size-3 rotate-45 text-muted-foreground" />}
                    <p className="font-black">{formatAnalyticsLabel(j.stage)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold">{j.count}</span>
                    <Badge variant="info">{j.conversionRate}%</Badge>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-border">
                  <div className="h-2 rounded-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(j.conversionRate, 100)}%` }} />
                </div>
              </div>
            )) : <EmptyState text="No journey data" />}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// SHARED COMPONENTS
function SectionHeader({ icon, subtitle, title }: { icon: React.ReactNode; subtitle: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div>
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-4 transition-all hover:shadow-md">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, status, value }: { label: string; status: "good" | "watch" | "risk"; value: string }) {
  const dotColors: Record<string, string> = { good: "bg-green-500", watch: "bg-amber-500", risk: "bg-red-500" };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dotColors[status] ?? "bg-gray-300"}`} />
        <p className="font-semibold">{label}</p>
      </div>
      <p className="font-black tabular-nums">{value}</p>
    </div>
  );
}

function MetricBar({ label, value, total, format }: { label: string; value: number; total: number; format?: "currency" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/10">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{label}</p>
        <p className="font-black tabular-nums">{format === "currency" ? formatCurrency(value) : String(value)}</p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-border">
          <div className="h-2 rounded-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <Badge variant="info">{pct}%</Badge>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm font-semibold text-muted-foreground">{text}</div>;
}
