"use client";

import {
  Activity,
  AlertTriangle,
  RefreshCcw,
  Shield,
  ShieldCheck,
  Users,
  CreditCard,
  CalendarClock,
  Bug,
  Building2,
  UserCheck,
  Dumbbell,
  Store,
  Clock,
  LogIn,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Bell,
  Settings2,
  History,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { AuthContext } from "@/types/auth";
import type { MonitoringDashboard, HealthCheck, DataIntegrityIssue } from "@/features/monitoring/services/monitoring-service";
import type { ExternalHealthCheckResult } from "@/features/monitoring/services/external-health-checks";
import { saveAlertConfigAction, testSlackWebhookAction, testPagerDutyAction, acknowledgeAlertAction, getAlertConfigAction, getAlertHistoryAction } from "@/features/monitoring/actions/alert-actions";
import type { AlertHistoryEntry } from "@/features/monitoring/services/alert-service";

type Props = { context: AuthContext; dashboard: MonitoringDashboard };

type TabId = "overview" | "external-health" | "notifications";

const severityColors = {
  healthy: "border-green-200 bg-green-50 text-green-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-800",
  down: "border-red-200 bg-red-50 text-red-700",
  unknown: "border-gray-200 bg-gray-50 text-gray-700",
} as const;

const statusIcon = {
  healthy: CheckCircle2,
  degraded: AlertCircle,
  down: XCircle,
  unknown: AlertCircle,
} as const;

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function MonitoringDashboardClient({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const [data, setData] = useState<MonitoringDashboard>(dashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [previousHealth, setPreviousHealth] = useState<Map<string, string>>(new Map());
  const [flashingCards, setFlashingCards] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/super-admin/monitoring/refresh");
      if (!res.ok) throw new Error("Failed to refresh");
      const fresh: MonitoringDashboard = await res.json();

      // Detect status changes for flash animation
      const newFlash = new Set<string>();
      for (const check of fresh.platformHealth) {
        const prev = previousHealth.get(check.component);
        if (prev && prev !== check.status && check.status === "down") {
          newFlash.add(check.component);
        }
        previousHealth.set(check.component, check.status);
      }
      for (const check of fresh.externalHealth) {
        const prev = previousHealth.get(`ext-${check.service}`);
        if (prev && prev !== check.status && check.status === "down") {
          newFlash.add(`ext-${check.service}`);
        }
        previousHealth.set(`ext-${check.service}`, check.status);
      }
      setPreviousHealth(new Map(previousHealth));
      if (newFlash.size > 0) {
        setFlashingCards(newFlash);
        setTimeout(() => setFlashingCards(new Set()), 2000);
      }

      setData(fresh);
      showToast("Monitoring data refreshed successfully", "success");
    } catch {
      showToast("Unable to refresh monitoring data. Please try again.", "error");
    } finally {
      setRefreshing(false);
    }
  }, [previousHealth]);

  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(handleRefresh, refreshInterval * 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [refreshInterval, handleRefresh]);

  const h = data.platformHealth;
  const eh = data.externalHealth;
  const healthyCount = h.filter((c) => c.status === "healthy").length;
  const totalCount = h.length;
  const platformScore = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

  const criticalIntegrity = data.dataIntegrity
    .filter((i) => i.severity === "critical")
    .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));
  const highIntegrity = data.dataIntegrity
    .filter((i) => i.severity === "high")
    .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));
  const otherIntegrity = data.dataIntegrity
    .filter((i) => i.severity !== "critical" && i.severity !== "high")
    .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

  const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "external-health", label: "External Health", icon: ExternalLink },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="info">Platform Monitoring Center</Badge>
                <StatusBadge status={platformScore >= 80 ? "healthy" : platformScore >= 50 ? "degraded" : "down"} />
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
                Platform <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Monitoring</span>
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                {data.usage.totalOrganizations} organizations · {data.usage.totalBranches} branches · {data.usage.totalUsers} users ·
                {data.usage.totalSubscriptions} subscriptions · {h.length} health checks · {data.dataIntegrity.length} integrity checks
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              >
                <option value={0}>Auto-refresh: Off</option>
                <option value={30}>Every 30s</option>
                <option value={60}>Every 60s</option>
                <option value={120}>Every 120s</option>
              </select>
              <Button onClick={handleRefresh} disabled={refreshing} variant="secondary" className="gap-2">
                {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Last updated {getRelativeTime(data.fetchedAt)}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricBox label="Platform Health" value={`${platformScore}%`} status={platformScore >= 80 ? "good" : platformScore >= 50 ? "watch" : "risk"} />
            <MetricBox label="Services Monitored" value={String(totalCount)} status="good" />
            <MetricBox label="Healthy Services" value={`${healthyCount}/${totalCount}`} status={healthyCount === totalCount ? "good" : healthyCount > 0 ? "watch" : "risk"} />
            <MetricBox label="External Services" value={`${eh.filter((e) => e.status === "up").length}/${eh.length}`} status={eh.every((e) => e.status === "up") ? "good" : eh.some((e) => e.status === "down") ? "risk" : "watch"} />
          </div>
          {data.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <strong>Warning:</strong> Some data may be incomplete. {data.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Platform Health */}
          <section>
            <SectionHeading
              eyebrow="System Status"
              title="Platform Health Overview"
              body={`Real-time health status of ${h.length} platform components.`}
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {h.length > 0 ? h.map((check) => (
                <HealthCard
                  key={check.component}
                  check={check}
                  isFlashing={flashingCards.has(check.component)}
                  isExpanded={expandedCards.has(check.component)}
                  onToggle={() => {
                    const next = new Set(expandedCards);
                    if (next.has(check.component)) next.delete(check.component); else next.add(check.component);
                    setExpandedCards(next);
                  }}
                />
              )) : (
                <div className="col-span-full">
                  <EmptyState
                    title="No Health Data"
                    description="Health checks have not been configured yet. System health checks will appear here once monitoring is set up."
                  />
                </div>
              )}
            </div>
          </section>

          {/* Usage Overview */}
          <section>
            <SectionHeading
              eyebrow="Usage Analytics"
              title="Platform Usage Overview"
              body="Real counts from production database tables showing platform adoption and growth."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard label="Total Organizations" value={String(data.usage.totalOrganizations)} detail={`${data.usage.activeOrganizations} active · ${data.usage.trialOrganizations} trial · ${data.usage.suspendedOrganizations} suspended`} icon={<Building2 className="size-5" />} status={data.usage.activeOrganizations > 0 ? "good" : "watch"} />
              <StatCard label="Total Branches" value={String(data.usage.totalBranches)} detail={`${data.usage.activeBranches} active`} icon={<Store className="size-5" />} status={data.usage.totalBranches > 0 ? "good" : "watch"} />
              <StatCard label="Total Users" value={String(data.usage.totalUsers)} detail="Across all organizations" icon={<Users className="size-5" />} status="good" />
              <StatCard label="Total Members" value={String(data.usage.totalMembers)} detail="Active members across all branches" icon={<UserCheck className="size-5" />} status={data.usage.totalMembers > 0 ? "good" : "watch"} />
              <StatCard label="Total Trainers" value={String(data.usage.totalTrainers)} detail="Trainers across all branches" icon={<Dumbbell className="size-5" />} status={data.usage.totalTrainers > 0 ? "good" : "watch"} />
              <StatCard label="Total Subscriptions" value={String(data.usage.totalSubscriptions)} detail={`${data.usage.activeSubscriptions} active`} icon={<CreditCard className="size-5" />} status={data.usage.activeSubscriptions > 0 ? "good" : "watch"} />
            </div>
          </section>

          {/* Subscription Monitoring */}
          <section>
            <SectionHeading
              eyebrow="Revenue & Plans"
              title="Subscription Monitoring"
              body="Real-time subscription status across all organizations."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Active" value={String(data.subscriptions.activeSubscriptions)} detail="Active paid subscriptions" icon={<CheckCircle2 className="size-5" />} status={data.subscriptions.activeSubscriptions > 0 ? "good" : "watch"} />
              <StatCard label="Trial" value={String(data.subscriptions.trialSubscriptions)} detail="Organizations on trial" icon={<Clock className="size-5" />} status="watch" />
              <StatCard label="Expired" value={String(data.subscriptions.expiredSubscriptions)} detail="Expired subscriptions" icon={<CalendarClock className="size-5" />} status={data.subscriptions.expiredSubscriptions > 0 ? "risk" : "good"} />
              <StatCard label="Suspended" value={String(data.subscriptions.suspendedSubscriptions)} detail="Suspended accounts" icon={<AlertTriangle className="size-5" />} status={data.subscriptions.suspendedSubscriptions > 0 ? "risk" : "good"} />
              <StatCard label="Renewal Due Soon" value={String(data.subscriptions.renewalDueSoon)} detail="Expiring within 7 days" icon={<CalendarClock className="size-5" />} status={data.subscriptions.renewalDueSoon > 0 ? "watch" : "good"} />
              <StatCard label="Orgs Without Subscription" value={String(data.subscriptions.orgsWithoutSubscription)} detail="No plan assigned" icon={<AlertTriangle className="size-5" />} status={data.subscriptions.orgsWithoutSubscription > 0 ? "risk" : "good"} />
            </div>
          </section>

          {/* System Activity */}
          <section>
            <SectionHeading
              eyebrow="Live Feed"
              title="System Activity"
              body="Recent platform activity including logins, security events, and audit entries."
            />
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black">Recent Activity Events</h3>
                    <Badge variant="info">{data.activity.recentActivityEvents.length} events</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.activity.recentActivityEvents.length > 0 ? data.activity.recentActivityEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                      <SeverityDot severity={event.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{event.eventType.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{event.entityType} · {new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )) : (
                    <EmptyState compact title="No activity events" description="No recent activity events recorded in the system." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black">24h Activity Summary</h3>
                    <div className="flex gap-2">
                      <Badge variant="info">{data.activity.recentLogins} logins</Badge>
                      <Badge variant="warning">{data.security.openSecurityEvents} open</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ActivityRow icon={<LogIn className="size-4" />} label="Total Logins (24h)" value={String(data.activity.recentLogins)} />
                  <ActivityRow icon={<Shield className="size-4" />} label="Failed Logins (24h)" value={String(data.security.failedLogins24h)} status={data.security.failedLogins24h > 0 ? "risk" : "good"} />
                  <ActivityRow icon={<AlertTriangle className="size-4" />} label="Open Security Events" value={String(data.security.openSecurityEvents)} status={data.security.openSecurityEvents > 0 ? "risk" : "good"} />
                  <ActivityRow icon={<Bug className="size-4" />} label="Unresolved Errors" value={String(data.errors.unresolvedErrors)} status={data.errors.unresolvedErrors > 0 ? "risk" : "good"} />
                  <ActivityRow icon={<Activity className="size-4" />} label="Security Events (24h)" value={String(data.activity.recentSecurityEvents)} status={data.activity.recentSecurityEvents > 0 ? "watch" : "good"} />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Security Monitoring */}
          <section>
            <SectionHeading
              eyebrow="Security"
              title="Security Monitoring"
              body="Track failed logins, open security events, and suspicious activity."
            />
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader><h3 className="text-lg font-black">Security Events</h3></CardHeader>
                <CardContent className="space-y-3">
                  {data.security.recentEvents.length > 0 ? data.security.recentEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                      <SeverityDot severity={event.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{event.eventType.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{event.description.slice(0, 120)} · {new Date(event.createdAt).toLocaleString()}</p>
                        <div className="mt-1 flex gap-2">
                          <EventStatusBadge status={event.status} />
                        </div>
                      </div>
                    </div>
                  )) : (
                    <EmptyState compact title="No security events" description="No security events have been recorded. This is good." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><h3 className="text-lg font-black">Security Summary</h3></CardHeader>
                <CardContent className="space-y-3">
                  <ActivityRow icon={<Shield className="size-4" />} label="Failed Logins (24h)" value={String(data.security.failedLogins24h)} status={data.security.failedLogins24h > 5 ? "risk" : data.security.failedLogins24h > 0 ? "watch" : "good"} />
                  <ActivityRow icon={<ShieldCheck className="size-4" />} label="Total Logins (24h)" value={String(data.security.totalLogins24h)} status="good" />
                  <ActivityRow icon={<AlertTriangle className="size-4" />} label="Open Security Events" value={String(data.security.openSecurityEvents)} status={data.security.openSecurityEvents > 0 ? "risk" : "good"} />
                  <ActivityRow icon={<AlertCircle className="size-4" />} label="Critical/High Events" value={String(data.security.criticalSecurityEvents)} status={data.security.criticalSecurityEvents > 0 ? "risk" : "good"} />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Error Monitoring */}
          <section>
            <SectionHeading
              eyebrow="Errors"
              title="Error Monitoring"
              body="Track application errors across all services."
            />
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black">Recent Errors</h3>
                    <div className="flex gap-2">
                      <Badge variant="error">{data.errors.unresolvedErrors} unresolved</Badge>
                      <Badge variant="warning">{data.errors.totalErrors} total</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.errors.recentErrors.length > 0 ? data.errors.recentErrors.slice(0, 10).map((err) => (
                    <div key={err.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <SeverityDot severity={err.severity} />
                          <p className="font-semibold truncate">{err.message.slice(0, 100)}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{err.type} · {err.service} · {err.frequency}x · {new Date(err.lastSeen).toLocaleString()}</p>
                      </div>
                      <Badge className={err.isResolved ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                        {err.isResolved ? "Resolved" : "Open"}
                      </Badge>
                    </div>
                  )) : (
                    <EmptyState compact title="No errors recorded" description="No application errors have been logged. The platform is running clean." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><h3 className="text-lg font-black">Error Summary</h3></CardHeader>
                <CardContent className="space-y-3">
                  <ActivityRow icon={<Bug className="size-4" />} label="Total Errors" value={String(data.errors.totalErrors)} status={data.errors.totalErrors > 0 ? "watch" : "good"} />
                  <ActivityRow icon={<AlertTriangle className="size-4" />} label="Unresolved" value={String(data.errors.unresolvedErrors)} status={data.errors.unresolvedErrors > 0 ? "risk" : "good"} />
                  <ActivityRow icon={<AlertCircle className="size-4" />} label="Critical/High" value={String(data.errors.criticalErrors)} status={data.errors.criticalErrors > 0 ? "risk" : "good"} />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Data Integrity */}
          <section>
            <SectionHeading
              eyebrow="Data Quality"
              title="Data Integrity Monitoring"
              body="Automated checks to detect orphan records, missing configurations, and data inconsistencies."
            />
            <div className="mt-6 space-y-4">
              {criticalIntegrity.length > 0 && (
                <Card className="border-red-200 bg-red-50/30">
                  <CardHeader><h3 className="text-lg font-black text-red-700">Critical Issues</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {criticalIntegrity.map((issue) => (
                      <IntegrityIssueCard key={issue.id} issue={issue} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {highIntegrity.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardHeader><h3 className="text-lg font-black text-amber-800">High Priority Issues</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {highIntegrity.map((issue) => (
                      <IntegrityIssueCard key={issue.id} issue={issue} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {otherIntegrity.length > 0 && (
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Other Issues</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {otherIntegrity.map((issue) => (
                      <IntegrityIssueCard key={issue.id} issue={issue} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.dataIntegrity.length === 0 && (
                <div className="col-span-full">
                  <EmptyState
                    title="No data integrity issues found"
                    description="All data integrity checks passed. No orphan records, missing configurations, or inconsistencies detected."
                    icon={<CheckCircle2 className="size-8 text-green-500" />}
                  />
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* External Health Tab */}
      {activeTab === "external-health" && (
        <section>
          <SectionHeading
            eyebrow="External Providers"
            title="External Service Health"
            body="Active health checks for external API providers and infrastructure services."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {eh.length > 0 ? eh.map((check) => (
              <ExternalHealthCard
                key={check.service}
                check={check}
                isFlashing={flashingCards.has(`ext-${check.service}`)}
                isExpanded={expandedCards.has(`ext-${check.service}`)}
                onToggle={() => {
                  const key = `ext-${check.service}`;
                  const next = new Set(expandedCards);
                  if (next.has(key)) next.delete(key); else next.add(key);
                  setExpandedCards(next);
                }}
              />
            )) : (
              <div className="col-span-full">
                <EmptyState
                  title="No External Health Data"
                  description="External health checks will appear here once monitoring is configured."
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && <NotificationsTab />}
    </div>
  );
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p></div>;
}

function HealthCard({ check, isFlashing, isExpanded, onToggle }: { check: HealthCheck; isFlashing: boolean; isExpanded: boolean; onToggle: () => void }) {
  const colorKey = check.status as keyof typeof severityColors;
  const Icon = statusIcon[check.status];
  const uptimePct = check.status === "healthy" ? 100 : check.status === "degraded" ? 99 : check.status === "down" ? 0 : 50;

  const sparklineData = [
    { latency: check.latencyMs ?? 0 },
    { latency: check.latencyMs ?? 0 },
    { latency: check.latencyMs ?? 0 },
    { latency: check.latencyMs ?? 0 },
    { latency: check.latencyMs ?? 0 },
  ];

  return (
    <Card className={`transition-all duration-500 ${isFlashing ? "ring-2 ring-red-500 bg-red-50" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${severityColors[colorKey].split(" ")[1]}`}>
              <Icon className={`size-5 ${severityColors[colorKey].split(" ")[2]}`} />
            </div>
            <div>
              <p className="font-black text-sm">{check.label}</p>
              <p className="text-xs text-muted-foreground">
                {check.latencyMs !== null ? `${check.latencyMs}ms · ` : ""}
                {uptimePct}% uptime
              </p>
            </div>
          </div>
          <Badge className={severityColors[check.status as keyof typeof severityColors]}>
            {check.status}
          </Badge>
        </div>
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`gradient-${check.component}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="latency" stroke="#22D3EE" fill={`url(#gradient-${check.component})`} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {check.lastCheckedAt && (
            <p className="text-xs text-muted-foreground">{getRelativeTime(check.lastCheckedAt)}</p>
          )}
          <button onClick={onToggle} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {isExpanded ? "Less" : "Details"}
          </button>
        </div>
        {isExpanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              <strong>Component:</strong> {check.component}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Latency:</strong> {check.latencyMs ?? "N/A"}ms
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Last checked:</strong> {check.lastCheckedAt ? new Date(check.lastCheckedAt).toLocaleString() : "Never"}
            </p>
            {check.message && (
              <p className="text-xs text-muted-foreground">
                <strong>Message:</strong> {check.message}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              <ButtonLink href="/super-admin/security" variant="secondary" size="sm" className="flex-1 text-xs">
                <ShieldAlert className="size-3" />
                Security
              </ButtonLink>
              <ButtonLink href={`/super-admin/observability?component=${check.component}`} variant="secondary" size="sm" className="flex-1 text-xs">
                <ExternalLink className="size-3" />
                Investigate
              </ButtonLink>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExternalHealthCard({ check, isFlashing, isExpanded, onToggle }: { check: ExternalHealthCheckResult; isFlashing: boolean; isExpanded: boolean; onToggle: () => void }) {
  const status = check.status === "up" ? "healthy" : check.status === "degraded" ? "degraded" : "down";
  const colorKey = status as keyof typeof severityColors;
  const uptimePct = check.uptimePercent ?? (check.status === "up" ? 100 : check.status === "degraded" ? 99 : 0);

  const sparklineData = [
    { latency: check.latency },
    { latency: check.latency },
    { latency: check.latency },
    { latency: check.latency },
    { latency: check.latency },
  ];

  return (
    <Card className={`transition-all duration-500 ${isFlashing ? "ring-2 ring-red-500 bg-red-50" : ""}`}>
      <CardContent className="rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`size-3 rounded-full ${check.status === "up" ? "bg-green-500" : check.status === "degraded" ? "bg-amber-500" : "bg-red-500"} ${check.status !== "up" ? "animate-pulse" : ""}`} />
            <div>
              <div className="text-sm font-black">{check.label}</div>
              <div className="text-xs text-muted-foreground">{check.latency}ms · {uptimePct}% uptime</div>
            </div>
          </div>
          <Badge className={severityColors[colorKey]}>{check.status}</Badge>
        </div>
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`gradient-ext-${check.service}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="latency" stroke="#22D3EE" fill={`url(#gradient-ext-${check.service})`} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{getRelativeTime(check.lastChecked)}</p>
          <button onClick={onToggle} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {isExpanded ? "Less" : "Details"}
          </button>
        </div>
        {isExpanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <p><strong>Service:</strong> {check.service}</p>
            <p><strong>Latency:</strong> {check.latency}ms</p>
            <p><strong>Status:</strong> {check.status}</p>
            <p><strong>Last checked:</strong> {new Date(check.lastChecked).toLocaleString()}</p>
            {check.error && <p className="text-red-600"><strong>Error:</strong> {check.error}</p>}
            <div className="flex gap-2 mt-2">
              <ButtonLink href="/super-admin/security" variant="secondary" size="sm" className="flex-1 text-xs">
                <ShieldAlert className="size-3" />
                Security
              </ButtonLink>
              <ButtonLink href={`/super-admin/observability?service=${check.service}`} variant="secondary" size="sm" className="flex-1 text-xs">
                <ExternalLink className="size-3" />
                Investigate
              </ButtonLink>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const [config, setConfig] = useState<{
    emailRecipients: string;
    slackWebhookUrl: string;
    pagerdutyIntegrationKey: string;
    pagerdutySeverityMapping: Record<string, string>;
    thresholdLatencyWarningMs: number;
    thresholdErrorRatePct: number;
    thresholdUptimeWarningPct: number;
    isActive: boolean;
  }>({
    emailRecipients: "",
    slackWebhookUrl: "",
    pagerdutyIntegrationKey: "",
    pagerdutySeverityMapping: { healthy: "info", degraded: "warning", down: "critical" },
    thresholdLatencyWarningMs: 500,
    thresholdErrorRatePct: 5,
    thresholdUptimeWarningPct: 99,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingPagerDuty, setTestingPagerDuty] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { config: savedConfig } = await getAlertConfigAction();
        if (savedConfig) {
          setConfig({
            emailRecipients: savedConfig.emailRecipients,
            slackWebhookUrl: savedConfig.slackWebhookUrl,
            pagerdutyIntegrationKey: savedConfig.pagerdutyIntegrationKey,
            pagerdutySeverityMapping: savedConfig.pagerdutySeverityMapping,
            thresholdLatencyWarningMs: savedConfig.thresholdLatencyWarningMs,
            thresholdErrorRatePct: savedConfig.thresholdErrorRatePct,
            thresholdUptimeWarningPct: savedConfig.thresholdUptimeWarningPct,
            isActive: savedConfig.isActive,
          });
        }
      } catch {
        // Use defaults
      } finally {
        setLoadingConfig(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const result = await getAlertHistoryAction();
        setAlertHistory(result.history);
      } catch {
        // No history
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveAlertConfigAction({
        emailRecipients: config.emailRecipients,
        slackWebhookUrl: config.slackWebhookUrl,
        pagerdutyIntegrationKey: config.pagerdutyIntegrationKey,
        pagerdutySeverityMapping: config.pagerdutySeverityMapping,
        thresholdLatencyWarningMs: config.thresholdLatencyWarningMs,
        thresholdErrorRatePct: config.thresholdErrorRatePct,
        thresholdUptimeWarningPct: config.thresholdUptimeWarningPct,
        alertRules: [],
        isActive: config.isActive,
      });
      if (result.status === "success") {
        showToast("Alert configuration saved", "success");
      } else {
        showToast(result.message, "error");
      }
    } catch {
      showToast("Failed to save alert configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSlack = async () => {
    if (!config.slackWebhookUrl) {
      showToast("Please enter a Slack webhook URL first", "error");
      return;
    }
    setTestingSlack(true);
    try {
      const result = await testSlackWebhookAction(config.slackWebhookUrl);
      showToast(result.message, result.status === "success" ? "success" : "error");
    } catch {
      showToast("Failed to test Slack webhook", "error");
    } finally {
      setTestingSlack(false);
    }
  };

  const handleTestPagerDuty = async () => {
    if (!config.pagerdutyIntegrationKey) {
      showToast("Please enter a PagerDuty integration key first", "error");
      return;
    }
    setTestingPagerDuty(true);
    try {
      const result = await testPagerDutyAction(config.pagerdutyIntegrationKey);
      showToast(result.message, result.status === "success" ? "success" : "error");
    } catch {
      showToast("Failed to test PagerDuty", "error");
    } finally {
      setTestingPagerDuty(false);
    }
  };

  const [subTab, setSubTab] = useState<"config" | "history">("config");

  return (
    <section>
      <SectionHeading
        eyebrow="Alerting"
        title="Notification & Alert Configuration"
        body="Configure how monitoring alerts are delivered via email, Slack, or PagerDuty."
      />
      <div className="mt-6">
        <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1 mb-6">
          <button
            onClick={() => setSubTab("config")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              subTab === "config" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings2 className="size-4" />
            Configuration
          </button>
          <button
            onClick={() => setSubTab("history")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              subTab === "history" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="size-4" />
            Alert History
          </button>
        </div>

        {subTab === "config" && (
          <Card>
            <CardContent className="p-6 space-y-6">
              {loadingConfig ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading configuration...
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black">Notification Channels</h3>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={config.isActive}
                        onChange={(e) => setConfig({ ...config, isActive: e.target.checked })}
                        className="rounded border-border"
                      />
                      Enable alerts
                    </label>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Email Recipients</label>
                    <Input
                      placeholder="admin@example.com, ops@example.com"
                      value={config.emailRecipients}
                      onChange={(e) => setConfig({ ...config, emailRecipients: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated email addresses for alert notifications.</p>
                  </div>

                  {/* Slack */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Slack Webhook URL</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://hooks.slack.com/services/..."
                        value={config.slackWebhookUrl}
                        onChange={(e) => setConfig({ ...config, slackWebhookUrl: e.target.value })}
                        className="flex-1"
                      />
                      <Button variant="secondary" onClick={handleTestSlack} disabled={testingSlack} className="shrink-0">
                        {testingSlack ? <Loader2 className="size-4 animate-spin" /> : null}
                        Test
                      </Button>
                    </div>
                  </div>

                  {/* PagerDuty */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">PagerDuty Integration Key</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="PagerDuty routing key"
                        value={config.pagerdutyIntegrationKey}
                        onChange={(e) => setConfig({ ...config, pagerdutyIntegrationKey: e.target.value })}
                        className="flex-1"
                      />
                      <Button variant="secondary" onClick={handleTestPagerDuty} disabled={testingPagerDuty} className="shrink-0">
                        {testingPagerDuty ? <Loader2 className="size-4 animate-spin" /> : null}
                        Test
                      </Button>
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* Thresholds */}
                  <div>
                    <h3 className="text-lg font-black mb-4">Threshold Configuration</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Latency Warning (ms)</label>
                        <Input
                          type="number"
                          value={config.thresholdLatencyWarningMs}
                          onChange={(e) => setConfig({ ...config, thresholdLatencyWarningMs: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Error Rate Warning (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={config.thresholdErrorRatePct}
                          onChange={(e) => setConfig({ ...config, thresholdErrorRatePct: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Uptime Warning (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={config.thresholdUptimeWarningPct}
                          onChange={(e) => setConfig({ ...config, thresholdUptimeWarningPct: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    {saving ? "Saving..." : "Save Configuration"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {subTab === "history" && (
          <Card>
            <CardHeader><h3 className="text-lg font-black">Alert History</h3></CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading alert history...
                </div>
              ) : alertHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">Service</th>
                        <th className="pb-2 pr-4">Severity</th>
                        <th className="pb-2 pr-4">Channel</th>
                        <th className="pb-2 pr-4">Title</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory.map((alert) => (
                        <tr key={alert.id} className="border-b border-border/50">
                          <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{new Date(alert.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-4 font-medium">{alert.service}</td>
                          <td className="py-2 pr-4">
                            <Badge className={
                              alert.severity === "critical" ? "border-red-200 bg-red-50 text-red-700" :
                              alert.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" :
                              "border-blue-200 bg-blue-50 text-blue-700"
                            }>
                              {alert.severity}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-xs">{alert.channel}</td>
                          <td className="py-2 pr-4 max-w-[200px] truncate">{alert.title}</td>
                          <td className="py-2 pr-4">
                            {alert.acknowledged ? (
                              <Badge className="border-green-200 bg-green-50 text-green-700">Acknowledged</Badge>
                            ) : (
                              <Badge className="border-amber-200 bg-amber-50 text-amber-800">Pending</Badge>
                            )}
                          </td>
                          <td className="py-2">
                            {!alert.acknowledged && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  const result = await acknowledgeAlertAction(alert.id);
                                  if (result.status === "success") {
                                    setAlertHistory((prev) =>
                                      prev.map((a) =>
                                        a.id === alert.id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString(), acknowledgedBy: null } : a
                                      )
                                    );
                                    showToast("Alert acknowledged", "success");
                                  }
                                }}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState compact title="No alerts" description="No alerts have been triggered yet." />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function ActivityRow({ icon, label, value, status }: { icon: React.ReactNode; label: string; value: string; status?: "good" | "watch" | "risk" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <p className="font-semibold">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-black">{value}</span>
        {status && <span className={`size-2 rounded-full ${status === "good" ? "bg-green-500" : status === "watch" ? "bg-amber-500" : "bg-red-500"}`} />}
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    info: "bg-blue-500",
    notice: "bg-blue-500",
    low: "bg-blue-500",
    warning: "bg-amber-500",
    medium: "bg-amber-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  return <span className={`mt-1 size-2 shrink-0 rounded-full ${colors[severity] ?? "bg-gray-400"}`} />;
}

function EventStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    open: "border-red-200 bg-red-50 text-red-700",
    investigating: "border-amber-200 bg-amber-50 text-amber-800",
    resolved: "border-green-200 bg-green-50 text-green-700",
    dismissed: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return <Badge className={c[status] ?? ""}>{status}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    healthy: "border-green-200 bg-green-50 text-green-700",
    degraded: "border-amber-200 bg-amber-50 text-amber-800",
    down: "border-red-200 bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    healthy: "All Systems Healthy",
    degraded: "Needs Attention",
    down: "Critical Issues",
  };
  return <Badge className={c[status] ?? ""}>{labels[status] ?? status}</Badge>;
}

function IntegrityIssueCard({ issue }: { issue: DataIntegrityIssue }) {
  const severityColorsMap: Record<string, string> = {
    critical: "border-red-200 bg-red-50 text-red-700",
    high: "border-amber-200 bg-amber-50 text-amber-800",
    medium: "border-blue-200 bg-blue-50 text-blue-700",
    low: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge className={severityColorsMap[issue.severity]}>{issue.severity}</Badge>
          <p className="font-black">{issue.label}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-black text-muted-foreground">{issue.count}</span>
      </div>
    </div>
  );
}
