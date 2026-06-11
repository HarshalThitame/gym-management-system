import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Dumbbell,
  Gauge,
  Globe2,
  MessageSquare,
  Palette,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  UsersRound
} from "lucide-react";
import type { ReactNode } from "react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { OrganizationOwnerModule } from "@/features/organization-owner/lib/organization-owner-modules";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { cn } from "@/lib/utils";

type OrganizationOwnerWorkspaceProps = {
  dashboard: OrganizationOwnerDashboard;
  module?: OrganizationOwnerModule;
  planContext?: OrgPlanContext | null;
};

const packageClasses: Record<string, string> = {
  lite: "border-slate-200 bg-slate-50 text-slate-700",
  standard: "border-indigo-200 bg-indigo-50 text-indigo-700",
  premium: "border-amber-200 bg-amber-50 text-amber-800"
};

export function OrganizationOwnerWorkspace({ dashboard, module, planContext }: OrganizationOwnerWorkspaceProps) {
  if (module) {
    return (
      <div className="space-y-8">
        <ModuleHero dashboard={dashboard} module={module} />
        <ModuleContent dashboard={dashboard} module={module} planContext={planContext} />
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
      <section className="rounded-lg border border-border bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organization Owner Portal</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">{dashboard.organization.name}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Gym records owned by this organization" icon={<Building2 className="size-5" />} label="Total Gyms" value={formatCompactNumber(dashboard.gyms.length)} />
        <StatCard detail="Physical locations in organization scope" icon={<Building2 className="size-5" />} label="Total Branches" value={formatCompactNumber(dashboard.branches.length)} />
        <StatCard detail={`${dashboard.branchUsers.length} total branch-user assignments`} icon={<UsersRound className="size-5" />} label="Total Staff" value={formatCompactNumber(staffCount)} />
        <StatCard detail={`${dashboard.trainers.filter((trainer) => trainer.status === "active").length} active trainers`} icon={<Dumbbell className="size-5" />} label="Total Trainers" value={formatCompactNumber(dashboard.trainers.length)} />
        <StatCard detail="Active member profiles from owned gyms" icon={<UsersRound className="size-5" />} label="Total Members" value={formatCompactNumber(dashboard.metrics.activeMembers)} />
        <StatCard detail="Memberships currently active in owned gyms" icon={<Tags className="size-5" />} label="Active Memberships" value={formatCompactNumber(activeMemberships)} />
        <StatCard detail="Active memberships ending in the next 30 days" icon={<AlertTriangle className="size-5" />} label="Expiring Memberships" value={formatCompactNumber(expiringMemberships)} />
        <StatCard detail="Revenue from branch metric snapshots" icon={<CreditCard className="size-5" />} label="Revenue" value={formatCurrency(dashboard.metrics.totalRevenue)} />
        <StatCard detail="Attendance count from branch metrics" icon={<Activity className="size-5" />} label="Attendance" value={formatCompactNumber(dashboard.metrics.totalAttendance)} />
        <StatCard detail="Active member growth estimate for this month" icon={<BarChart3 className="size-5" />} label="Growth Metrics" value={`${memberGrowthPercent}%`} />
        <StatCard detail={`${unreadNotifications} unread notifications in owned gyms`} icon={<MessageSquare className="size-5" />} label="Notifications" value={formatCompactNumber(dashboard.notifications.length)} />
        <StatCard detail="Open or investigating security records" icon={<ShieldCheck className="size-5" />} label="Security Alerts" value={formatCompactNumber(dashboard.metrics.openSecurityEvents)} />
      </section>

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
                  <item.icon aria-hidden="true" className="size-4 shrink-0" />
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
            <StackedList
              empty="No branch metric snapshots are available yet."
              items={topBranches.map((metric) => ({
                id: metric.id,
                title: branchName(dashboard, metric.branch_id),
                meta: `${formatCurrency(Number(metric.revenue_amount ?? 0))} revenue · ${formatCompactNumber(Number(metric.active_members ?? 0))} active members`,
                badge: metric.metric_date
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            <StackedList
              empty="No organization activity has been recorded yet."
              items={recentActivity.map((event) => ({
                id: event.id,
                title: formatEnterpriseLabel(event.event_type),
                meta: `${formatEnterpriseLabel(event.entity_type)} · ${formatDate(event.created_at)}`,
                badge: event.severity ?? "info"
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Security Alerts</h2>
          </CardHeader>
          <CardContent>
            <StackedList
              empty="No open organization security alerts."
              items={alerts.map((event) => ({
                id: event.id,
                title: formatEnterpriseLabel(event.event_type),
                meta: event.description ?? `Recorded ${formatDate(event.created_at)}`,
                badge: event.severity
              }))}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ModuleHero({ dashboard, module }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{dashboard.organization.name}</p>
          <h2 className="mt-3 text-3xl font-black md:text-4xl">{module.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{module.description}</p>
        </div>
        <module.icon aria-hidden="true" className="size-10 text-accent" />
      </div>
    </section>
  );
}

function ModuleContent({ dashboard, module, planContext }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule; planContext?: OrgPlanContext | null | undefined }) {
  switch (module.slug) {
    case "gyms":
      return <GymsModule dashboard={dashboard} planContext={planContext} />;
    case "staff":
      return <StaffModule dashboard={dashboard} />;
    case "members":
      return <MembersModule dashboard={dashboard} />;
    case "memberships":
      return <MembershipsModule dashboard={dashboard} />;
    case "revenue":
      return <RevenueModule dashboard={dashboard} />;
    case "trainers":
      return <TrainersModule dashboard={dashboard} />;
    case "attendance":
      return <AttendanceModule dashboard={dashboard} />;
    case "classes":
      return planContext?.features.classSchedulingEnabled ? (
        <ClassesModule dashboard={dashboard} />
      ) : (
        <FeatureLocked
          description="Class scheduling, capacity, bookings, and utilization are available on Standard and higher plans."
          featureName="Class Scheduling"
          requiredPlan="Standard"
        />
      );
    case "communications":
      return planContext?.features.communicationsEnabled ? (
        <CommunicationsModule dashboard={dashboard} />
      ) : (
        <FeatureLocked
          description="Campaigns, announcements, and bulk communication analytics are available on Standard and higher plans."
          featureName="Communications"
          requiredPlan="Standard"
        />
      );
    case "analytics":
      return <AnalyticsModule dashboard={dashboard} />;
    case "branding":
      return <BrandingModule dashboard={dashboard} />;
    case "domains":
      return planContext?.features.customDomainEnabled ? (
        <DomainsModule dashboard={dashboard} />
      ) : (
        <FeatureLocked
          description="Custom tenant domains, DNS verification, and SSL status monitoring are available on Premium."
          featureName="Custom Domains"
          requiredPlan="Premium"
        />
      );
    case "billing":
      return <BillingModule dashboard={dashboard} />;
    case "settings":
      return <SettingsModule dashboard={dashboard} />;
    case "security":
      return <SecurityModule dashboard={dashboard} />;
    default:
      return null;
  }
}

function GymsModule({ dashboard, planContext }: { dashboard: OrganizationOwnerDashboard; planContext?: OrgPlanContext | null | undefined }) {
  const branchLimitReached = Boolean(
    planContext && planContext.features.maxBranches !== -1 && dashboard.branches.length >= planContext.features.maxBranches
  );

  return (
    <div className="space-y-6">
      {branchLimitReached ? (
        <FeatureLocked
          description={`Your current plan allows ${planContext?.features.maxBranches ?? 0} branch${planContext?.features.maxBranches === 1 ? "" : "es"}. Upgrade to add more locations.`}
          featureName="Additional Branch"
          requiredPlan="Premium"
        />
      ) : null}
      <SectionGrid
        cards={[
          statCard("Gyms", dashboard.gyms.length, "Gym records assigned to this organization", <Building2 className="size-5" />),
          statCard("Branches", dashboard.branches.length, "Physical branches under this tenant", <Building2 className="size-5" />),
          statCard("Capacity", dashboard.branches.reduce((total, branch) => total + Number(branch.capacity ?? 0), 0), "Total configured branch capacity", <Gauge className="size-5" />),
          statCard("Active Branches", dashboard.branches.filter((branch) => branch.status === "active").length, "Open and active branch locations", <Activity className="size-5" />)
        ]}
        listTitle="Branches"
        rows={dashboard.branches.map((branch) => ({
          id: branch.id,
          title: branch.name,
          meta: `${branch.branch_code} · ${[branch.city, branch.state, branch.country].filter(Boolean).join(", ")}`,
          badge: branch.status
        }))}
      />
    </div>
  );
}

function StaffModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Staff Assignments", dashboard.branchUsers.length, "Branch user rows in organization scope", <UsersRound className="size-5" />),
        statCard("Gym Admins", dashboard.branchUsers.filter((user) => user.role_name === "gym_admin").length, "Operational admins", <ShieldCheck className="size-5" />),
        statCard("Reception", dashboard.branchUsers.filter((user) => user.role_name === "reception_staff").length, "Front desk staff", <UsersRound className="size-5" />),
        statCard("Organization Scope", dashboard.branchUsers.filter((user) => user.access_scope === "organization").length, "Users with organization-wide assignment", <Globe2 className="size-5" />)
      ]}
      listTitle="Recent Staff Access"
      rows={dashboard.branchUsers.slice(0, 12).map((user) => ({
        id: user.id,
        title: formatEnterpriseLabel(user.role_name),
        meta: `${formatEnterpriseLabel(user.branch_role)} · ${branchName(dashboard, user.branch_id)} · ${formatEnterpriseLabel(user.access_scope)}`,
        badge: user.status
      }))}
    />
  );
}

function MembersModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Members", dashboard.members.length, "Loaded member records in owned gyms", <UsersRound className="size-5" />),
        statCard("Active", dashboard.members.filter((member) => member.status === "active").length, "Active member profiles", <Activity className="size-5" />),
        statCard("Archived", dashboard.members.filter((member) => member.status === "archived").length, "Archived member profiles", <AlertTriangle className="size-5" />),
        statCard("Assigned Trainers", dashboard.members.filter((member) => member.assigned_trainer_id).length, "Members with trainer assignment", <Dumbbell className="size-5" />)
      ]}
      listTitle="Recent Members"
      rows={dashboard.members.slice(0, 12).map((member) => ({
        id: member.id,
        title: member.full_name,
        meta: `${member.member_code} · ${member.phone} · joined ${formatDate(member.joined_at)}`,
        badge: member.status
      }))}
    />
  );
}

function MembershipsModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Plans", dashboard.membershipPlans.length, "Membership plans across owned gyms", <Tags className="size-5" />),
        statCard("Active Plans", dashboard.membershipPlans.filter((plan) => plan.status === "active").length, "Published active plans", <Activity className="size-5" />),
        statCard("Memberships", dashboard.memberships.length, "Recent membership lifecycle records", <UsersRound className="size-5" />),
        statCard("Active Memberships", dashboard.memberships.filter((membership) => membership.status === "active").length, "Currently active memberships", <CalendarCheck className="size-5" />)
      ]}
      listTitle="Membership Plans"
      rows={dashboard.membershipPlans.slice(0, 12).map((plan) => ({
        id: plan.id,
        title: plan.name,
        meta: `${formatEnterpriseLabel(plan.plan_type)} · ${formatCurrency(Number(plan.price_amount ?? 0), plan.currency)} · ${formatEnterpriseLabel(plan.access_level)}`,
        badge: plan.status
      }))}
    />
  );
}

function RevenueModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const paid = dashboard.payments.filter((payment) => payment.status === "paid");
  return (
    <SectionGrid
      cards={[
        statCard("Collected", formatCurrency(paid.reduce((total, payment) => total + Number(payment.amount ?? 0), 0)), "Paid payment rows from owned gyms", <CreditCard className="size-5" />),
        statCard("Paid Payments", paid.length, "Verified paid payments", <ReceiptText className="size-5" />),
        statCard("Failed Payments", dashboard.metrics.failedPayments, "Failed payment attempts requiring review", <AlertTriangle className="size-5" />),
        statCard("Branch Metric Revenue", formatCurrency(dashboard.metrics.totalRevenue), "Latest revenue metric snapshots", <BarChart3 className="size-5" />)
      ]}
      listTitle="Recent Payments"
      rows={dashboard.payments.slice(0, 12).map((payment) => ({
        id: payment.id,
        title: payment.payment_number,
        meta: `${formatCurrency(Number(payment.amount ?? 0), payment.currency)} · ${formatEnterpriseLabel(payment.payment_type)} · ${formatEnterpriseLabel(payment.method)}`,
        badge: payment.status
      }))}
    />
  );
}

function TrainersModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Trainers", dashboard.trainers.length, "Trainer profiles in owned gyms", <Dumbbell className="size-5" />),
        statCard("Active", dashboard.trainers.filter((trainer) => trainer.status === "active").length, "Active trainers", <Activity className="size-5" />),
        statCard("On Leave", dashboard.trainers.filter((trainer) => trainer.status === "on_leave").length, "Unavailable trainers", <CalendarDays className="size-5" />),
        statCard("Avg Utilization", `${dashboard.metrics.avgTrainerUtilization}%`, "Average from branch metric snapshots", <Gauge className="size-5" />)
      ]}
      listTitle="Trainer Roster"
      rows={dashboard.trainers.slice(0, 12).map((trainer) => ({
        id: trainer.id,
        title: trainer.display_name,
        meta: `${trainer.employee_code} · ${formatEnterpriseLabel(trainer.employment_type)} · ${trainer.years_experience} years`,
        badge: trainer.status
      }))}
    />
  );
}

function AttendanceModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Attendance Logs", dashboard.attendanceLogs.length, "Recent check-in and access records", <CalendarCheck className="size-5" />),
        statCard("Successful", dashboard.attendanceLogs.filter((log) => log.result === "success").length, "Successful access events", <Activity className="size-5" />),
        statCard("Denied", dashboard.attendanceLogs.filter((log) => log.result === "denied").length, "Denied access events", <AlertTriangle className="size-5" />),
        statCard("Metric Attendance", dashboard.metrics.totalAttendance, "Attendance count from branch metrics", <BarChart3 className="size-5" />)
      ]}
      listTitle="Recent Attendance"
      rows={dashboard.attendanceLogs.slice(0, 12).map((log) => ({
        id: log.id,
        title: formatEnterpriseLabel(log.action),
        meta: `${formatEnterpriseLabel(log.source)} · ${log.message} · ${formatDate(log.occurred_at)}`,
        badge: log.result
      }))}
    />
  );
}

function ClassesModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Class Sessions", dashboard.classSessions.length, "Recent scheduled class sessions", <CalendarDays className="size-5" />),
        statCard("Scheduled", dashboard.classSessions.filter((session) => session.status === "scheduled").length, "Upcoming scheduled sessions", <CalendarCheck className="size-5" />),
        statCard("Booked Seats", dashboard.classSessions.reduce((total, session) => total + Number(session.booked_count ?? 0), 0), "Booked seats in listed sessions", <UsersRound className="size-5" />),
        statCard("Waitlist", dashboard.classSessions.reduce((total, session) => total + Number(session.waitlist_count ?? 0), 0), "Waitlisted class requests", <AlertTriangle className="size-5" />)
      ]}
      listTitle="Recent Class Sessions"
      rows={dashboard.classSessions.slice(0, 12).map((session) => ({
        id: session.id,
        title: `${session.session_date} · ${session.starts_at.slice(0, 5)}-${session.ends_at.slice(0, 5)}`,
        meta: `${session.booked_count}/${session.capacity} booked · ${session.location ?? "No location set"}`,
        badge: session.status
      }))}
    />
  );
}

function CommunicationsModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Notifications", dashboard.notifications.length, "Recent in-app notifications", <MessageSquare className="size-5" />),
        statCard("Unread", dashboard.notifications.filter((notification) => notification.status === "unread").length, "Unread notifications", <AlertTriangle className="size-5" />),
        statCard("Campaigns", dashboard.campaigns.length, "Recent campaigns", <MessageSquare className="size-5" />),
        statCard("Running", dashboard.campaigns.filter((campaign) => campaign.status === "running" || campaign.status === "scheduled").length, "Scheduled or running campaigns", <Activity className="size-5" />)
      ]}
      listTitle="Recent Campaigns"
      rows={dashboard.campaigns.slice(0, 12).map((campaign) => ({
        id: campaign.id,
        title: campaign.name,
        meta: `${formatEnterpriseLabel(campaign.campaign_type)} · ${formatEnterpriseLabel(campaign.category)} · ${campaign.segment_key}`,
        badge: campaign.status
      }))}
    />
  );
}

function AnalyticsModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Metric Snapshots", dashboard.branchMetrics.length, "Branch metric rows loaded", <BarChart3 className="size-5" />),
        statCard("Storage", `${formatCompactNumber(dashboard.metrics.storageMb)} MB`, "Storage usage from branch metrics", <Gauge className="size-5" />),
        statCard("Trainer Utilization", `${dashboard.metrics.avgTrainerUtilization}%`, "Average utilization", <Dumbbell className="size-5" />),
        statCard("Class Utilization", `${dashboard.metrics.avgClassUtilization}%`, "Average utilization", <CalendarDays className="size-5" />)
      ]}
      listTitle="Latest Branch Metrics"
      rows={dashboard.branchMetrics.slice(0, 12).map((metric) => ({
        id: metric.id,
        title: branchName(dashboard, metric.branch_id),
        meta: `${formatDate(metric.metric_date)} · ${formatCurrency(Number(metric.revenue_amount ?? 0))} · ${metric.attendance_count} visits`,
        badge: `${metric.trainer_utilization}% trainers`
      }))}
    />
  );
}

function BrandingModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Tenant Brands", dashboard.tenantConfigs.length, "White-label profiles", <Palette className="size-5" />),
        statCard("Verified Branding", dashboard.tenantConfigs.filter((config) => config.domain_status === "verified").length, "Verified domain branding configs", <ShieldCheck className="size-5" />),
        statCard("Custom Domains", dashboard.tenantDomains.filter((domain) => domain.domain_type === "custom_domain").length, "Custom tenant domains", <Globe2 className="size-5" />),
        statCard("Feature Overrides", dashboard.featureFlags.length, "Feature flag overrides in scope", <Settings className="size-5" />)
      ]}
      listTitle="Brand Profiles"
      rows={dashboard.tenantConfigs.map((config) => ({
        id: config.id,
        title: config.brand_name,
        meta: `${config.tenant_key} · ${config.custom_domain ?? config.subdomain ?? "No domain configured"} · ${colorsText(config.primary_color, config.secondary_color, config.accent_color)}`,
        badge: config.status
      }))}
    />
  );
}

function DomainsModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Domains", dashboard.tenantDomains.length, "Tenant domains in organization scope", <Globe2 className="size-5" />),
        statCard("Verified", dashboard.tenantDomains.filter((domain) => domain.status === "verified").length, "Verified routing domains", <ShieldCheck className="size-5" />),
        statCard("Primary", dashboard.tenantDomains.filter((domain) => domain.is_primary).length, "Primary domains", <Gauge className="size-5" />),
        statCard("Provider Events", dashboard.tenantDomainProviderEvents.length, "Recent domain provider operations", <Activity className="size-5" />)
      ]}
      listTitle="Domain Registry"
      rows={dashboard.tenantDomains.map((domain) => ({
        id: domain.id,
        title: domain.domain,
        meta: `${formatEnterpriseLabel(domain.domain_type)} · ${formatEnterpriseLabel(domain.routing_mode)} · SSL ${formatEnterpriseLabel(domain.ssl_status)}`,
        badge: domain.status
      }))}
    />
  );
}

function BillingModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Subscriptions", dashboard.subscriptions.length, "SaaS billing records", <ReceiptText className="size-5" />),
        statCard("Active", dashboard.metrics.activeSubscriptions, "Active or trial subscriptions", <CreditCard className="size-5" />),
        statCard("Paid Payments", dashboard.metrics.paidPayments, "Gym payment records in owned gyms", <CreditCard className="size-5" />),
        statCard("Usage Storage", `${formatCompactNumber(dashboard.metrics.storageMb)} MB`, "Storage tracked in branch metrics", <Gauge className="size-5" />)
      ]}
      listTitle="SaaS Subscriptions"
      rows={dashboard.subscriptions.map((subscription) => ({
        id: subscription.id,
        title: formatEnterpriseLabel(subscription.plan_tier),
        meta: `Renews ${subscription.renews_on ? formatDate(subscription.renews_on) : "not scheduled"} · starts ${formatDate(subscription.starts_on)}`,
        badge: subscription.status
      }))}
    />
  );
}

function SettingsModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <SectionGrid
      cards={[
        statCard("Branch Settings", dashboard.branchSettings.length, "Settings records for branches", <Settings className="size-5" />),
        statCard("Feature Flags", dashboard.featureFlags.length, "Organization feature controls", <Gauge className="size-5" />),
        statCard("Compliance Requests", dashboard.complianceRequests.length, "Privacy and compliance workflow records", <ShieldCheck className="size-5" />),
        statCard("Tenant Configs", dashboard.tenantConfigs.length, "Brand and tenant configuration records", <Palette className="size-5" />)
      ]}
      listTitle="Feature Flags"
      rows={dashboard.featureFlags.map((flag) => ({
        id: flag.id,
        title: flag.name,
        meta: `${flag.flag_key} · ${flag.enabled ? "enabled" : "disabled"} · rollout ${flag.rollout_percentage}%`,
        badge: flag.status
      }))}
    />
  );
}

function SecurityModule({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Security Events</h3>
        </CardHeader>
        <CardContent>
          <StackedList
            empty="No security events are available for this organization."
            items={dashboard.securityEvents.slice(0, 14).map((event) => ({
              id: event.id,
              title: formatEnterpriseLabel(event.event_type),
              meta: event.description ?? `Recorded ${formatDate(event.created_at)}`,
              badge: event.severity
            }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Audit Activity</h3>
        </CardHeader>
        <CardContent>
          <StackedList
            empty="No activity events are available for this organization."
            items={dashboard.activityEvents.slice(0, 14).map((event) => ({
              id: event.id,
              title: formatEnterpriseLabel(event.event_type),
              meta: `${formatEnterpriseLabel(event.entity_type)} · ${formatDate(event.created_at)}`,
              badge: event.severity ?? "info"
            }))}
          />
        </CardContent>
      </Card>
    </section>
  );
}

type SectionCard = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

type ListRow = {
  id: string;
  title: string;
  meta: string;
  badge?: string | null;
};

function SectionGrid({ cards, listTitle, rows }: { cards: SectionCard[]; listTitle: string; rows: ListRow[] }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard detail={card.detail} icon={card.icon} key={card.label} label={card.label} value={card.value} />
        ))}
      </section>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">{listTitle}</h3>
        </CardHeader>
        <CardContent>
          <StackedList empty={`No ${listTitle.toLowerCase()} records are available yet.`} items={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function StackedList({ empty, items }: { empty: string; items: ListRow[] }) {
  if (items.length === 0) {
    return <p className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
          <div>
            <p className="text-sm font-black">{item.title}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{item.meta}</p>
          </div>
          {item.badge ? <EnterpriseStatusBadge status={item.badge} /> : null}
        </div>
      ))}
    </div>
  );
}

function statCard(label: string, value: number | string, detail: string, icon: ReactNode): SectionCard {
  return {
    label,
    value: typeof value === "number" ? formatCompactNumber(value) : value,
    detail,
    icon
  };
}

function PackageBadge({ packageName }: { packageName: string }) {
  const normalizedName = packageName.toLowerCase();

  return (
    <Badge className={cn(packageClasses[normalizedName] ?? "border-border bg-surface-muted text-muted-foreground")}>
      {packageName}
    </Badge>
  );
}

function branchName(dashboard: OrganizationOwnerDashboard, branchId: string | null) {
  return dashboard.branches.find((branch) => branch.id === branchId)?.name ?? "Organization branch";
}

function colorsText(primary: string, secondary: string, accent: string) {
  return [primary, secondary, accent].filter(Boolean).join(" / ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function isExpiringSoon(value: string | null) {
  if (!value) {
    return false;
  }

  const expiryTime = new Date(value).getTime();
  if (Number.isNaN(expiryTime)) {
    return false;
  }

  const now = Date.now();
  const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
  return expiryTime >= now && expiryTime <= thirtyDaysFromNow;
}

function isThisMonth(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}
