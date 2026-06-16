"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DatabaseBackup,
  Download,
  FileText,
  Gauge,
  Globe2,
  Landmark,
  LifeBuoy,
  ReceiptText,
  Server,
  ShieldAlert,
  TrendingUp,
  UserCog,
  UsersRound,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { BranchPerformanceChart, TenantUsageChart } from "@/features/enterprise/components/lazy-enterprise-charts";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { latestHealthByComponent } from "@/features/enterprise/lib/health";
import type { EnterpriseDashboard, EnterpriseKpi } from "@/types/enterprise";
import { scheduleDashboardSummaryEmailAction, updateDashboardSecurityEventAction } from "../actions/dashboard-actions";
import type { DashboardThresholds, SuperAdminDashboardOperations } from "../services/dashboard-service";
import type { OrgSubscriptionSummary, SubscriptionStatus } from "../services/subscription-service";
import { PackageBadge } from "./subscriptions/PackageBadge";
import { superAdminModules } from "../lib/super-admin-modules";

type SuperAdminDashboardProps = {
  dashboard: EnterpriseDashboard;
  operations: SuperAdminDashboardOperations;
  orgSubscriptions: OrgSubscriptionSummary[];
};

type DashboardRiskItem = {
  key: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  status: EnterpriseKpi["status"];
};

type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  status: EnterpriseKpi["status"];
  href?: string;
};

type DashboardInsights = {
  activeSubscriptions: number;
  annualRevenue: number;
  criticalSecurityEvents: number;
  currentYear: number;
  degradedHealthChecks: number;
  downHealthChecks: number;
  expiredSubscriptions: number;
  failedBackups: number;
  failedDomains: number;
  hardBlockedSubscriptions: number;
  latestRevenue: number;
  monthlyRevenue: number;
  newOrganizationsThisMonth: number;
  openComplianceRequests: number;
  openSecurityEvents: number;
  overdueComplianceRequests: number;
  pendingDomains: number;
  readinessScore: number;
  reconciliationIssues: number;
  restrictedSubscriptions: number;
  suspendedOrganizations: number;
  totalActiveBranches: number;
  totalActiveMembers: number;
  totalStaff: number;
  totalTrainers: number;
  trialSubscriptions: number;
  unassignedSubscriptions: number;
  verifiedDomains: number;
};

const moduleGroups = [
  { title: "Tenant Operations", slugs: ["organizations", "gyms", "domains", "white-label"] },
  { title: "Revenue Operations", slugs: ["subscriptions", "billing", "analytics", "feature-flags"] },
  { title: "Trust and Support", slugs: ["users", "roles", "security", "support"] },
  { title: "Platform Reliability", slugs: ["monitoring", "backups", "audit-logs", "settings"] }
] as const;

const riskRank: Record<EnterpriseKpi["status"], number> = {
  risk: 0,
  watch: 1,
  good: 2
};

const progressToneClasses: Record<EnterpriseKpi["status"], string> = {
  good: "bg-green-600",
  watch: "bg-amber-500",
  risk: "bg-red-600"
};

const postureClasses: Record<EnterpriseKpi["status"], string> = {
  good: "border-green-200 bg-green-50 text-green-700",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  risk: "border-red-200 bg-red-50 text-red-700"
};

