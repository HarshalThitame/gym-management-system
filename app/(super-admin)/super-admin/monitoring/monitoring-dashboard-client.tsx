"use client";

import {
  Activity,
  AlertTriangle,
  Database,
  Globe,
  HeartPulse,
  RefreshCcw,
  Server,
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
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { showToast } from "@/components/ui/toast";
import type { AuthContext } from "@/types/auth";
import type { MonitoringDashboard, HealthCheck, DataIntegrityIssue } from "@/features/monitoring/services/monitoring-service";

type Props = { context: AuthContext; dashboard: MonitoringDashboard };

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

export function MonitoringDashboardClient({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const [data, setData] = useState<MonitoringDashboard>(dashboard);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/super-admin/monitoring/refresh");
      if (!res.ok) throw new Error("Failed to refresh");
      const fresh = await res.json();
      setData(fresh);
      showToast("Monitoring data refreshed successfully", "success");
    } catch {
      showToast("Unable to refresh monitoring data. Please try again.", "error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const h = data.platformHealth;
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
              <Button onClick={handleRefresh} disabled={refreshing} variant="secondary" className="gap-2">
                {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricBox label="Platform Health" value={`${platformScore}%`} status={platformScore >= 80 ? "good" : platformScore >= 50 ? "watch" : "risk"} />
            <MetricBox label="Services Monitored" value={String(totalCount)} status="good" />
            <MetricBox label="Healthy Services" value={`${healthyCount}/${totalCount}`} status={healthyCount === totalCount ? "good" : healthyCount > 0 ? "watch" : "risk"} />
            <MetricBox label="Data Integrity" value={String(data.dataIntegrity.length)} status={data.dataIntegrity.length === 0 ? "good" : criticalIntegrity.length > 0 ? "risk" : "watch"} />
          </div>
          {data.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <strong>Warning:</strong> Some data may be incomplete. {data.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Health */}
      <section>
        <SectionHeading
          eyebrow="System Status"
          title="Platform Health Overview"
          body={`Real-time health status of ${h.length} platform components. Last updated ${new Date(data.fetchedAt).toLocaleTimeString()}.`}
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {h.length > 0 ? h.map((check) => (
            <HealthCard key={check.component} check={check} />
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
    </div>
  );
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p></div>;
}

function HealthCard({ check }: { check: HealthCheck }) {
  const colorKey = check.status as keyof typeof severityColors;
  const Icon = statusIcon[check.status];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${severityColors[colorKey].split(" ")[1]}`}>
              <Icon className={`size-5 ${severityColors[colorKey].split(" ")[2]}`} />
            </div>
            <div>
              <p className="font-black text-sm">{check.label}</p>
              <p className="text-xs text-muted-foreground capitalize">{check.status}</p>
            </div>
          </div>
          <Badge className={severityColors[check.status as keyof typeof severityColors]}>
            {check.status}
          </Badge>
        </div>
        {check.latencyMs !== null && (
          <p className="mt-3 text-xs text-muted-foreground">Latency: {check.latencyMs}ms</p>
        )}
        {check.lastCheckedAt && (
          <p className="mt-1 text-xs text-muted-foreground">Last checked: {new Date(check.lastCheckedAt).toLocaleString()}</p>
        )}
        {check.message && (
          <p className="mt-2 text-xs text-muted-foreground">{check.message}</p>
        )}
      </CardContent>
    </Card>
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
