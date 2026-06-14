import { Activity, AlertTriangle, BarChart3, Building2, CreditCard, Dumbbell, Gauge, Globe2, MessageSquare, ShieldCheck, Tags, TrendingUp, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { DashboardCharts } from "@/features/organization-owner/components/org-owner-dashboard-charts";
import { CustomizableDashboard } from "@/features/organization-owner/components/customizable-dashboard";
import { AuditTrailViewer } from "@/features/organization-owner/components/audit-trail-viewer";
import { LanguageSwitcher } from "@/features/organization-owner/components/language-switcher";
import { ThemePreview } from "@/features/organization-owner/components/modules/ThemePreview";
import { AnalyticsIntelligence } from "@/features/organization-owner/components/analytics/advanced-analytics";
import { GymsModule } from "@/features/organization-owner/components/modules/GymsModule";
import { StaffModule } from "@/features/organization-owner/components/modules/StaffModule";
import { MembersModule } from "@/features/organization-owner/components/modules/MembersModule";
import { MembershipsModule } from "@/features/organization-owner/components/modules/MembershipsModule";
import { RevenueEnterpriseModule } from "@/features/organization-owner/components/modules/RevenueModule";
import { TrainersEnterpriseModule } from "@/features/organization-owner/components/modules/TrainersModule";
import { AttendanceEnterpriseModule } from "@/features/organization-owner/components/modules/AttendanceModule";
import { ClassesEnterpriseModule } from "@/features/organization-owner/components/modules/ClassesModule";
import { CommunicationsEnterpriseModule } from "@/features/organization-owner/components/modules/CommunicationsModule";
import { AnalyticsEnterpriseModule } from "@/features/organization-owner/components/modules/AnalyticsModule";
import { BrandingEnterpriseModule } from "@/features/organization-owner/components/modules/BrandingModule";
import { DomainsEnterpriseModule } from "@/features/organization-owner/components/modules/DomainsModule";
import { BillingEnterpriseModule } from "@/features/organization-owner/components/modules/BillingModule";
import { NutritionEnterpriseModule } from "@/features/organization-owner/components/modules/NutritionModule";
import { SupportEnterpriseModule } from "@/features/organization-owner/components/modules/SupportModule";
import { ProfileEnterpriseModule } from "@/features/organization-owner/components/modules/ProfileModule";
import { SettingsEnterpriseModule } from "@/features/organization-owner/components/modules/SettingsModule";
import { SecurityEnterpriseModule } from "@/features/organization-owner/components/modules/SecurityModule";
import type { OrganizationOwnerModule } from "@/features/organization-owner/lib/organization-owner-modules";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { cn } from "@/lib/utils";

type OrganizationOwnerWorkspaceProps = {
  dashboard: OrganizationOwnerDashboard;
  module?: OrganizationOwnerModule | undefined;
  moduleData?: unknown | undefined;
  moduleFilters?: ModuleSearchParams | undefined;
  planContext?: OrgPlanContext | null | undefined;
};

const packageClasses: Record<string, string> = {
  lite: "border-slate-200 bg-slate-50 text-slate-700",
  standard: "border-indigo-200 bg-indigo-50 text-indigo-700",
  premium: "border-amber-200 bg-amber-50 text-amber-800"
};

export function OrganizationOwnerWorkspace({ dashboard, module, moduleData, moduleFilters, planContext }: OrganizationOwnerWorkspaceProps) {
  if (module) {
    return (
      <div className="space-y-8">
        <ModuleHero dashboard={dashboard} module={module} />
        <ModuleContent dashboard={dashboard} module={module} moduleData={moduleData} moduleFilters={moduleFilters} planContext={planContext} />
      </div>
    );
  }

  return <OrganizationOwnerDashboardView dashboard={dashboard} planContext={planContext} />;
}

function OrganizationOwnerDashboardView({ dashboard, planContext }: { dashboard: OrganizationOwnerDashboard; planContext?: OrgPlanContext | null | undefined }) {
  const activeMemberships = dashboard.memberships.filter((membership) => membership.status === "active").length;
  const expiringMemberships = dashboard.memberships.filter((membership) => isExpiringSoon(membership.end_date)).length;
  const staffCount = dashboard.branchUsers.filter((user) => user.role_name !== "member" && user.role_name !== "trainer").length;
  const previousMemberBaseline = Math.max(dashboard.metrics.activeMembers - dashboard.members.filter((member) => isThisMonth(member.joined_at)).length, 0);
  const memberGrowthPercent = previousMemberBaseline > 0
    ? Math.round(((dashboard.metrics.activeMembers - previousMemberBaseline) / previousMemberBaseline) * 100)
    : dashboard.metrics.activeMembers > 0 ? 100 : 0;
  const topBranches = [...dashboard.branchMetrics]
    .sort((a, b) => Number(b.revenue_amount ?? 0) - Number(a.revenue_amount ?? 0))
    .slice(0, 5);
  const recentActivity = dashboard.activityEvents.slice(0, 5);
  const alerts = dashboard.securityEvents.filter((event) => event.status === "open" || event.status === "investigating").slice(0, 5);
  const unreadNotifications = dashboard.notifications.filter((notification) => notification.status === "unread").length;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:text-xs md:tracking-[0.14em]">Organization Owner Portal</p>
            <h2 className="mt-2 text-2xl font-black md:mt-3 md:text-3xl lg:text-4xl">{dashboard.organization.name}</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground md:mt-3 md:text-sm md:leading-6">
              Tenant-safe command center for your organization, gyms, staff, members, revenue, domains, and audit activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EnterpriseStatusBadge status={dashboard.organization.status} />
            <EnterpriseStatusBadge status={dashboard.organization.organization_type} />
            {planContext ? <PackageBadge packageName={planContext.packageName} /> : null}
            {planContext ? <ButtonLink href="/organization/plan" size="sm" variant="secondary">Manage Plan</ButtonLink> : null}
          </div>
        </div>
      </section>

      <CustomizableDashboard dashboard={dashboard} />

      <DashboardCharts dashboard={dashboard} />

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organization Modules</p>
            <h2 className="text-2xl font-black">Owner Workspaces</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {organizationOwnerModules.map((item) => (
                <ButtonLink className="justify-start text-left" href={item.href} key={item.slug} variant="secondary">
                  {item.icon}
                  {item.label}
                </ButtonLink>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Top Branch Performance</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topBranches.length === 0 ? (
                <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No branch metric snapshots are available yet.</p>
              ) : topBranches.map((metric) => {
                const branch = dashboard.branches.find((b) => b.id === metric.branch_id);
                return (
                  <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between" key={metric.id}>
                    <div>
                      <p className="text-sm font-black">{branch?.name ?? "Organization branch"}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {formatCurrency(Number(metric.revenue_amount ?? 0))} revenue · {formatCompactNumber(Number(metric.active_members ?? 0))} active members
                      </p>
                    </div>
                    <EnterpriseStatusBadge status={metric.metric_date} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No organization activity has been recorded yet.</p>
              ) : recentActivity.map((event) => (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between" key={event.id}>
                  <div>
                    <p className="text-sm font-black">{formatEnterpriseLabel(event.event_type)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {formatEnterpriseLabel(event.entity_type)} · {new Date(event.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <EnterpriseStatusBadge status={event.severity ?? "info"} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Security Alerts</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No open organization security alerts.</p>
              ) : alerts.map((event) => (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between" key={event.id}>
                  <div>
                    <p className="text-sm font-black">{formatEnterpriseLabel(event.event_type)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{event.description ?? `Recorded ${new Date(event.created_at).toLocaleDateString("en-IN")}`}</p>
                  </div>
                  <EnterpriseStatusBadge status={event.severity} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ModuleHero({ dashboard, module }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:text-xs md:tracking-[0.14em]">{dashboard.organization.name}</p>
          <h2 className="mt-2 text-xl font-black md:mt-3 md:text-3xl lg:text-4xl">{module.title}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground md:mt-3 md:text-sm md:leading-6">{module.description}</p>
        </div>
        <span className="hidden size-10 text-accent md:block [&>svg]:size-full" aria-hidden="true">{module.icon}</span>
      </div>
    </section>
  );
}

function ModuleContent({ dashboard, module, moduleData, moduleFilters, planContext }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule; moduleData?: unknown | undefined; moduleFilters?: ModuleSearchParams | undefined; planContext?: OrgPlanContext | null | undefined }) {
  const common = { dashboard, moduleData, moduleFilters };
  switch (module.slug) {
    case "gyms": return <GymsModule dashboard={dashboard} />;
    case "staff": return <StaffModule dashboard={dashboard} />;
    case "members": return <MembersModule dashboard={dashboard} />;
    case "memberships": return <MembershipsModule dashboard={dashboard} />;
    case "revenue": return <RevenueEnterpriseModule dashboard={dashboard} />;
    case "trainers": return <TrainersEnterpriseModule dashboard={dashboard} />;
    case "attendance": return <AttendanceEnterpriseModule dashboard={dashboard} />;
    case "classes": return planContext?.features.classSchedulingEnabled ? <ClassesEnterpriseModule dashboard={dashboard} /> : <FeatureLocked description="Class scheduling is available on Standard and higher plans." featureName="Class Scheduling" requiredPlan="Standard" />;
    case "communications": return planContext?.features.communicationsEnabled ? <CommunicationsEnterpriseModule dashboard={dashboard} /> : <FeatureLocked description="Communications are available on Standard and higher plans." featureName="Communications" requiredPlan="Standard" />;
    case "analytics": return <AnalyticsEnterpriseModule dashboard={dashboard} />;
    case "branding": return <BrandingEnterpriseModule dashboard={dashboard} />;
    case "domains": return planContext?.features.customDomainEnabled ? <DomainsEnterpriseModule dashboard={dashboard} /> : <FeatureLocked description="Custom domains are available on Premium." featureName="Custom Domains" requiredPlan="Premium" />;
    case "billing": return <BillingEnterpriseModule dashboard={dashboard} />;
    case "nutrition": return <NutritionEnterpriseModule dashboard={dashboard} />;
    case "support": return <SupportEnterpriseModule dashboard={dashboard} />;
    case "profile": return <ProfileEnterpriseModule dashboard={dashboard} />;
    case "settings": return <SettingsEnterpriseModule dashboard={dashboard} />;
    case "security": return <SecurityEnterpriseModule dashboard={dashboard} />;
    default: return null;
  }
}

function PackageBadge({ packageName }: { packageName: string }) {
  const normalizedName = packageName.toLowerCase();

  return (
    <Badge className={cn(packageClasses[normalizedName] ?? "border-border bg-surface-muted text-muted-foreground")}>
      {packageName}
    </Badge>
  );
}

function isExpiringSoon(value: string | null) {
  if (!value) return false;
  const expiryTime = new Date(value).getTime();
  if (Number.isNaN(expiryTime)) return false;
  const now = Date.now();
  const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
  return expiryTime >= now && expiryTime <= thirtyDaysFromNow;
}

function isThisMonth(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}