export function SuperAdminDashboard({ dashboard, operations, orgSubscriptions }: SuperAdminDashboardProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { setNow(new Date()); }, []);
  const insights = buildDashboardInsights(dashboard, operations, orgSubscriptions, now);
  const recentHealth = latestHealthByComponent(dashboard.healthChecks).slice(0, 8);
  const openSecurityEvents = dashboard.securityEvents
    .filter((event) => event.status === "open" || event.status === "investigating")
    .slice(0, 5);
  const recentActivity = dashboard.activityEvents.slice(0, 7);
  const tenantUsage = [...dashboard.tenantUsagePoints]
    .sort((left, right) => maxUsagePercent(right) - maxUsagePercent(left))
    .slice(0, 6);
  const topBranches = dashboard.branchPerformance.slice(0, 6);
  const riskItems = buildRiskItems(insights, dashboard.tenantUsagePoints.length);
  const metrics = buildExecutiveMetrics(dashboard, insights);
  const packageMix = buildPackageMix(orgSubscriptions);
  const subscriptionStatusMix = buildSubscriptionStatusMix(orgSubscriptions);
  const returnTo = dashboardReturnHref(operations);
  const readinessPosture = readinessStatus(insights.readinessScore, operations.thresholds);
  const planCoveragePercent = orgSubscriptions.length > 0
    ? Math.round(((orgSubscriptions.length - insights.unassignedSubscriptions) / orgSubscriptions.length) * 100)
    : 0;
  const subscriptionPosture = insights.hardBlockedSubscriptions > 0 || insights.unassignedSubscriptions > 0
    ? "risk"
    : insights.expiredSubscriptions > 0 || insights.trialSubscriptions > 0
      ? "watch"
      : "good";

  return (
    <div className="space-y-8">
      <DashboardFilterBar operations={operations} />

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800">Global SaaS Command</Badge>
                  <EnterpriseStatusBadge status={readinessPosture} />
                </div>
                <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight md:text-5xl">Enterprise Platform Dashboard</h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
                  Monitor tenant growth, finance-grade revenue, subscription coverage, SLO posture, security exposure, and recovery readiness from one Super Admin control center.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <ButtonLink href="/super-admin/security" variant="primary">
                    <ShieldAlert aria-hidden="true" className="size-4" />
                    Review Security
                  </ButtonLink>
                  <ButtonLink href="/super-admin/monitoring" variant="secondary">
                    <Server aria-hidden="true" className="size-4" />
                    Open Monitoring
                  </ButtonLink>
                  <ButtonLink href="/super-admin/subscriptions" variant="secondary">
                    <CreditCard aria-hidden="true" className="size-4" />
                    Manage Plans
                  </ButtonLink>
                </div>
              </div>

              <ReadinessScoreCard insights={insights} thresholds={operations.thresholds} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Today&apos;s Focus</p>
                <h3 className="mt-2 text-2xl font-black">Action Queue</h3>
              </div>
              <LifeBuoy aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskItems.slice(0, 4).map((item) => (
              <ActionQueueItem item={item} key={item.key} />
            ))}
          </CardContent>
        </Card>
      </section>

      <FreshnessStrip sources={operations.freshness} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <ExecutiveMetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid gap-5 grid-cols-1 md:grid-cols-3 xl:grid-cols-3">
        <FinanceIntegrityCard finance={operations.finance} />
        <SloMonitoringCard slo={operations.slo} thresholds={operations.thresholds} />
        <RoleActivityIntelligenceCard roleRisk={operations.roleRisk} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Commercial Health</p>
              <h3 className="mt-2 text-2xl font-black">Package Coverage</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Assignment coverage, lifecycle status, and plan mix for tenant organizations.</p>
            </div>
            <ButtonLink href="/super-admin/subscriptions" size="sm" variant="secondary">
              Manage
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black">Plan Assignment Coverage</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatCompactNumber(orgSubscriptions.length - insights.unassignedSubscriptions)} of {formatCompactNumber(orgSubscriptions.length)} organizations assigned</p>
                </div>
                <Badge className={postureClasses[subscriptionPosture]}>{planCoveragePercent}%</Badge>
              </div>
              <ProgressBar status={subscriptionPosture} value={planCoveragePercent} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {subscriptionStatusMix.map((item) => (
                <div className="rounded-md border border-border bg-background p-4" key={item.label}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">{item.label}</p>
                    <EnterpriseStatusBadge status={item.status ?? "unassigned"} />
                  </div>
                  <p className="mt-3 text-3xl font-black">{formatCompactNumber(item.count)}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {packageMix.length > 0 ? packageMix.map((item) => (
                <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-4" key={item.name}>
                  <div className="flex items-center gap-3">
                    <PackageBadge packageName={item.name} />
                    <p className="text-sm font-semibold text-muted-foreground">{item.detail}</p>
                  </div>
                  <p className="text-sm font-black">{formatCompactNumber(item.count)}</p>
                </div>
              )) : <EmptyState actionHref="/super-admin/subscriptions" actionLabel="Assign Packages" text="No package assignments are available yet." />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tenant Operations</p>
              <h3 className="mt-2 text-2xl font-black">Capacity Pressure</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Highest utilization tenants by member, branch, and storage limits.</p>
            </div>
            <ButtonLink href="/super-admin/analytics" size="sm" variant="secondary">
              Analytics
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantUsage.length > 0 ? tenantUsage.map((tenant) => (
              <div className="rounded-md border border-border bg-background p-4" key={tenant.organizationName}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black">{tenant.organizationName}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {formatCompactNumber(tenant.activeMembers)} active members · {formatCompactNumber(tenant.branches)} branches
                    </p>
                  </div>
                  <EnterpriseStatusBadge status={usageStatus(maxUsagePercent(tenant), operations.thresholds)} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <InlineUsage label="Members" thresholds={operations.thresholds} value={tenant.memberPercent} />
                  <InlineUsage label="Branches" thresholds={operations.thresholds} value={tenant.branchPercent} />
                  <InlineUsage label="Storage" thresholds={operations.thresholds} value={tenant.storagePercent} />
                </div>
              </div>
            )) : <EmptyState actionHref="/super-admin/subscriptions" actionLabel="Review Limits" text="Tenant usage will appear after limits and metrics are configured." />}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartPanel
          actionHref="/super-admin/analytics"
          description="Branch leaders for the selected period. Finance totals above come from payments, invoices, refunds, and provider events."
          title="Top Branch Performance"
        >
          {dashboard.branchPerformance.length > 0 ? (
            <BranchPerformanceChart data={dashboard.branchPerformance} />
          ) : (
            <EmptyState actionHref="/super-admin/analytics" actionLabel="Open Analytics" text="Branch performance appears after branch metrics are recorded." />
          )}
        </ChartPanel>

        <ChartPanel
          actionHref="/super-admin/analytics"
          description="Commercial usage against branch, member, and storage limits for the largest tenants."
          title="Tenant Usage Overview"
        >
          {dashboard.tenantUsagePoints.length > 0 ? (
            <TenantUsageChart data={dashboard.tenantUsagePoints} />
          ) : (
            <EmptyState actionHref="/super-admin/subscriptions" actionLabel="Assign Packages" text="Tenant usage appears after organizations and subscriptions are configured." />
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reliability</p>
              <h3 className="mt-2 text-2xl font-black">Platform Health</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Latest health checks by component with latency and operator-facing messages.</p>
            </div>
            <ButtonLink href="/super-admin/monitoring" size="sm" variant="secondary">
              Details
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentHealth.length > 0 ? recentHealth.map((check) => (
              <div className="flex flex-col justify-between gap-4 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center" key={`${check.component}-${check.checked_at}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{formatEnterpriseLabel(check.component)}</p>
                    <EnterpriseStatusBadge status={check.status} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {check.message ?? "Latest health check"} · {check.latency_ms ?? 0}ms · {formatDateTime(check.checked_at)}
                  </p>
                </div>
              </div>
            )) : <EmptyState actionHref="/super-admin/monitoring" actionLabel="Configure Health Checks" text="No health checks have been recorded yet." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Recovery and Domains</p>
            <h3 className="mt-2 text-2xl font-black">Operational Readiness</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Backup, custom domain, and SSL signals that affect go-live confidence.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReadinessRow
              detail={`${formatCompactNumber(insights.failedBackups)} failed · ${formatCompactNumber(dashboard.backupJobs.length)} recent jobs`}
              href="/super-admin/backups"
              icon={<DatabaseBackup className="size-4" />}
              label="Backup Jobs"
              status={insights.failedBackups > 0 ? "risk" : dashboard.backupJobs.length > 0 ? "good" : "watch"}
              value={latestBackupLabel(dashboard)}
            />
            <ReadinessRow
              detail={`${formatCompactNumber(insights.verifiedDomains)} verified · ${formatCompactNumber(insights.pendingDomains)} pending`}
              href="/super-admin/domains"
              icon={<Globe2 className="size-4" />}
              label="Domain Routing"
              status={insights.failedDomains > 0 ? "risk" : insights.pendingDomains > 0 ? "watch" : "good"}
              value={`${formatCompactNumber(dashboard.tenantDomains.length)} domains`}
            />
            <ReadinessRow
              detail={`${formatCompactNumber(insights.openComplianceRequests)} open · ${formatCompactNumber(insights.overdueComplianceRequests)} overdue`}
              href="/super-admin/support"
              icon={<LifeBuoy className="size-4" />}
              label="Compliance Queue"
              status={insights.overdueComplianceRequests > 0 ? "risk" : insights.openComplianceRequests > 0 ? "watch" : "good"}
              value={`${formatCompactNumber(dashboard.complianceRequests.length)} requests`}
            />
            <ReadinessRow
              detail={`${formatCompactNumber(insights.suspendedOrganizations)} suspended or deactivated tenants`}
              href="/super-admin/organizations"
              icon={<Building2 className="size-4" />}
              label="Tenant Governance"
              status={insights.suspendedOrganizations > 0 ? "watch" : "good"}
              value={`${formatCompactNumber(dashboard.organizations.length)} organizations`}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Security</p>
              <h3 className="mt-2 text-2xl font-black">Open Security Alerts</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Prioritized security events requiring Super Admin review.</p>
            </div>
            <ButtonLink href="/super-admin/security" size="sm" variant="secondary">
              Security Center
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="space-y-3">
            {openSecurityEvents.length > 0 ? openSecurityEvents.map((event) => (
              <div className="rounded-md border border-border bg-background p-4" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{formatEnterpriseLabel(event.event_type)}</p>
                    <EnterpriseStatusBadge status={event.severity} />
                    <EnterpriseStatusBadge status={event.status} />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">{formatDateTime(event.created_at)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description ?? "Security event needs review."}</p>
                <SecurityWorkflowActions eventId={event.id} returnTo={returnTo} severity={event.severity} />
              </div>
            )) : <EmptyState actionHref="/super-admin/security" actionLabel="Open Security Center" text="No open or investigating security alerts." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Audit Trail</p>
              <h3 className="mt-2 text-2xl font-black">Recent Platform Activity</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Latest privileged actions, configuration changes, and tenant events.</p>
            </div>
            <ButtonLink href="/super-admin/audit-logs" size="sm" variant="secondary">
              Audit Logs
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((event) => (
              <div className="rounded-md border border-border bg-background p-4" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{formatEnterpriseLabel(event.event_type)}</p>
                    <EnterpriseStatusBadge status={event.severity ?? "info"} />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">{formatDateTime(event.created_at)}</p>
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  {formatEnterpriseLabel(event.entity_type)} · {event.entity_id ?? "No entity"} · {event.actor_id ?? "System actor"}
                </p>
              </div>
            )) : <EmptyState actionHref="/super-admin/audit-logs" actionLabel="Open Audit Logs" text="No recent platform activity is available." />}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Branch Leaders</p>
            <h3 className="mt-2 text-2xl font-black">Revenue and Member Leaders</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Top performing branch snapshots for quick operating review.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topBranches.length > 0 ? topBranches.map((branch, index) => (
              <div className="rounded-md border border-border bg-background p-4" key={`${branch.branchName}-${index}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black">{branch.branchName}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {formatCompactNumber(branch.members)} members · {formatCompactNumber(branch.attendance)} attendance records
                    </p>
                  </div>
                  <p className="text-sm font-black">{formatCurrency(branch.revenue)}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InlineUsage label="Trainer utilization" thresholds={operations.thresholds} value={branch.trainerUtilization} />
                  <InlineUsage label="Class utilization" thresholds={operations.thresholds} value={branch.classUtilization} />
                </div>
              </div>
            )) : <EmptyState actionHref="/super-admin/analytics" actionLabel="Open Analytics" text="Top branch data appears after branch metrics are recorded." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Navigation</p>
            <h3 className="mt-2 text-2xl font-black">Super Admin Workspaces</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Grouped module shortcuts for tenant operations, revenue, trust, and platform reliability.</p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {moduleGroups.map((group) => (
              <div className="rounded-md border border-border bg-background p-4" key={group.title}>
                <p className="text-sm font-black">{group.title}</p>
                <div className="mt-3 grid gap-2">
                  {group.slugs.map((slug) => {
                    const superModule = superAdminModules.find((module) => module.slug === slug);

                    if (!superModule) {
                      return null;
                    }

                    return (
                      <ButtonLink className="justify-start text-left" href={superModule.href} key={slug} size="sm" variant="secondary">
                        {superModule.icon}
                        {superModule.label}
                      </ButtonLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DashboardFilterBar({ operations }: { operations: SuperAdminDashboardOperations }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 xl:flex-row xl:items-end xl:justify-between md:p-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-end" method="get">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="dashboard-range">Date range</label>
            <select className="mt-2 h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold" defaultValue={operations.dateRange.key} id="dashboard-range" name="range">
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="dashboard-from">From</label>
            <input className="mt-2 h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold" defaultValue={toDateInput(operations.dateRange.from)} id="dashboard-from" name="from" suppressHydrationWarning type="date" />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="dashboard-to">To</label>
            <input className="mt-2 h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold" defaultValue={toDateInput(operations.dateRange.to)} id="dashboard-to" name="to" suppressHydrationWarning type="date" />
          </div>
          <Button className="md:mb-0" type="submit" variant="secondary">
            <CalendarDays aria-hidden="true" className="size-4" />
            Apply
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{operations.dateRange.label}</Badge>
          <ButtonLink href={operations.exportLinks.csv} size="sm" variant="secondary">
            <Download aria-hidden="true" className="size-4" />
            CSV
          </ButtonLink>
          <ButtonLink href={operations.exportLinks.pdf} size="sm" variant="secondary">
            <FileText aria-hidden="true" className="size-4" />
            PDF
          </ButtonLink>
          <form action={scheduleDashboardSummaryEmailAction}>
            <input name="returnTo" suppressHydrationWarning type="hidden" value={dashboardReturnHref(operations)} />
            <Button size="sm" type="submit" variant="secondary">
              <Clock3 aria-hidden="true" className="size-4" />
              Weekly Email
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function FreshnessStrip({ sources }: { sources: SuperAdminDashboardOperations["freshness"] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {sources.map((source) => (
        <div className="rounded-md border border-border bg-surface p-4" key={source.label}>
          <div className="flex items-center justify-between gap-3">
            <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
            <EnterpriseStatusBadge status={source.status} />
          </div>
          <p className="mt-3 text-sm font-black">{source.label}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{source.source}</p>
          <p className="mt-2 text-xs font-black">{source.lastUpdatedAt ? formatDateTime(source.lastUpdatedAt) : "No data"}</p>
        </div>
      ))}
    </section>
  );
}

function FinanceIntegrityCard({ finance }: { finance: SuperAdminDashboardOperations["finance"] }) {
  const status = finance.reconciliationIssues > 0 || finance.webhookFailures > 0 || finance.failedPayments > 0 ? "risk" : finance.netRevenue > 0 ? "good" : "watch";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Finance Integrity</p>
            <h3 className="mt-2 text-2xl font-black">Revenue Ledger</h3>
          </div>
          <ReceiptText aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-4xl font-black">{formatCurrency(finance.netRevenue)}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Net revenue from {finance.sourceLabel}; gross {formatCurrency(finance.grossRevenue)} minus refunds {formatCurrency(finance.refundAmount)}.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniMetric label="Outstanding" status={finance.outstandingAmount > 0 ? "watch" : "good"} value={formatCurrency(finance.outstandingAmount)} />
          <MiniMetric label="Paid Payments" status="good" value={formatCompactNumber(finance.paidPayments)} />
          <MiniMetric label="Failed Payments" status={finance.failedPayments > 0 ? "risk" : "good"} value={formatCompactNumber(finance.failedPayments)} />
          <MiniMetric label="Reconciliation" status={status} value={formatCompactNumber(finance.reconciliationIssues)} />
        </div>
      </CardContent>
    </Card>
  );
}

function SloMonitoringCard({ slo, thresholds }: { slo: SuperAdminDashboardOperations["slo"]; thresholds: DashboardThresholds }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">SLA / SLO</p>
            <h3 className="mt-2 text-2xl font-black">Reliability Targets</h3>
          </div>
          <Server aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MiniMetric label={`Uptime target ${thresholds.slo.uptimeTargetPercent}%`} status={slo.status} value={`${slo.uptimePercent}%`} />
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniMetric label="Error Rate" status={slo.errorRatePercent > thresholds.slo.errorRateTargetPercent ? "risk" : "good"} value={`${slo.errorRatePercent}%`} />
          <MiniMetric label="API P95" status={slo.apiP95Ms !== null && slo.apiP95Ms > thresholds.slo.apiP95MsTarget ? "risk" : "good"} value={formatLatency(slo.apiP95Ms)} />
          <MiniMetric label="DB P95" status={slo.databaseP95Ms !== null && slo.databaseP95Ms > thresholds.slo.databaseP95MsTarget ? "risk" : "good"} value={formatLatency(slo.databaseP95Ms)} />
          <MiniMetric label="Failed Jobs" status={slo.failedJobs > 0 ? "risk" : "good"} value={formatCompactNumber(slo.failedJobs)} />
        </div>
      </CardContent>
    </Card>
  );
}

function RoleActivityIntelligenceCard({ roleRisk }: { roleRisk: SuperAdminDashboardOperations["roleRisk"] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Access Intelligence</p>
            <h3 className="mt-2 text-2xl font-black">Privileged Activity</h3>
          </div>
          <UserCog aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MiniMetric label="Privileged Users" status={roleRisk.status} value={formatCompactNumber(roleRisk.privilegedUsers)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniMetric label="Suspended Privileged" status={roleRisk.suspendedPrivilegedUsers > 0 ? "risk" : "good"} value={formatCompactNumber(roleRisk.suspendedPrivilegedUsers)} />
          <MiniMetric label="Role Changes" status={roleRisk.recentRoleChanges > 0 ? "watch" : "good"} value={formatCompactNumber(roleRisk.recentRoleChanges)} />
          <MiniMetric label="Failed Login Signals" status={roleRisk.failedLoginSignals > 0 ? "risk" : "good"} value={formatCompactNumber(roleRisk.failedLoginSignals)} />
          <MiniMetric label="Tenant Access Signals" status={roleRisk.unusualTenantAccessSignals > 0 ? "risk" : "good"} value={formatCompactNumber(roleRisk.unusualTenantAccessSignals)} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, status, value }: { label: string; status: EnterpriseKpi["status"]; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <EnterpriseStatusBadge status={status} />
      </div>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function SecurityWorkflowActions({ eventId, returnTo, severity }: { eventId: string; returnTo: string; severity: string }) {
  const actions: Array<{ action: "acknowledge" | "assign" | "escalate" | "snooze" | "resolve"; label: string; variant: "secondary" | "destructive" }> = [
    { action: "acknowledge", label: "Acknowledge", variant: "secondary" },
    { action: "assign", label: "Assign", variant: "secondary" },
    { action: "snooze", label: "Snooze", variant: "secondary" },
    { action: "resolve", label: "Resolve", variant: "secondary" }
  ];

  if (severity === "high" || severity === "critical") {
    actions.splice(2, 0, { action: "escalate", label: "Escalate", variant: "destructive" });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {actions.map((item) => (
        <form action={updateDashboardSecurityEventAction} key={item.action}>
          <input name="securityEventId" suppressHydrationWarning type="hidden" value={eventId} />
          <input name="action" suppressHydrationWarning type="hidden" value={item.action} />
          <input name="returnTo" suppressHydrationWarning type="hidden" value={returnTo} />
          <Button size="sm" type="submit" variant={item.variant}>{item.label}</Button>
        </form>
      ))}
    </div>
  );
}

function buildDashboardInsights(dashboard: EnterpriseDashboard, operations: SuperAdminDashboardOperations, orgSubscriptions: OrgSubscriptionSummary[], now: Date): DashboardInsights {
  const currentYear = now.getFullYear();
  const recentHealth = latestHealthByComponent(dashboard.healthChecks);
  const activeSubscriptions = orgSubscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trial").length;
  const trialSubscriptions = orgSubscriptions.filter((subscription) => subscription.status === "trial").length;
  const expiredSubscriptions = orgSubscriptions.filter((subscription) => subscription.status === "expired").length;
  const hardBlockedSubscriptions = orgSubscriptions.filter((subscription) => subscription.status === "suspended" || subscription.status === "cancelled").length;
  const unassignedSubscriptions = orgSubscriptions.filter((subscription) => !subscription.subscriptionId).length;
  const restrictedSubscriptions = expiredSubscriptions + hardBlockedSubscriptions;
  const criticalSecurityEvents = dashboard.securityEvents.filter((event) =>
    (event.status === "open" || event.status === "investigating") && (event.severity === "critical" || event.severity === "high")
  ).length;
  const openSecurityEvents = dashboard.securityEvents.filter((event) => event.status === "open" || event.status === "investigating").length;
  const openComplianceRequests = dashboard.complianceRequests.filter((request) => request.status === "open" || request.status === "in_review").length;
  const overdueComplianceRequests = dashboard.complianceRequests.filter((request) => {
    if (!request.due_at || request.status === "completed" || request.status === "approved" || request.status === "rejected") {
      return false;
    }

    return new Date(request.due_at).getTime() < now.getTime();
  }).length;
  const failedBackups = dashboard.backupJobs.filter((job) => job.status === "failed").length;
  const failedDomains = dashboard.tenantDomains.filter((domain) => domain.status === "failed" || domain.ssl_status === "failed").length;
  const pendingDomains = dashboard.tenantDomains.filter((domain) => domain.status === "pending" || domain.ssl_status === "pending").length;
  const verifiedDomains = dashboard.tenantDomains.filter((domain) => domain.status === "verified").length;
  const downHealthChecks = recentHealth.filter((check) => check.status === "down").length;
  const degradedHealthChecks = recentHealth.filter((check) => check.status === "degraded" || check.status === "unknown").length;
  const totalActiveMembers = dashboard.branchLatestMetrics.reduce((total, row) => total + Number(row.active_members ?? 0), 0);
  const readinessScore = calculateReadinessScore({
    criticalSecurityEvents,
    degradedHealthChecks,
    downHealthChecks,
    failedBackups,
    failedDomains,
    hardBlockedSubscriptions,
    overdueComplianceRequests,
    thresholds: operations.thresholds,
    unassignedSubscriptions
  });

  return {
    activeSubscriptions,
    annualRevenue: operations.finance.grossRevenue,
    criticalSecurityEvents,
    currentYear,
    degradedHealthChecks,
    downHealthChecks,
    expiredSubscriptions,
    failedBackups,
    failedDomains,
    hardBlockedSubscriptions,
    latestRevenue: operations.finance.netRevenue,
    monthlyRevenue: operations.finance.netRevenue,
    newOrganizationsThisMonth: dashboard.organizations.filter((organization) => isInSelectedRange(organization.created_at, operations)).length,
    openComplianceRequests,
    openSecurityEvents,
    overdueComplianceRequests,
    pendingDomains,
    readinessScore,
    reconciliationIssues: operations.finance.reconciliationIssues,
    restrictedSubscriptions,
    suspendedOrganizations: dashboard.organizations.filter((organization) => organization.status === "suspended" || organization.status === "deactivated").length,
    totalActiveBranches: dashboard.branches.filter((branch) => branch.status === "active").length,
    totalActiveMembers,
    totalStaff: dashboard.branchUsers.length,
    totalTrainers: dashboard.branchUsers.filter((user) => user.role_name === "trainer").length,
    trialSubscriptions,
    unassignedSubscriptions,
    verifiedDomains
  };
}

function buildExecutiveMetrics(dashboard: EnterpriseDashboard, insights: DashboardInsights): DashboardMetric[] {
  return [
    {
      detail: `${formatCompactNumber(insights.newOrganizationsThisMonth)} added in selected range`,
      href: "/super-admin/organizations?status=active",
      icon: <Landmark className="size-5" />,
      label: "Organizations",
      status: insights.suspendedOrganizations > 0 ? "watch" : "good",
      value: formatCompactNumber(dashboard.organizations.length)
    },
    {
      detail: `${formatCompactNumber(insights.totalActiveBranches)} active branches across ${formatCompactNumber(dashboard.gyms.length)} locations`,
      href: "/super-admin/branches",
      icon: <Building2 className="size-5" />,
      label: "Branches and Locations",
      status: "good",
      value: formatCompactNumber(dashboard.branches.length)
    },
    {
      detail: `${formatCompactNumber(insights.totalTrainers)} trainers · ${formatCompactNumber(insights.totalStaff)} staff assignments`,
      href: "/super-admin/users",
      icon: <UsersRound className="size-5" />,
      label: "Active Members",
      status: insights.totalActiveMembers > 0 ? "good" : "watch",
      value: formatCompactNumber(insights.totalActiveMembers)
    },
    {
      detail: `Gross ledger revenue ${formatCurrency(insights.annualRevenue)}`,
      href: "/super-admin/billing?source=payments,invoices,refunds",
      icon: <TrendingUp className="size-5" />,
      label: "Net Revenue",
      status: insights.latestRevenue > 0 ? "good" : "watch",
      value: formatCurrency(insights.monthlyRevenue)
    },
    {
      detail: `${formatCompactNumber(insights.trialSubscriptions)} trials · ${formatCompactNumber(insights.unassignedSubscriptions)} unassigned`,
      href: "/super-admin/subscriptions?status=unassigned",
      icon: <CreditCard className="size-5" />,
      label: "Active Packages",
      status: insights.hardBlockedSubscriptions > 0 || insights.unassignedSubscriptions > 0 ? "risk" : insights.trialSubscriptions > 0 ? "watch" : "good",
      value: formatCompactNumber(insights.activeSubscriptions)
    },
    {
      detail: `${formatCompactNumber(insights.downHealthChecks)} down · ${formatCompactNumber(insights.degradedHealthChecks)} degraded components`,
      href: "/super-admin/monitoring?status=down,degraded,unknown",
      icon: <Server className="size-5" />,
      label: "System Health",
      status: insights.downHealthChecks > 0 ? "risk" : insights.degradedHealthChecks > 0 ? "watch" : "good",
      value: insights.downHealthChecks > 0 ? "Action" : insights.degradedHealthChecks > 0 ? "Watch" : "Healthy"
    },
    {
      detail: `${formatCompactNumber(insights.criticalSecurityEvents)} high or critical open events`,
      href: "/super-admin/security?status=open,investigating&severity=high,critical",
      icon: <ShieldAlert className="size-5" />,
      label: "Security Alerts",
      status: insights.criticalSecurityEvents > 0 ? "risk" : insights.openSecurityEvents > 0 ? "watch" : "good",
      value: formatCompactNumber(insights.openSecurityEvents)
    },
    {
      detail: `${formatCompactNumber(insights.failedBackups)} failed backups · ${formatCompactNumber(insights.pendingDomains)} pending domains`,
      href: "/super-admin/backups?status=failed",
      icon: <DatabaseBackup className="size-5" />,
      label: "Recovery Readiness",
      status: insights.failedBackups > 0 || insights.failedDomains > 0 ? "risk" : insights.pendingDomains > 0 ? "watch" : "good",
      value: insights.failedBackups > 0 || insights.failedDomains > 0 ? "Action" : "Ready"
    }
  ];
}

function buildRiskItems(insights: DashboardInsights, tenantUsagePointCount: number): DashboardRiskItem[] {
  const items: DashboardRiskItem[] = [
    {
      count: insights.criticalSecurityEvents,
      detail: "High and critical events that are still open or under investigation.",
      href: "/super-admin/security?status=open,investigating&severity=high,critical",
      key: "security",
      label: "Security incident review",
      status: insights.criticalSecurityEvents > 0 ? "risk" : insights.openSecurityEvents > 0 ? "watch" : "good"
    },
    {
      count: insights.downHealthChecks + insights.degradedHealthChecks,
      detail: "Latest component health checks marked down, degraded, or unknown.",
      href: "/super-admin/monitoring?status=down,degraded,unknown",
      key: "health",
      label: "Infrastructure health",
      status: insights.downHealthChecks > 0 ? "risk" : insights.degradedHealthChecks > 0 ? "watch" : "good"
    },
    {
      count: insights.hardBlockedSubscriptions + insights.unassignedSubscriptions,
      detail: "Suspended, cancelled, or unassigned organization subscriptions.",
      href: "/super-admin/subscriptions?status=suspended,cancelled,unassigned",
      key: "subscriptions",
      label: "Subscription governance",
      status: insights.hardBlockedSubscriptions > 0 || insights.unassignedSubscriptions > 0 ? "risk" : insights.expiredSubscriptions > 0 ? "watch" : "good"
    },
    {
      count: insights.failedBackups,
      detail: "Failed backup jobs that need recovery evidence or rerun.",
      href: "/super-admin/backups?status=failed",
      key: "backups",
      label: "Backup failures",
      status: insights.failedBackups > 0 ? "risk" : "good"
    },
    {
      count: insights.failedDomains + insights.pendingDomains,
      detail: "Failed or pending custom domain and SSL verification records.",
      href: "/super-admin/domains?status=failed,pending",
      key: "domains",
      label: "Domain readiness",
      status: insights.failedDomains > 0 ? "risk" : insights.pendingDomains > 0 ? "watch" : "good"
    },
    {
      count: insights.overdueComplianceRequests + insights.openComplianceRequests,
      detail: "Open privacy, consent, export, and deletion workflows.",
      href: "/super-admin/support?status=open,in_review",
      key: "compliance",
      label: "Compliance operations",
      status: insights.overdueComplianceRequests > 0 ? "risk" : insights.openComplianceRequests > 0 ? "watch" : "good"
    },
    {
      count: tenantUsagePointCount,
      detail: "Tenant usage rows available for capacity and expansion review.",
      href: "/super-admin/analytics",
      key: "usage",
      label: "Tenant capacity review",
      status: tenantUsagePointCount > 0 ? "good" : "watch"
    }
  ];

  return items.sort((left, right) => riskRank[left.status] - riskRank[right.status] || right.count - left.count);
}

function calculateReadinessScore(input: {
  criticalSecurityEvents: number;
  degradedHealthChecks: number;
  downHealthChecks: number;
  failedBackups: number;
  failedDomains: number;
  hardBlockedSubscriptions: number;
  overdueComplianceRequests: number;
  thresholds: DashboardThresholds;
  unassignedSubscriptions: number;
}) {
  const thresholds = input.thresholds.readiness;
  const score = 100
    - Math.min(input.criticalSecurityEvents * thresholds.criticalSecurityPenalty, thresholds.criticalSecurityCap)
    - Math.min(input.downHealthChecks * thresholds.downHealthPenalty, thresholds.downHealthCap)
    - Math.min(input.degradedHealthChecks * thresholds.degradedHealthPenalty, thresholds.degradedHealthCap)
    - Math.min(input.failedBackups * thresholds.failedBackupPenalty, thresholds.failedBackupCap)
    - Math.min(input.failedDomains * thresholds.failedDomainPenalty, thresholds.failedDomainCap)
    - Math.min(input.hardBlockedSubscriptions * thresholds.hardBlockedSubscriptionPenalty, thresholds.hardBlockedSubscriptionCap)
    - Math.min(input.unassignedSubscriptions * thresholds.unassignedSubscriptionPenalty, thresholds.unassignedSubscriptionCap)
    - Math.min(input.overdueComplianceRequests * thresholds.overdueCompliancePenalty, thresholds.overdueComplianceCap);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPackageMix(orgSubscriptions: OrgSubscriptionSummary[]) {
  const counts = new Map<string, number>();

  for (const subscription of orgSubscriptions) {
    const packageName = subscription.packageName ?? "No plan";
    counts.set(packageName, (counts.get(packageName) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({
      count,
      detail: count === 1 ? "organization" : "organizations",
      name
    }))
    .sort((left, right) => right.count - left.count);
}

function buildSubscriptionStatusMix(orgSubscriptions: OrgSubscriptionSummary[]) {
  const statuses: Array<SubscriptionStatus | null> = ["active", "trial", "expired", "suspended", "cancelled", null];

  return statuses
    .map((status) => {
      const count = orgSubscriptions.filter((subscription) => subscription.status === status || (!status && !subscription.status)).length;
      return {
        count,
        detail: status ? "subscription rows" : "needs package assignment",
        label: status ? formatEnterpriseLabel(status) : "Unassigned",
        status
      };
    })
    .filter((item) => item.count > 0);
}

function ExecutiveMetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
              <EnterpriseStatusBadge status={metric.status} />
            </div>
            <p className="mt-4 text-3xl font-black">{metric.value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
            {metric.href ? (
              <ButtonLink className="mt-4" href={metric.href} size="sm" variant="secondary">
                Open
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </ButtonLink>
            ) : null}
          </div>
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent/20 text-foreground">{metric.icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessScoreCard({ insights, thresholds }: { insights: DashboardInsights; thresholds: DashboardThresholds }) {
  const status = readinessStatus(insights.readinessScore, thresholds);

  return (
    <div className="w-full rounded-md border border-border bg-background p-5 lg:w-72">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Readiness Score</p>
          <p className="mt-3 text-5xl font-black">{insights.readinessScore}</p>
        </div>
        <div className="grid size-12 place-items-center rounded-md bg-accent/20">
          <Gauge aria-hidden="true" className="size-6" />
        </div>
      </div>
      <ProgressBar status={status} value={insights.readinessScore} />
      <div className="mt-4 grid gap-2 text-xs font-semibold text-muted-foreground">
        <p>{formatCompactNumber(insights.criticalSecurityEvents)} critical security signals</p>
        <p>{formatCompactNumber(insights.downHealthChecks + insights.degradedHealthChecks)} component health warnings</p>
        <p>{formatCompactNumber(insights.failedBackups + insights.failedDomains)} recovery or domain failures</p>
      </div>
    </div>
  );
}

function ActionQueueItem({ item }: { item: DashboardRiskItem }) {
  return (
    <ButtonLink className="h-auto w-full justify-between px-4 py-3 text-left" href={item.href} variant="secondary">
      <span className="flex min-w-0 items-start gap-3">
        <StatusIcon status={item.status} />
        <span className="min-w-0">
          <span className="block font-black">{item.label}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">{item.detail}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-black">{formatCompactNumber(item.count)}</span>
    </ButtonLink>
  );
}

function StatusIcon({ status }: { status: EnterpriseKpi["status"] }) {
  if (status === "risk") {
    return <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-600" />;
  }

  if (status === "watch") {
    return <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />;
  }

  return <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-600" />;
}

function InlineUsage({ label, thresholds, value }: { label: string; thresholds: DashboardThresholds; value: number }) {
  const status = usageStatus(value, thresholds);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="text-xs font-black">{formatPercent(value)}</p>
      </div>
      <ProgressBar status={status} value={value} />
    </div>
  );
}

function ProgressBar({ status, value }: { status: EnterpriseKpi["status"]; value: number }) {
  return (
    <div className="mt-3 h-2 rounded-full bg-surface-muted">
      <div className={`h-full rounded-full ${progressToneClasses[status]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function ChartPanel({ actionHref, children, description, title }: { actionHref: string; children: ReactNode; description: string; title: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-2xl font-black">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <ButtonLink href={actionHref} size="sm" variant="secondary">
          Open
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ReadinessRow({
  detail,
  href,
  icon,
  label,
  status,
  value
}: {
  detail: string;
  href: string;
  icon: ReactNode;
  label: string;
  status: EnterpriseKpi["status"];
  value: string;
}) {
  return (
    <ButtonLink className="h-auto w-full justify-between px-4 py-4 text-left" href={href} variant="secondary">
      <span className="flex min-w-0 items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted">{icon}</span>
        <span className="min-w-0">
          <span className="block font-black">{label}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">{detail}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <EnterpriseStatusBadge status={status} />
        <span className="text-xs font-black text-muted-foreground">{value}</span>
      </span>
    </ButtonLink>
  );
}

function EmptyState({ actionHref, actionLabel, text }: { actionHref?: string; actionLabel?: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-5">
      <p className="text-sm font-semibold text-muted-foreground">{text}</p>
      {actionHref && actionLabel ? (
        <ButtonLink className="mt-4" href={actionHref} size="sm" variant="secondary">
          {actionLabel}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      ) : null}
    </div>
  );
}

function latestBackupLabel(dashboard: EnterpriseDashboard) {
  const latestBackup = dashboard.backupJobs[0];

  if (!latestBackup) {
    return "No jobs";
  }

  if (latestBackup.recovery_point_at) {
    return formatDateTime(latestBackup.recovery_point_at);
  }

  return formatEnterpriseLabel(latestBackup.status);
}

function readinessStatus(score: number, thresholds: DashboardThresholds): EnterpriseKpi["status"] {
  if (score >= thresholds.readiness.good) {
    return "good";
  }

  if (score >= thresholds.readiness.watch) {
    return "watch";
  }

  return "risk";
}

function usageStatus(value: number, thresholds: DashboardThresholds): EnterpriseKpi["status"] {
  if (value >= thresholds.usage.risk) {
    return "risk";
  }

  if (value >= thresholds.usage.watch) {
    return "watch";
  }

  return "good";
}

function maxUsagePercent(row: { branchPercent: number; memberPercent: number; storagePercent: number }) {
  return Math.max(row.branchPercent, row.memberPercent, row.storagePercent);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatLatency(value: number | null) {
  return value === null ? "No data" : `${formatCompactNumber(value)}ms`;
}

function dashboardReturnHref(operations: SuperAdminDashboardOperations) {
  const params = new URLSearchParams({ range: operations.dateRange.key });

  if (operations.dateRange.key === "custom") {
    params.set("from", toDateInput(operations.dateRange.from));
    params.set("to", toDateInput(operations.dateRange.to));
  }

  return `/super-admin?${params.toString()}`;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isInSelectedRange(value: string | null | undefined, operations: SuperAdminDashboardOperations) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time >= operations.dateRange.from.getTime() && time <= operations.dateRange.to.getTime();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined
  }).format(date);
}
