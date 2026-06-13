"use client";

import {
  Activity, AlertTriangle, BarChart3, Bell, Box, Cpu, Database, Dumbbell, Gauge, Globe2,
  HeartPulse, Inbox, LifeBuoy, LineChart, Loader2, RefreshCcw, Route, Server, ShieldCheck,
  TrendingUp, UsersRound, Zap, Layers, GitBranch, Clock, Radio, Network
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import type { AuthContext } from "@/types/auth";
import type { ObservabilityDashboard } from "@/features/observability/services/observability-service";
import { useObservabilityLive } from "@/features/observability/hooks/use-observability-live";
import { formatAnalyticsLabel, formatCompactNumber, formatCurrency } from "@/features/analytics/lib/business-rules";

type Props = { context: AuthContext; dashboard: ObservabilityDashboard };
type TabId = "overview" | "services" | "incidents" | "queues" | "cron" | "errors" | "oncall" | "capacity" | "tenants" | "escalation" | "tracing" | "infra" | "slo" | "deployments" | "regions" | "dr" | "status";

export function ObservabilityDashboardClient({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const { connected, data: live } = useObservabilityLive();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const h = dashboard.platformHealth;

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }> = [
    { id: "overview", label: "Overview", icon: <Gauge className="size-4" /> },
    { id: "services", label: "Services", icon: <Server className="size-4" />, count: dashboard.services.length },
    { id: "incidents", label: "Incidents", icon: <AlertTriangle className="size-4" />, count: h.activeIncidents },
    { id: "tracing", label: "Tracing", icon: <Route className="size-4" />, count: dashboard.tracesByService.length },
    { id: "infra", label: "Infrastructure", icon: <Cpu className="size-4" />, count: dashboard.infraSummary.totalHosts },
    { id: "slo", label: "SLO/Budget", icon: <Target className="size-4" />, count: dashboard.sloDefinitions.length },
    { id: "queues", label: "Queues", icon: <Inbox className="size-4" />, count: dashboard.queues.length },
    { id: "cron", label: "Cron", icon: <RefreshCcw className="size-4" />, count: dashboard.cronJobs.length },
    { id: "errors", label: "Errors", icon: <AlertTriangle className="size-4" />, count: dashboard.errors.filter((e) => !e.isResolved).length },
    { id: "deployments", label: "Deployments", icon: <GitBranch className="size-4" />, count: dashboard.deployments.length },
    { id: "regions", label: "Regions", icon: <Globe2 className="size-4" />, count: dashboard.regions.length },
    { id: "dr", label: "DR", icon: <ShieldCheck className="size-4" />, count: dashboard.drStatus.length },
    { id: "oncall", label: "On-Call", icon: <Bell className="size-4" />, count: dashboard.oncallSchedules.length },
    { id: "capacity", label: "Capacity", icon: <TrendingUp className="size-4" /> },
    { id: "status", label: "Status Page", icon: <Radio className="size-4" />, count: dashboard.statusComponents.length },
    { id: "tenants", label: "Tenants", icon: <UsersRound className="size-4" /> },
    { id: "escalation", label: "Escalation", icon: <LifeBuoy className="size-4" /> }
  ];

  return (
    <div className="space-y-6">
      <HeaderSection dashboard={dashboard} connected={connected} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} />

      <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />

      {activeTab === "overview" && <OverviewSection dashboard={dashboard} live={live} />}
      {activeTab === "services" && <ServicesSection dashboard={dashboard} />}
      {activeTab === "incidents" && <IncidentsSection dashboard={dashboard} />}
      {activeTab === "tracing" && <TracingSection dashboard={dashboard} />}
      {activeTab === "infra" && <InfraSection dashboard={dashboard} />}
      {activeTab === "slo" && <SloSection dashboard={dashboard} />}
      {activeTab === "queues" && <QueuesSection dashboard={dashboard} />}
      {activeTab === "cron" && <CronSection dashboard={dashboard} />}
      {activeTab === "errors" && <ErrorsSection dashboard={dashboard} />}
      {activeTab === "deployments" && <DeploymentsSection dashboard={dashboard} />}
      {activeTab === "regions" && <RegionsSection dashboard={dashboard} />}
      {activeTab === "dr" && <DrSection dashboard={dashboard} />}
      {activeTab === "oncall" && <OncallSection dashboard={dashboard} />}
      {activeTab === "capacity" && <CapacitySection dashboard={dashboard} />}
      {activeTab === "status" && <StatusPageSection dashboard={dashboard} />}
      {activeTab === "tenants" && <TenantsSection dashboard={dashboard} />}
      {activeTab === "escalation" && <EscalationSection dashboard={dashboard} />}
    </div>
  );
}

