import type { Metadata } from "next";
import { Activity, Building2, CreditCard, DatabaseBackup, Dumbbell, Landmark, ShieldCheck, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import { getEnterpriseDashboard, latestHealthByComponent } from "@/features/enterprise/services/enterprise-service";
import { superAdminModules } from "@/features/super-admin/lib/super-admin-modules";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Super Admin Console",
  description: "Global SaaS command center for organizations, gyms, subscriptions, security, monitoring, and platform governance.",
  path: "/super-admin"
});

export default async function SuperAdminDashboardPage() {
  const dashboard = await getEnterpriseDashboard();
  const activeSubscriptions = dashboard.subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trial").length;
  const expiredSubscriptions = dashboard.subscriptions.filter((subscription) => subscription.status === "past_due" || subscription.status === "cancelled" || subscription.status === "suspended").length;
  const monthlyRevenue = dashboard.branchLatestMetrics.reduce((total, row) => total + Number(row.revenue_amount ?? 0), 0);
  const annualRevenue = dashboard.branchMetrics.reduce((total, row) => {
    const metricYear = new Date(row.metric_date).getFullYear();
    return metricYear === new Date().getFullYear() ? total + Number(row.revenue_amount ?? 0) : total;
  }, 0);
  const activeMembers = dashboard.branchLatestMetrics.reduce((total, row) => total + Number(row.active_members ?? 0), 0);
  const totalStaff = dashboard.branchUsers.length;
  const totalTrainers = dashboard.branchUsers.filter((user) => user.role_name === "trainer").length;
  const recentHealth = latestHealthByComponent(dashboard.healthChecks).slice(0, 8);
  const openAlerts = dashboard.securityEvents.filter((event) => event.status === "open" || event.status === "investigating").slice(0, 5);
  const recentActivity = dashboard.activityEvents.slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Tenant organizations in platform scope" icon={<Landmark className="size-5" />} label="Total Organizations" value={formatCompactNumber(dashboard.organizations.length)} />
        <StatCard detail="Gym records across tenant organizations" icon={<Building2 className="size-5" />} label="Total Gyms" value={formatCompactNumber(dashboard.gyms.length)} />
        <StatCard detail="Branch records across all tenants" icon={<Activity className="size-5" />} label="Total Branches" value={formatCompactNumber(dashboard.branches.length)} />
        <StatCard detail="Branch user assignments across tenants" icon={<UsersRound className="size-5" />} label="Total Staff" value={formatCompactNumber(totalStaff)} />
        <StatCard detail="Trainer assignments across tenants" icon={<Dumbbell className="size-5" />} label="Total Trainers" value={formatCompactNumber(totalTrainers)} />
        <StatCard detail="Latest active member snapshot from branch metrics" icon={<UsersRound className="size-5" />} label="Total Members" value={formatCompactNumber(activeMembers)} />
        <StatCard detail="Active or trial platform subscriptions" icon={<CreditCard className="size-5" />} label="Active Subscriptions" value={formatCompactNumber(activeSubscriptions)} />
        <StatCard detail="Past due, cancelled, or suspended subscriptions" icon={<CreditCard className="size-5" />} label="Expired Subscriptions" value={formatCompactNumber(expiredSubscriptions)} />
        <StatCard detail="Latest branch metric revenue snapshot" icon={<Activity className="size-5" />} label="Monthly Revenue" value={formatCurrency(monthlyRevenue)} />
        <StatCard detail="Current-year revenue from branch metric history" icon={<Activity className="size-5" />} label="Annual Revenue" value={formatCurrency(annualRevenue)} />
        <StatCard detail={`${dashboard.securityEvents.length} recent security records`} icon={<ShieldCheck className="size-5" />} label="System Alerts" value={formatCompactNumber(openAlerts.length)} />
        <StatCard detail={`${dashboard.backupJobs.length} recent backup jobs tracked`} icon={<DatabaseBackup className="size-5" />} label="Backup Jobs" value={formatCompactNumber(dashboard.backupJobs.length)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Platform Governance</p>
              <h2 className="mt-2 text-2xl font-black">Super Admin Modules</h2>
            </div>
            <ButtonLink href="/super-admin/monitoring" variant="secondary">Open Monitoring</ButtonLink>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {superAdminModules.map((module) => (
                <ButtonLink className="justify-start text-left" href={module.href} key={module.slug} variant="secondary">
                  <module.icon aria-hidden="true" className="size-4 shrink-0" />
                  {module.label}
                </ButtonLink>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Platform Health</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentHealth.length > 0 ? recentHealth.map((check) => (
              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-4" key={`${check.component}-${check.checked_at}`}>
                <div>
                  <p className="text-sm font-black">{check.component}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{check.message ?? "Latest health check"}</p>
                </div>
                <EnterpriseStatusBadge status={check.status} />
              </div>
            )) : (
              <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No health checks have been recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Recent Activity</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((event) => (
              <div className="rounded-md border border-border bg-background p-4" key={event.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">{event.event_type}</p>
                  <EnterpriseStatusBadge status={event.severity ?? "info"} />
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{event.entity_type} activity recorded for audit review.</p>
              </div>
            )) : (
              <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No recent platform activity is available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Security Alerts</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {openAlerts.length > 0 ? openAlerts.map((event) => (
              <div className="rounded-md border border-border bg-background p-4" key={event.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">{event.event_type}</p>
                  <EnterpriseStatusBadge status={event.severity} />
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{event.description ?? "Security event needs review."}</p>
              </div>
            )) : (
              <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No open or investigating security alerts.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