function Target({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}

// HEADER
function HeaderSection({ dashboard, connected, autoRefresh, setAutoRefresh }: { dashboard: ObservabilityDashboard; connected: boolean; autoRefresh: boolean; setAutoRefresh: (v: boolean) => void }) {
  const h = dashboard.platformHealth;
  const posture = h.overallScore >= 90 ? "good" : h.overallScore >= 70 ? "watch" : "risk";
  const postureColors = { good: "border-green-200 bg-green-50 text-green-700", watch: "border-amber-200 bg-amber-50 text-amber-800", risk: "border-red-200 bg-red-50 text-red-700" };
  return (
    <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
      <CardContent className="relative p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800">Observability Center</Badge>
              <LiveDot connected={connected} />
              <Badge className={postureColors[posture]}>{posture === "good" ? "All Systems Healthy" : posture === "watch" ? "Needs Attention" : "Critical Issues"}</Badge>
              <button onClick={() => setAutoRefresh(!autoRefresh)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${autoRefresh ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                <RefreshCcw className={`size-3 ${autoRefresh ? "animate-spin" : ""}`} /> {autoRefresh ? "Live" : "Paused"}
              </button>
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
              Enterprise Observability<br />
              <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Command Center</span>
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              {h.totalServices} services · {dashboard.queues.length} queues · {dashboard.cronJobs.length} cron jobs ·
              {h.activeIncidents} incidents · {dashboard.infraSummary.totalHosts} hosts · {dashboard.sloDefinitions.length} SLOs ·
              {dashboard.tracesByService.length} traced services · {dashboard.regions.length} regions
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/api/health" variant="primary" className="gap-2"><HeartPulse className="size-4" /> Health API</ButtonLink>
            <ButtonLink href="/api/observability/live" variant="secondary" className="gap-2"><Radio className="size-4" /> Live SSE</ButtonLink>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricBox label="Platform Health" value={`${h.overallScore}%`} status={h.overallScore >= 90 ? "good" : h.overallScore >= 70 ? "watch" : "risk"} />
          <MetricBox label="Uptime" value={`${h.uptimePercent}%`} status={h.uptimePercent >= 99.9 ? "good" : h.uptimePercent >= 99 ? "watch" : "risk"} />
          <MetricBox label="SLA Compliance" value={`${h.slaCompliance}%`} status={h.slaCompliance >= 99 ? "good" : h.slaCompliance >= 95 ? "watch" : "risk"} />
          <MetricBox label="Critical Services" value={`${h.criticalServicesHealthy}/${h.criticalServices}`} status={h.criticalServicesDown > 0 ? "risk" : h.criticalServicesDegraded > 0 ? "watch" : "good"} />
          <MetricBox label="Error Budget" value={dashboard.sloDefinitions.length > 0 ? `${Math.round(dashboard.sloDefinitions.reduce((s, d) => s + d.errorBudgetRemaining, 0) / dashboard.sloDefinitions.length)}%` : "N/A"} status="good" />
        </div>
      </CardContent>
    </Card>
  );
}

function LiveDot({ connected }: { connected: boolean }) {
  return <div className="flex items-center gap-1.5"><span className={`relative flex size-2.5 ${connected ? "" : "animate-pulse"}`}><span className={`absolute inline-flex size-full rounded-full opacity-75 ${connected ? "bg-green-500" : "bg-red-500"} ${connected ? "" : "animate-ping"}`} /><span className={`relative inline-flex size-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} /></span><span className="text-xs font-semibold text-muted-foreground">{connected ? "Live" : "Reconnecting"}</span></div>;
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p></div>;
}

function TabBar({ tabs, active, onSelect }: { tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }>; active: string; onSelect: (id: TabId) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
            active === t.id ? "border-primary/30 bg-primary/10 text-primary shadow-sm" : "border-border bg-surface text-foreground/70 hover:border-primary/20 hover:text-foreground"
          }`}>
          {t.icon}{t.label}
          {t.count !== undefined && t.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === t.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ========== OVERVIEW ==========
function OverviewSection({ dashboard, live }: { dashboard: ObservabilityDashboard; live: ReturnType<typeof useObservabilityLive>["data"] }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Gauge className="size-5" />} subtitle="Real-time global operations with live metrics stream" title="Global Operations Command Center" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Platform Health" icon={<HeartPulse className="size-5" />} detail={`${dashboard.platformHealth.uptimePercent}% uptime`} value={`${dashboard.platformHealth.overallScore}%`} status={dashboard.platformHealth.overallScore >= 90 ? "good" : dashboard.platformHealth.overallScore >= 70 ? "watch" : "risk"} />
        <StatCard label="Active Incidents" icon={<AlertTriangle className="size-5" />} detail={live.activeIncidents.length > 0 ? `${live.activeIncidents.length} ongoing` : "All clear"} value={String(dashboard.platformHealth.activeIncidents)} status={dashboard.platformHealth.activeIncidents === 0 ? "good" : dashboard.platformHealth.activeIncidents < 3 ? "watch" : "risk"} />
        <StatCard label="Infrastructure" icon={<Cpu className="size-5" />} detail={`${dashboard.infraSummary.totalHosts} hosts · ${dashboard.infraSummary.criticalHosts} critical`} value={`${dashboard.infraSummary.avgCpu}% CPU`} status={dashboard.infraSummary.avgCpu > 80 ? "risk" : dashboard.infraSummary.avgCpu > 60 ? "watch" : "good"} />
        <StatCard label="Error Budget" icon={<Target className="size-5" />} detail={`${dashboard.sloDefinitions.length} SLOs tracked`} value={`${dashboard.errorBudgetSummary.filter((e) => e.riskStatus === "healthy").length}/${dashboard.errorBudgetSummary.length} healthy`} status={dashboard.errorBudgetSummary.some((e) => e.riskStatus === "critical" || e.riskStatus === "exhausted") ? "risk" : "good"} />
      </div>

      {/* Live Status Strip */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LiveMetricCard title="Service Health" icon={<Server className="size-4" />} live={live.serviceHealth.length > 0 ? `${live.serviceHealth.filter((s) => s.status === "healthy").length}/${live.serviceHealth.length} healthy` : `${dashboard.services.filter((s) => s.status === "healthy").length}/${dashboard.services.length} healthy`} status={dashboard.services.every((s) => s.status === "healthy") ? "good" : "watch"} />
        <LiveMetricCard title="Queue Status" icon={<Inbox className="size-4" />} live={live.queueStatus.length > 0 ? `${live.queueStatus.filter((q) => q.status === "active").length} active` : `${dashboard.queues.filter((q) => q.status === "active").length} active`} status={dashboard.queues.every((q) => q.status === "active") ? "good" : "watch"} />
        <LiveMetricCard title="Active Incidents" icon={<AlertTriangle className="size-4" />} live={String(live.activeIncidents.length || dashboard.platformHealth.activeIncidents)} status={dashboard.platformHealth.activeIncidents === 0 ? "good" : "risk"} />
        <LiveMetricCard title="Live Updates" icon={<Radio className="size-4" />} live={live.lastHeartbeat ? new Date(live.lastHeartbeat).toLocaleTimeString() : "Waiting..."} status="good" />
      </div>

      {/* Infra Snapshot from Live Feed */}
      {live.infraSnapshot.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-black">Live Infrastructure Snapshot <Badge variant="info" className="ml-2 animate-pulse text-xs">LIVE</Badge></h3></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {live.infraSnapshot.map((h, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-3 text-sm">
                <p className="font-semibold">{h.host_name}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <span className={`font-black ${h.cpu_usage_pct > 80 ? "text-red-600" : ""}`}>CPU {h.cpu_usage_pct}%</span>
                  <span className={`font-black ${h.memory_usage_pct > 80 ? "text-red-600" : ""}`}>MEM {h.memory_usage_pct}%</span>
                  <span className={`font-black ${h.disk_usage_pct > 80 ? "text-red-600" : ""}`}>DISK {h.disk_usage_pct}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Recent Incidents</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.incidents.slice(0, 5).map((inc) => (
              <div key={inc.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3"><p className="font-black truncate">{inc.title}</p><SevBadge severity={inc.severity} /></div>
                <p className="mt-2 text-sm text-muted-foreground">#{inc.number} · {inc.serviceName} · <IncStatusBadge status={inc.status} /></p>
              </div>
            ))}
            {dashboard.incidents.length === 0 && <EmptyState text="All clear - no recent incidents" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">SLO Error Budget Status</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.errorBudgetSummary.slice(0, 6).map((eb) => (
              <div key={eb.sloName} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-sm">{eb.sloName}</p>
                  <BudgetBadge risk={eb.riskStatus} />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-border">
                    <div className={`h-2 rounded-full ${eb.riskStatus === "healthy" ? "bg-green-500" : eb.riskStatus === "medium" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(eb.budgetPercent, 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold">{eb.budgetPercent}%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{eb.serviceName} · Burn rate: {eb.burnRate}/h</p>
              </div>
            ))}
            {dashboard.errorBudgetSummary.length === 0 && <EmptyState text="No SLOs configured" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LiveMetricCard({ title, icon, live, status }: { title: string; icon: React.ReactNode; live: string; status: "good" | "watch" | "risk" }) {
  const dotC = { good: "bg-green-500", watch: "bg-amber-500", risk: "bg-red-500" };
  return <div className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-4"><div className="flex items-center gap-3"><span className={`size-2 rounded-full ${dotC[status]} shadow-[0_0_6px] ${status === "good" ? "shadow-green-500/50" : status === "watch" ? "shadow-amber-500/50" : "shadow-red-500/50"}`} /><div className="flex items-center gap-2">{icon}<p className="font-semibold text-sm">{title}</p></div></div><p className="mt-2 text-xl font-black">{live}</p></div>;
}

// ========== SERVICES ==========
function ServicesSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const healthy = dashboard.services.filter((s) => s.status === "healthy").length;
  const degraded = dashboard.services.filter((s) => s.status === "degraded").length;
  const down = dashboard.services.filter((s) => s.status === "down").length;

  return (
    <div className="space-y-6">
      <SectionHeader icon={<Server className="size-5" />} subtitle={`${dashboard.services.length} services · ${healthy} healthy · ${degraded} degraded · ${down} down`} title="Distributed Service Monitoring" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.services.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-accent/20 p-1.5 text-foreground"><SvcIcon type={s.type} /></div>
                  <div><p className="font-black text-sm">{s.name}</p><p className="text-xs text-muted-foreground">v{s.version} · {s.ownerTeam}</p></div>
                </div>
                <SvcStatusBadge status={s.status} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{s.description || `${s.type} service`}</p>
              {s.dependencies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.dependencies.map((dep, i) => <Badge key={i} variant="info" className="text-[10px]">{dep}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Dependency Graph */}
      {dashboard.dependencyGraph.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-black">Service Dependency Map</h3></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dashboard.dependencyGraph.map((edge, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
                  <span className="font-semibold">{edge.source}</span>
                  <GitBranch className="size-3 text-muted-foreground" />
                  <span className="font-semibold">{edge.target}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========== INCIDENTS ==========
function IncidentsSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const sevs = useMemo(() => ({
    sev1: dashboard.incidents.filter((i) => i.severity === "sev1_critical"),
    sev2: dashboard.incidents.filter((i) => i.severity === "sev2_high"),
    sev3: dashboard.incidents.filter((i) => i.severity === "sev3_medium"),
    sev4: dashboard.incidents.filter((i) => i.severity === "sev4_low"),
  }), [dashboard.incidents]);
  return (
    <div className="space-y-6">
      <SectionHeader icon={<AlertTriangle className="size-5" />} subtitle="Full lifecycle with severity classification and root cause" title="Incident Management Center" />
      <div className="grid gap-4 md:grid-cols-4">
        <IncBox label="SEV-1 Critical" count={sevs.sev1.length} status="risk" />
        <IncBox label="SEV-2 High" count={sevs.sev2.length} status={sevs.sev2.length > 0 ? "watch" : "good"} />
        <IncBox label="SEV-3 Medium" count={sevs.sev3.length} status="good" />
        <IncBox label="SEV-4 Low" count={sevs.sev4.length} status="good" />
      </div>
      <Card>
        <CardHeader><h3 className="text-lg font-black">Incident Timeline</h3></CardHeader>
        <CardContent className="space-y-3">
          {dashboard.incidents.slice(0, 20).map((inc) => (
            <div key={inc.id} className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-accent/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{inc.number}</span>
                    <p className="font-black truncate">{inc.title}</p>
                    <SevBadge severity={inc.severity} />
                    <IncStatusBadge status={inc.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{inc.serviceName} · Detected: {new Date(inc.detectedAt).toLocaleString("en-IN")}</p>
                  {inc.rootCause && <p className="mt-1 text-sm font-semibold">Root cause: {inc.rootCause}</p>}
                </div>
              </div>
            </div>
          ))}
          {dashboard.incidents.length === 0 && <EmptyState text="No incidents recorded" />}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== TRACING ==========
function TracingSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Route className="size-5" />} subtitle="Distributed tracing across all services" title="Distributed Tracing & OpenTelemetry" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.tracesByService.map((t) => (
          <Card key={t.service}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{t.service}</p>
                <Badge variant="info">{t.count} traces</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Avg Duration</p><p className="font-black">{t.avgDuration}ms</p></div>
                <div><p className="text-xs text-muted-foreground">P95</p><p className="font-black">{t.p95}ms</p></div>
                <div><p className="text-xs text-muted-foreground">Errors</p><p className="font-black text-red-600">{t.errorCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Success Rate</p><p className="font-black">{t.count > 0 ? Math.round((t.count - t.errorCount) / t.count * 100) : 100}%</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
        {dashboard.tracesByService.length === 0 && <div className="xl:col-span-3"><EmptyState text="Send traces via OpenTelemetry SDK to see distributed tracing data" /></div>}
      </div>
      {/* Recent traces */}
      {dashboard.traces.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-black">Recent Spans</h3></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-3 pr-4">Span</th><th className="pb-3 pr-4">Service</th>
                  <th className="pb-3 pr-4">Duration</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.traces.slice(0, 20).map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="py-3 pr-4 font-semibold max-w-[200px] truncate">{t.spanName}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{t.serviceName}</td>
                    <td className="py-3 pr-4 font-black tabular-nums">{t.durationMs}ms</td>
                    <td className="py-3 pr-4"><Badge className={t.statusCode === "error" ? "bg-red-50 text-red-700" : t.statusCode === "ok" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}>{t.statusCode}</Badge></td>
                    <td className="py-3 text-muted-foreground">{new Date(t.startTime).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========== INFRASTRUCTURE ==========
function InfraSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Cpu className="size-5" />} subtitle={`${dashboard.infraSummary.totalHosts} hosts · ${dashboard.infraSummary.criticalHosts} critical · Avg CPU ${dashboard.infraSummary.avgCpu}% · Avg MEM ${dashboard.infraSummary.avgMem}%`} title="Infrastructure Monitoring" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Hosts" icon={<Server className="size-5" />} detail={`${dashboard.infraSummary.hostsByRole.length} roles`} value={String(dashboard.infraSummary.totalHosts)} status="good" />
        <StatCard label="Avg CPU" icon={<Cpu className="size-5" />} detail={`${dashboard.infraSummary.avgCpu}% average`} value={`${dashboard.infraSummary.avgCpu}%`} status={dashboard.infraSummary.avgCpu > 80 ? "risk" : dashboard.infraSummary.avgCpu > 60 ? "watch" : "good"} />
        <StatCard label="Avg Memory" icon={<Database className="size-5" />} detail={`${dashboard.infraSummary.avgMem}% used`} value={`${dashboard.infraSummary.avgMem}%`} status={dashboard.infraSummary.avgMem > 80 ? "risk" : dashboard.infraSummary.avgMem > 60 ? "watch" : "good"} />
        <StatCard label="Avg Disk" icon={<Server className="size-5" />} detail={`${dashboard.infraSummary.avgDisk}% used`} value={`${dashboard.infraSummary.avgDisk}%`} status={dashboard.infraSummary.avgDisk > 80 ? "risk" : dashboard.infraSummary.avgDisk > 60 ? "watch" : "good"} />
      </div>
      {/* Host grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.infraMetrics.slice(0, 12).map((h) => (
          <Card key={h.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-sm">{h.hostName}</p>
                <Badge variant="info">{h.hostRole}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{h.region}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <GaugeMini label="CPU" value={h.cpuPct} />
                <GaugeMini label="MEM" value={h.memPct} />
                <GaugeMini label="DISK" value={h.diskPct} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Container metrics */}
      {dashboard.containerMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black">Container / Kubernetes</h3>
              <div className="flex gap-2">
                <Badge variant="info">{dashboard.containerSummary.totalPods} pods</Badge>
                <Badge className={dashboard.containerSummary.failed > 0 || dashboard.containerSummary.crashLoop > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}>
                  {dashboard.containerSummary.running} running · {dashboard.containerSummary.crashLoop} crash
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.containerMetrics.slice(0, 12).map((c) => (
              <div key={c.id} className={`rounded-lg border p-3 text-sm ${c.status === "crash_loop_backoff" ? "border-red-200 bg-red-50" : c.status === "failed" ? "border-amber-200 bg-amber-50" : "border-border bg-background"}`}>
                <p className="font-semibold truncate">{c.podName}</p>
                <p className="text-xs text-muted-foreground">{c.namespace} · {c.nodeName}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <Badge className={c.status === "running" ? "border-green-200 bg-green-50 text-green-700" : c.status === "crash_loop_backoff" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{c.status}</Badge>
                  <span className="text-muted-foreground">{c.restartCount} restarts</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GaugeMini({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v > 80 ? "text-red-600" : v > 60 ? "text-amber-600" : "text-green-600";
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={`font-black text-sm ${color}`}>{v}%</p></div>;
}

// ========== SLO / ERROR BUDGET ==========
function SloSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Target className="size-5" />} subtitle="SLO compliance, error budget burn rate, and risk forecasting" title="SLA / SLO & Error Budget Management" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SLOs Defined" icon={<Target className="size-5" />} detail={`${dashboard.sloDefinitions.filter((s) => s.isActive).length} active`} value={String(dashboard.sloDefinitions.length)} status="good" />
        <StatCard label="On Target" icon={<ShieldCheck className="size-5" />} detail={dashboard.sloDefinitions.length > 0 ? `${Math.round(dashboard.sloDefinitions.filter((s) => dashboard.errorBudgetSummary.find((eb) => eb.sloName === s.name)?.riskStatus === "healthy").length / dashboard.sloDefinitions.length * 100)}% compliance` : "No SLOs"} value={String(dashboard.errorBudgetSummary.filter((e) => e.riskStatus === "healthy").length)} status="good" />
        <StatCard label="At Risk" icon={<AlertTriangle className="size-5" />} detail="Budget below 50%" value={String(dashboard.errorBudgetSummary.filter((e) => e.riskStatus === "critical" || e.riskStatus === "high" || e.riskStatus === "exhausted").length)} status={dashboard.errorBudgetSummary.some((e) => e.riskStatus === "critical" || e.riskStatus === "exhausted") ? "risk" : "watch"} />
        <StatCard label="Exhausted" icon={<AlertTriangle className="size-5" />} detail="Zero budget remaining" value={String(dashboard.errorBudgetSummary.filter((e) => e.riskStatus === "exhausted").length)} status={dashboard.errorBudgetSummary.some((e) => e.riskStatus === "exhausted") ? "risk" : "good"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">SLO Compliance</h3></CardHeader>
          <CardContent className="space-y-4">
            {dashboard.sloDefinitions.map((slo) => {
              const eb = dashboard.errorBudgetSummary.find((e) => e.sloName === slo.name);
              return (
                <div key={slo.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="font-black">{slo.name}</p><p className="text-xs text-muted-foreground">{slo.serviceName} · {formatAnalyticsLabel(slo.metricSource)} · target {slo.targetValue}%</p></div>
                    {eb && <BudgetBadge risk={eb.riskStatus} />}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Budget Remaining</p></div>
                    <div><p className={`font-black ${(eb?.budgetPercent ?? 100) < 20 ? "text-red-600" : (eb?.budgetPercent ?? 100) < 50 ? "text-amber-600" : "text-green-600"}`}>{eb?.budgetPercent ?? 100}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Burn Rate</p><p className="font-black">{eb?.burnRate ?? 0}/h</p></div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-border">
                    <div className={`h-2 rounded-full ${(eb?.budgetPercent ?? 100) < 20 ? "bg-red-500" : (eb?.budgetPercent ?? 100) < 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(eb?.budgetPercent ?? 100, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {dashboard.sloDefinitions.length === 0 && <EmptyState text="No SLOs defined" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Compliance History</h3></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.sloCompliance.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                <div><p className="font-semibold">{c.windowStart} → {c.windowEnd}</p><p className="text-xs text-muted-foreground">{c.goodEvents}/{c.totalEvents} good events</p></div>
                <Badge className={c.compliancePct >= 99 ? "border-green-200 bg-green-50 text-green-700" : c.compliancePct >= 95 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}>{c.compliancePct}%</Badge>
              </div>
            ))}
            {dashboard.sloCompliance.length === 0 && <EmptyState text="No compliance history yet" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BudgetBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    healthy: "border-green-200 bg-green-50 text-green-700",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    critical: "border-red-200 bg-red-50 text-red-700",
    exhausted: "border-red-300 bg-red-100 text-red-900"
  };
  return <Badge className={colors[risk] ?? ""}>{formatAnalyticsLabel(risk)}</Badge>;
}

// ========== DEPLOYMENTS ==========
function DeploymentsSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<GitBranch className="size-5" />} subtitle="Deployment tracking for incident timeline change overlays" title="Deployment History" />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              <th className="p-4 pr-3">Service</th><th className="p-4 pr-3">Version</th><th className="p-4 pr-3">Status</th>
              <th className="p-4 pr-3">Duration</th><th className="p-4 pr-3">Commit</th><th className="p-4">Time</th>
            </tr></thead>
            <tbody>
              {dashboard.deployments.map((d) => (
                <tr key={d.id} className="border-b border-border">
                  <td className="p-4 pr-3 font-semibold">{d.serviceName}</td>
                  <td className="p-4 pr-3">{d.version}</td>
                  <td className="p-4 pr-3"><Badge className={d.status === "completed" ? "border-green-200 bg-green-50 text-green-700" : d.status === "failed" ? "border-red-200 bg-red-50 text-red-700" : d.status === "rolled_back" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-700"}>{d.status}</Badge></td>
                  <td className="p-4 pr-3">{d.durationMs ? `${d.durationMs}ms` : "—"}</td>
                  <td className="p-4 pr-3 max-w-[150px] truncate text-muted-foreground">{d.commitMessage ?? "—"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(d.startedAt).toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {dashboard.deployments.length === 0 && <tr><td colSpan={6} className="p-4"><EmptyState text="No deployments tracked yet" /></td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== REGIONS ==========
function RegionsSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Globe2 className="size-5" />} subtitle="Multi-region health monitoring" title="Multi-Region Monitoring" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.regions.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{r.name}</p>
                <RegHealthBadge status={r.healthStatus} />
              </div>
              <p className="text-xs text-muted-foreground">{r.code} · {r.provider}</p>
              <Badge className={r.isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>{r.isActive ? "Active" : "Inactive"}</Badge>
            </CardContent>
          </Card>
        ))}
        {dashboard.regions.length === 0 && <EmptyState text="No regions configured" />}
      </div>
    </div>
  );
}

function RegHealthBadge({ status }: { status: string }) {
  const c: Record<string, string> = { healthy: "border-green-200 bg-green-50 text-green-700", degraded: "border-amber-200 bg-amber-50 text-amber-800", down: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== DR ==========
function DrSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<ShieldCheck className="size-5" />} subtitle="Disaster recovery status, RTO/RPO, and failover readiness" title="Disaster Recovery Status" />
      <div className="grid gap-5 xl:grid-cols-2">
        {dashboard.drStatus.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{d.planName}</p>
                <DrStatusBadge status={d.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">RTO</p><p className="text-xl font-black">{d.estimatedRto ?? "—"} min</p></div>
                <div><p className="text-xs text-muted-foreground">RPO</p><p className="text-xl font-black">{d.estimatedRpo ?? "—"} min</p></div>
                <div><p className="text-xs text-muted-foreground">Auto-failover</p><p className="font-black">{d.hasAutoFailover ? "Yes" : "No"}</p></div>
                <div><p className="text-xs text-muted-foreground">Secondary</p><p className="font-black">{d.secondaryRegion ?? "None"}</p></div>
              </div>
              {d.lastTestedAt && <p className="mt-3 text-xs text-muted-foreground">Last tested: {new Date(d.lastTestedAt).toLocaleDateString("en-IN")}</p>}
            </CardContent>
          </Card>
        ))}
        {dashboard.drStatus.length === 0 && <EmptyState text="No DR plan configured" />}
      </div>
    </div>
  );
}

function DrStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { ready: "border-green-200 bg-green-50 text-green-700", in_progress: "border-blue-200 bg-blue-50 text-blue-700", tested: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700", not_configured: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== STATUS PAGE ==========
function StatusPageSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Radio className="size-5" />} subtitle="Component status tracking for public/private status pages" title="Status Page Management" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Status Components</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.statusComponents.map((sc) => (
              <div key={sc.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{sc.name}</p>
                  <StatusCompBadge status={sc.status} />
                </div>
              </div>
            ))}
            {dashboard.statusComponents.length === 0 && <EmptyState text="No status components configured" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Subscribers</h3></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.statusPageSubscribers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${s.isVerified ? "bg-green-500" : "bg-amber-500"}`} />
                  <p className="font-semibold">{s.email}</p>
                </div>
                <Badge className={s.isVerified ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{s.isVerified ? "Verified" : "Pending"}</Badge>
              </div>
            ))}
            {dashboard.statusPageSubscribers.length === 0 && <EmptyState text="No subscribers yet" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusCompBadge({ status }: { status: string }) {
  const c: Record<string, string> = { operational: "border-green-200 bg-green-50 text-green-700", degraded: "border-amber-200 bg-amber-50 text-amber-800", partial_outage: "border-orange-200 bg-orange-50 text-orange-700", major_outage: "border-red-200 bg-red-50 text-red-700", maintenance: "border-blue-200 bg-blue-50 text-blue-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== REMAINING SECTIONS (reuse from previous) ==========
function QueuesSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.queues;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Inbox className="size-5" />} subtitle="Depth, rate, retries, failures" title="Background Job & Queue Monitoring" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length > 0 ? items.map((q) => (
          <Card key={q.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <QueueDot status={q.status} />
                <p className="font-black">{q.name}</p>
                <Badge variant="info">{q.type}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Depth</p><p className="text-xl font-black">{q.depth}</p></div>
                <div><p className="text-xs text-muted-foreground">Rate</p><p className="text-xl font-black">{q.processingRate}/s</p></div>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <span>S:{q.successCount}</span><span className="text-red-600">F:{q.failureCount}</span>
                <span>R:{q.retryCount}</span><span>Lat:{q.avgLatency}ms</span>
              </div>
            </CardContent>
          </Card>
        )) : <div className="xl:col-span-3"><EmptyState text="No queues configured" /></div>}
      </div>
    </div>
  );
}
function QueueDot({ status }: { status: string }) {
  return <span className={`size-2.5 rounded-full ${status === "active" ? "bg-green-500" : status === "degraded" ? "bg-amber-500" : status === "backed_up" ? "bg-red-500" : "bg-gray-400"}`} />;
}

function CronSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.cronJobs;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<RefreshCcw className="size-5" />} subtitle="Last/next run, success rate, duration" title="Cron & Scheduler Intelligence" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length > 0 ? items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black truncate">{c.name}</p>
                {c.isOverdue ? <Badge className="border-red-200 bg-red-50 text-red-700">Overdue</Badge> : <CronBadge status={c.status} />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.schedule}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Last</p><p className="font-semibold">{c.lastRun ? new Date(c.lastRun).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Next</p><p className="font-semibold">{c.nextRun ? new Date(c.nextRun).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">S/F</p><p className="font-black">{c.successCount}/{c.failureCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Avg</p><p className="font-black">{c.avgDuration ? c.avgDuration + "ms" : "—"}</p></div>
              </div>
            </CardContent>
          </Card>
        )) : <div className="xl:col-span-3"><EmptyState text="No cron jobs" /></div>}
      </div>
    </div>
  );
}
function CronBadge({ status }: { status: string }) {
  const c: Record<string, string> = { active: "border-green-200 bg-green-50 text-green-700", paused: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

function ErrorsSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.errors;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Activity className="size-5" />} subtitle="Frequency, severity, service impact" title="Enterprise Error Tracking" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickBox label="Total" value={String(items.length)} />
        <QuickBox label="Critical" value={String(items.filter((e) => e.severity === "critical").length)} />
        <QuickBox label="Unresolved" value={String(items.filter((e) => !e.isResolved).length)} />
        <QuickBox label="Resolved" value={String(items.filter((e) => e.isResolved).length)} />
      </div>
      <Card>
        <CardHeader><h3 className="text-lg font-black">Error Feed</h3></CardHeader>
        <CardContent className="space-y-2">
          {items.slice(0, 25).map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ErrBadge severity={e.severity} />
                  <p className="font-semibold truncate">{e.message.slice(0, 120)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{e.type} &middot; {e.service} &middot; {e.frequency}x</p>
              </div>
              <Badge className={e.isResolved ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                {e.isResolved ? "Resolved" : "Open"}
              </Badge>
            </div>
          ))}
          {items.length === 0 && <EmptyState text="No errors" />}
        </CardContent>
      </Card>
    </div>
  );
}
function ErrBadge({ severity }: { severity: string }) {
  const c: Record<string, string> = { critical: "border-red-200 bg-red-50 text-red-700", high: "border-orange-200 bg-orange-50 text-orange-700", medium: "border-amber-200 bg-amber-50 text-amber-800" };
  return <Badge className={c[severity] ?? ""}>{formatAnalyticsLabel(severity)}</Badge>;
}
function QuickBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function OncallSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.oncallSchedules;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Bell className="size-5" />} subtitle="Rotation schedules, escalation chains" title="On-Call Management" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length > 0 ? items.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{o.name}</p>
                <Badge className={o.isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>
                  {o.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{o.team} &middot; Level {o.level}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-md border border-border bg-background p-2">
                  <span className="text-muted-foreground">Primary</span>
                  <span className="font-semibold">{o.primaryUser?.slice(0, 12) ?? "Unassigned"}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background p-2">
                  <span className="text-muted-foreground">Backup</span>
                  <span className="font-semibold">{o.backupUser?.slice(0, 12) ?? "Unassigned"}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Rotation: {formatAnalyticsLabel(o.rotationType)}</p>
            </CardContent>
          </Card>
        )) : <div className="xl:col-span-3"><EmptyState text="No on-call schedules" /></div>}
      </div>
    </div>
  );
}
function CapacitySection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.capacityMetrics;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<TrendingUp className="size-5" />} subtitle="Growth trends, 30/90-day forecasts" title="Capacity Planning" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length > 0 ? items.map((cm) => (
          <Card key={cm.id}>
            <CardContent className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{formatAnalyticsLabel(cm.type)}</p>
              <p className="mt-2 text-2xl font-black">{cm.currentValue.toLocaleString()}</p>
              {cm.limit && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span>{cm.usagePercent !== null ? cm.usagePercent + "%" : ""}</span>
                    <span>Limit: {cm.limit.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-border">
                    <div className={"h-2 rounded-full " + ((cm.usagePercent ?? 0) > 80 ? "bg-red-500" : (cm.usagePercent ?? 0) > 60 ? "bg-amber-500" : "bg-green-500")}
                      style={{ width: Math.min(cm.usagePercent ?? 0, 100) + "%" }} />
                  </div>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                {cm.forecast30d !== null && <div><span className="text-muted-foreground">30d</span><p className="font-semibold">{cm.forecast30d.toLocaleString()}</p></div>}
                {cm.forecast90d !== null && <div><span className="text-muted-foreground">90d</span><p className="font-semibold">{cm.forecast90d.toLocaleString()}</p></div>}
              </div>
            </CardContent>
          </Card>
        )) : <div className="xl:col-span-3"><EmptyState text="No capacity metrics" /></div>}
      </div>
    </div>
  );
}
function TenantsSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.tenantHealth;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<UsersRound className="size-5" />} subtitle="Per-tenant availability and health" title="Tenant Monitoring" />
      <Card>
        <CardHeader><h3 className="text-lg font-black">Tenant Health</h3></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="pb-3 pr-4">Tenant</th><th className="pb-3 pr-4">Health</th>
                <th className="pb-3 pr-4">Availability</th><th className="pb-3 pr-4">Errors</th><th className="pb-3">Checked</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((t) => (
                <tr key={t.id} className="border-b border-border">
                  <td className="py-3 pr-4 font-semibold">{t.orgId.slice(0, 12)}</td>
                  <td className="py-3 pr-4"><ThBadge score={t.healthScore} /></td>
                  <td className="py-3 pr-4">{t.availabilityScore}%</td>
                  <td className="py-3 pr-4">{t.errorCount}</td>
                  <td className="py-3 text-muted-foreground">{new Date(t.lastCheck).toLocaleDateString()}</td>
                </tr>
              )) : <tr><td colSpan={5} className="py-4"><EmptyState text="No tenant health data" /></td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
function EscalationSection({ dashboard }: { dashboard: ObservabilityDashboard }) {
  const items = dashboard.escalationPolicies;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<LifeBuoy className="size-5" />} subtitle="Multi-level escalation chains" title="Escalation Policies" />
      <div className="grid gap-5 xl:grid-cols-2">
        {items.length > 0 ? items.map((ep) => (
          <Card key={ep.id}>
            <CardHeader>
              <h3 className="text-lg font-black">{ep.name}</h3>
              {ep.description && <p className="text-sm text-muted-foreground">{ep.description}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              {ep.levels.map((l) => (
                <div key={l.level} className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">L{l.level}</div>
                    <div><p className="font-semibold">{l.name}</p><p className="text-xs text-muted-foreground">Timeout: {l.timeout}min</p></div>
                  </div>
                  <Badge variant="info">Level {l.level}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )) : <EmptyState text="No escalation policies" />}
      </div>
    </div>
  );
}

// ========== SHARED ==========
function SectionHeader({ icon, subtitle, title }: { icon: React.ReactNode; subtitle: string; title: string }) {
  return <div className="flex items-center gap-3"><div className="rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div><div><h2 className="text-2xl font-black">{title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>;
}
function EmptyState({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm font-semibold text-muted-foreground">{text}</div>; }
function ThBadge({ score }: { score: number }) {
  const c = score >= 90 ? "border-green-200 bg-green-50 text-green-700" : score >= 70 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700";
  return <Badge className={c}>{score}%</Badge>;
}
function SevBadge({ severity }: { severity: string }) {
  const c: Record<string, string> = { sev1_critical: "border-red-200 bg-red-50 text-red-700", sev2_high: "border-orange-200 bg-orange-50 text-orange-700", sev3_medium: "border-amber-200 bg-amber-50 text-amber-800", sev4_low: "border-blue-200 bg-blue-50 text-blue-700" };
  return <Badge className={c[severity] ?? ""}>{formatAnalyticsLabel(severity)}</Badge>;
}
function IncStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { new: "border-gray-200 bg-gray-50 text-gray-700", investigating: "border-blue-200 bg-blue-50 text-blue-700", identified: "border-amber-200 bg-amber-50 text-amber-800", mitigated: "border-cyan-200 bg-cyan-50 text-cyan-700", resolved: "border-green-200 bg-green-50 text-green-700", closed: "border-green-300 bg-green-100 text-green-800" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}
function SvcIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = { api: <Server className="size-4" />, web: <Globe2 className="size-4" />, worker: <Loader2 className="size-4" />, database: <Database className="size-4" />, cache: <Zap className="size-4" />, queue: <Inbox className="size-4" />, storage: <Database className="size-4" />, ai: <BrainIcon className="size-4" />, auth: <ShieldCheck className="size-4" />, payment: <CreditCardIcon className="size-4" />, email: <MailIcon className="size-4" />, sms: <MessageIcon className="size-4" />, notification: <Bell className="size-4" /> };
  return <>{icons[type] ?? <Server className="size-4" />}</>;
}
function SvcStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { healthy: "border-green-200 bg-green-50 text-green-700", degraded: "border-amber-200 bg-amber-50 text-amber-800", down: "border-red-200 bg-red-50 text-red-700", maintenance: "border-blue-200 bg-blue-50 text-blue-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}
function IncBox({ label, count, status }: { label: string; count: number; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-4xl font-black ${c[status].split(" ")[0]}`}>{count}</p></div>;
}
function BrainIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12h-4V9.5C7.8 8.8 7 7.5 7 6a4 4 0 0 1 4-4zM12 22c-1.5 0-3-1.5-3-3.5V14h6v4.5c0 2-1.5 3.5-3 3.5z"/></svg>; }
function CreditCardIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>; }
function MailIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function MessageIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
