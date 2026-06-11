import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  DatabaseBackup,
  FileText,
  Flag,
  Globe2,
  HeartPulse,
  LockKeyhole,
  Palette,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  BackupJobForm,
  BranchSettingsForm,
  BranchUserForm,
  ComplianceRequestForm,
  FeatureFlagForm,
  HealthCheckForm,
  SecurityEventStatusForm,
  SubscriptionForm,
  TenantConfigForm,
  TenantDomainForm
} from "@/features/enterprise/components/enterprise-forms";
import { BranchPerformanceChart, TenantUsageChart } from "@/features/enterprise/components/lazy-enterprise-charts";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { TenantDomainCenter } from "@/features/enterprise/components/tenant-domain-center";
import { buildRecoveryPointLabel, formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { latestHealthByComponent } from "@/features/enterprise/services/enterprise-service";
import { ROLE_PERMISSIONS, rolePriority } from "@/lib/rbac";
import type { EnterpriseDashboard } from "@/types/enterprise";
import { fallbackCriticalSuperAdminEmail } from "../lib/super-admin-governance-config";
import type { SuperAdminModule } from "../lib/super-admin-modules";
import { GymBranchManagementWorkspace } from "./gyms/GymBranchManagementWorkspace";
import { OrganizationManagementWorkspace } from "./organizations/OrganizationManagementWorkspace";
import type { GymBranchManagementData } from "../services/gym-branch-management-service";
import type { OrganizationManagementData } from "../services/organization-management-service";

type SuperAdminModuleWorkspaceProps = {
  superModule: SuperAdminModule;
  dashboard: EnterpriseDashboard;
  filters?: Record<string, string | string[] | undefined>;
  gymBranchManagement?: GymBranchManagementData | null;
  organizationManagement?: OrganizationManagementData | null;
  criticalSuperAdminEmail?: string;
};

type SummaryStat = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

export function SuperAdminModuleWorkspace({ superModule, dashboard, filters = {}, gymBranchManagement = null, organizationManagement = null, criticalSuperAdminEmail = fallbackCriticalSuperAdminEmail }: SuperAdminModuleWorkspaceProps) {
  const context = buildModuleContext(dashboard);
  const stats = getModuleStats(superModule.slug, dashboard, context, organizationManagement);

  return (
    <ModuleShell stats={stats} superModule={superModule}>
      {renderModuleBody(superModule, dashboard, context, filters, gymBranchManagement, organizationManagement, criticalSuperAdminEmail)}
    </ModuleShell>
  );
}

function renderModuleBody(superModule: SuperAdminModule, dashboard: EnterpriseDashboard, context: ModuleContext, filters: Record<string, string | string[] | undefined>, gymBranchManagement: GymBranchManagementData | null, organizationManagement: OrganizationManagementData | null, criticalSuperAdminEmail: string) {
  switch (superModule.slug) {
    case "organizations":
      return organizationManagement
        ? <OrganizationManagementWorkspace criticalSuperAdminEmail={criticalSuperAdminEmail} data={organizationManagement} />
        : <EmptyState text="Organization management data is not available." />;

    case "gyms":
      return gymBranchManagement
        ? <GymBranchManagementWorkspace data={gymBranchManagement} />
        : <EmptyState text="Gym and branch management data is not available." />;

    case "domains":
      return (
        <TwoColumn wideRight>
          <FormPanel description="Register tenant and branch domains before DNS verification and provider provisioning." title="Domain Onboarding">
            <TenantDomainForm branches={dashboard.branches} domains={dashboard.tenantDomains} organizations={dashboard.organizations} tenantConfigs={dashboard.tenantConfigs} />
          </FormPanel>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Domain Registry</h3>
              <p className="text-sm leading-6 text-muted-foreground">Run provider operations, verify DNS, and manage primary-domain lifecycle.</p>
            </CardHeader>
            <CardContent>
            <TenantDomainCenter checks={dashboard.tenantDomainChecks} domains={filterByStatus(dashboard.tenantDomains, filters)} providerEvents={dashboard.tenantDomainProviderEvents} />
            </CardContent>
          </Card>
        </TwoColumn>
      );

    case "subscriptions":
      return (
        <TwoColumn>
          <FormPanel description="Assign SaaS plan, subscription status, renewal dates, and tenant usage limits." title="Subscription and Licensing">
            <SubscriptionForm organizations={dashboard.organizations} subscriptions={dashboard.subscriptions} />
          </FormPanel>
          <SubscriptionLedger dashboard={dashboard} context={context} />
        </TwoColumn>
      );

    case "billing":
      return (
        <TwoColumn>
          <SubscriptionLedger dashboard={dashboard} context={context} />
          <RecordPanel
            description="Revenue snapshots from the enterprise tenant usage view."
            emptyText="No revenue usage rows are available."
            items={dashboard.tenantUsage}
            title="Tenant Revenue"
            renderItem={(tenant) => (
              <RecordCard
                badges={[tenant.plan_tier ?? "unassigned", tenant.organization_status ?? "unknown"]}
                meta={[`${tenant.branches ?? 0}/${tenant.branch_limit ?? 0} branches`, `${tenant.active_members ?? 0}/${tenant.member_limit ?? 0} members`, `${tenant.storage_mb ?? 0}/${tenant.storage_limit_mb ?? 0} MB`].join(" · ")}
                title={`${tenant.organization_name ?? "Organization"} · ${formatCurrency(Number(tenant.revenue_amount ?? 0))}`}
              />
            )}
          />
        </TwoColumn>
      );

    case "users":
      return (
        <TwoColumn>
          <FormPanel description="Assign users to organizations and branches with system roles, branch roles, and access scopes." title="Branch User Access">
            <BranchUserForm branchUsers={dashboard.branchUsers} branches={dashboard.branches} organizations={dashboard.organizations} />
          </FormPanel>
          <RecordPanel
            description="Global branch-user assignments visible to Super Admin."
            emptyText="No branch users are assigned."
            items={dashboard.branchUsers}
            title="User Assignments"
            renderItem={(user) => (
              <RecordCard
                badges={[user.role_name, user.branch_role, user.status]}
                meta={[context.organizationName(user.organization_id), context.branchName(user.branch_id), user.access_scope].join(" · ")}
                title={user.user_id}
              />
            )}
          />
        </TwoColumn>
      );

    case "roles":
      return <RolePermissionMatrix />;

    case "settings":
      return (
        <TwoColumn>
          <FormPanel description="Manage branch-specific membership, payment, attendance, class, notification, and security defaults." title="Branch Settings">
            <BranchSettingsForm branchSettings={dashboard.branchSettings} branches={dashboard.branches} organizations={dashboard.organizations} />
          </FormPanel>
          <FormPanel description="Record system health checks for operational review." title="System Health Signal">
            <HealthCheckForm branches={dashboard.branches} organizations={dashboard.organizations} />
          </FormPanel>
        </TwoColumn>
      );

    case "white-label":
      return (
        <TwoColumn>
          <FormPanel description="Configure tenant branding, custom domains, plan tier, colors, typography, and email branding." title="Tenant Branding">
            <TenantConfigForm organizations={dashboard.organizations} tenantConfigs={dashboard.tenantConfigs} />
          </FormPanel>
          <RecordPanel
            description="White-label configurations for tenant experiences."
            emptyText="No tenant configs are available."
            items={dashboard.tenantConfigs}
            title="Brand Configurations"
            renderItem={(config) => (
              <RecordCard
                badges={[config.status, config.plan_tier, config.domain_status]}
                meta={[context.organizationName(config.organization_id), config.custom_domain ?? config.subdomain ?? "No custom domain"].join(" · ")}
                title={config.brand_name}
              />
            )}
          />
        </TwoColumn>
      );

    case "support":
      return (
        <TwoColumn>
          <FormPanel description="Create and track privacy, consent, export, and deletion requests from customer support." title="Compliance Support Request">
            <ComplianceRequestForm branches={dashboard.branches} organizations={dashboard.organizations} requests={dashboard.complianceRequests} />
          </FormPanel>
          <RecordPanel
            description="Published operational help content available to support teams."
            emptyText="No documentation articles are published."
            items={dashboard.documentationArticles}
            title="Documentation Center"
            renderItem={(article) => (
              <RecordCard
                badges={[article.audience, article.status]}
                meta={[article.category, article.tags.join(", ")].join(" · ")}
                title={article.title}
              />
            )}
          />
        </TwoColumn>
      );

    case "security":
      return (
        <TwoColumn>
          <div className="space-y-5">
            <SecurityEventList events={filterSecurityEvents(dashboard.securityEvents, filters)} filters={filters} />
            <Card>
              <CardHeader>
                <h3 className="text-2xl font-black">Super Admin MFA</h3>
                <p className="text-sm leading-6 text-muted-foreground">Enroll or verify TOTP MFA before running organization transfer, suspend, delete, or bulk actions.</p>
              </CardHeader>
              <CardContent>
                <ButtonLink href="/super-admin/security/mfa" variant="accent">Open MFA Setup</ButtonLink>
              </CardContent>
            </Card>
          </div>
          <RecordPanel
            description="Aggregated security posture by status and severity."
            emptyText="No security summary rows are available."
            items={dashboard.securitySummary}
            title="Security Summary"
            renderItem={(summary) => (
              <RecordCard
                badges={[summary.status ?? "unknown", summary.severity ?? "unknown"]}
                meta={[`First seen ${formatDate(summary.first_seen_at)}`, `Last seen ${formatDate(summary.last_seen_at)}`].join(" · ")}
                title={`${summary.event_count ?? 0} events · ${context.organizationName(summary.organization_id)}`}
              />
            )}
          />
        </TwoColumn>
      );

    case "analytics":
      return (
        <TwoColumn>
          <ChartPanel description="Latest branch metric snapshots for revenue, members, attendance, trainer utilization, and class utilization." title="Branch Performance">
            {dashboard.branchPerformance.length > 0 ? <BranchPerformanceChart data={dashboard.branchPerformance} /> : <EmptyState text="Branch performance appears after branch metrics are recorded." />}
          </ChartPanel>
          <ChartPanel description="Usage against branch, member, and storage limits for commercial SaaS operations." title="Tenant Usage">
            {dashboard.tenantUsagePoints.length > 0 ? <TenantUsageChart data={dashboard.tenantUsagePoints} /> : <EmptyState text="Tenant usage appears after organizations and subscriptions are configured." />}
          </ChartPanel>
        </TwoColumn>
      );

    case "monitoring":
      return (
        <TwoColumn>
          <FormPanel description="Record health status for API, database, storage, queue, email, payments, auth, and background jobs." title="Record Health Check">
            <HealthCheckForm branches={dashboard.branches} organizations={dashboard.organizations} />
          </FormPanel>
          <HealthCheckList dashboard={dashboard} context={context} filters={filters} />
        </TwoColumn>
      );

    case "backups":
      return (
        <TwoColumn>
          <FormPanel description="Queue database, file, configuration, and full backups for platform, tenant, or branch scope." title="Queue Backup">
            <BackupJobForm branches={dashboard.branches} organizations={dashboard.organizations} />
          </FormPanel>
          <BackupList dashboard={dashboard} context={context} filters={filters} />
        </TwoColumn>
      );

    case "audit-logs":
      return (
        <RecordPanel
          description="Activity events from privileged operations, settings changes, and tenant actions."
          emptyText="No audit events are available."
          items={dashboard.activityEvents}
          title="Activity Events"
          renderItem={(event) => (
            <RecordCard
              badges={[event.severity]}
              meta={[formatEnterpriseLabel(event.entity_type), event.entity_id ?? "No entity", formatDate(event.created_at)].join(" · ")}
              title={formatEnterpriseLabel(event.event_type)}
            />
          )}
        />
      );

    case "feature-flags":
      return (
        <TwoColumn>
          <FormPanel description="Enable platform, tenant, and branch-level feature rollout with SaaS plan targeting." title="Feature Flag Control">
            <FeatureFlagForm branches={dashboard.branches} featureFlags={dashboard.featureFlags} organizations={dashboard.organizations} />
          </FormPanel>
          <RecordPanel
            description="Feature controls used for staged rollouts and plan packaging."
            emptyText="No feature flags are configured."
            items={dashboard.featureFlags}
            title="Feature Registry"
            renderItem={(flag) => (
              <RecordCard
                badges={[flag.status, flag.enabled ? "active" : "paused"]}
                meta={[`${flag.rollout_percentage}% rollout`, flag.target_plan_tiers.join(", "), context.organizationName(flag.organization_id)].join(" · ")}
                title={`${flag.name} · ${flag.flag_key}`}
              />
            )}
          />
        </TwoColumn>
      );

    default:
      return <DefaultOperationalNotes superModule={superModule} />;
  }
}

function ModuleShell({ children, stats, superModule }: { children: ReactNode; stats: SummaryStat[]; superModule: SuperAdminModule }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin Module</p>
                <h2 className="mt-3 text-3xl font-black md:text-4xl">{superModule.title}</h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{superModule.description}</p>
              </div>
              <div className="grid size-14 shrink-0 place-items-center rounded-md bg-accent/20 text-foreground">
                <superModule.icon aria-hidden="true" className="size-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-xl font-black">Access Rules</h3>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Super Admin has global platform scope across organizations, gyms, branches, users, billing, settings, security, monitoring, and audit logs.</p>
            <p>Every critical action must remain audited. Operational member fitness, attendance, and trainer progress edits stay behind normal workflows unless an emergency override is introduced.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <StatCard detail={stat.detail} icon={stat.icon} key={stat.label} label={stat.label} value={stat.value} />)}
      </section>

      {children}

      <TwoColumn>
        <ChecklistCard items={superModule.responsibilities} title="Responsibilities" />
        <ChecklistCard items={superModule.safeguards} title="Security Safeguards" />
      </TwoColumn>
    </div>
  );
}

function getModuleStats(slug: string, dashboard: EnterpriseDashboard, context: ModuleContext, organizationManagement: OrganizationManagementData | null = null): SummaryStat[] {
  const base = [
    stat("Organizations", dashboard.organizations.length, "Tenant organizations", <Building2 className="size-5" />),
    stat("Gyms", dashboard.gyms.length, "Gym records", <Building2 className="size-5" />),
    stat("Branches", dashboard.branches.length, "Operational branches", <Activity className="size-5" />),
    stat("Revenue", context.totalRevenue, "Latest metric revenue", <CreditCard className="size-5" />, "currency")
  ];

  switch (slug) {
    case "organizations":
      return [
        stat("Organizations", organizationManagement?.summary.totalOrganizations ?? dashboard.organizations.length, "All tenant records", <Building2 className="size-5" />),
        stat("Active", organizationManagement?.summary.activeOrganizations ?? dashboard.organizations.filter((item) => item.status === "active" || item.status === "trial").length, "Active or trial tenants on this page", <ShieldCheck className="size-5" />),
        stat("At Risk", organizationManagement?.summary.suspendedOrganizations ?? dashboard.organizations.filter((item) => item.status === "suspended" || item.status === "deactivated").length, "Restricted or archived on this page", <AlertTriangle className="size-5" />),
        stat("Avg Health", organizationManagement?.summary.averageHealthScore ?? 0, "Average customer health on this page", <HeartPulse className="size-5" />)
      ];
    case "gyms":
      return [
        stat("Gyms", dashboard.gyms.length, "Gym records", <Building2 className="size-5" />),
        stat("Branches", dashboard.branches.length, "Branch records", <Activity className="size-5" />),
        stat("Active Branches", dashboard.branches.filter((item) => item.status === "active").length, "Operational now", <ShieldCheck className="size-5" />),
        stat("Capacity", dashboard.branches.reduce((total, branch) => total + Number(branch.capacity ?? 0), 0), "Total branch capacity", <UsersRound className="size-5" />)
      ];
    case "domains":
      return [
        stat("Domains", dashboard.tenantDomains.length, "Registered tenant domains", <Globe2 className="size-5" />),
        stat("Verified", dashboard.tenantDomains.filter((item) => item.status === "verified").length, "Ready domains", <ShieldCheck className="size-5" />),
        stat("Pending", dashboard.tenantDomains.filter((item) => item.status === "pending").length, "DNS or provider work", <AlertTriangle className="size-5" />),
        stat("Primary", dashboard.tenantDomains.filter((item) => item.is_primary).length, "Primary routes", <Flag className="size-5" />)
      ];
    case "subscriptions":
    case "billing":
      return [
        stat("Subscriptions", dashboard.subscriptions.length, "Tenant licenses", <CreditCard className="size-5" />),
        stat("Active", dashboard.subscriptions.filter((item) => item.status === "active" || item.status === "trial").length, "Active or trial", <ShieldCheck className="size-5" />),
        stat("At Risk", dashboard.subscriptions.filter((item) => item.status === "past_due" || item.status === "suspended" || item.status === "cancelled").length, "Past due, suspended, or cancelled", <AlertTriangle className="size-5" />),
        stat("Revenue", context.totalRevenue, "Latest branch revenue", <CreditCard className="size-5" />, "currency")
      ];
    case "users":
      return [
        stat("Assignments", dashboard.branchUsers.length, "Branch user records", <UsersRound className="size-5" />),
        stat("Org Owners", dashboard.branchUsers.filter((item) => item.role_name === "organization_owner").length, "Organization-level owners", <ShieldCheck className="size-5" />),
        stat("Admins", dashboard.branchUsers.filter((item) => item.role_name === "gym_admin").length, "Gym admins", <LockKeyhole className="size-5" />),
        stat("Suspended", dashboard.branchUsers.filter((item) => item.status === "suspended" || item.status === "revoked").length, "Restricted access", <AlertTriangle className="size-5" />)
      ];
    case "roles":
      return [
        stat("Roles", rolePriority.length, "System roles", <LockKeyhole className="size-5" />),
        stat("Resources", new Set(Object.values(ROLE_PERMISSIONS).flatMap((permissions) => Object.keys(permissions))).size, "RBAC resources", <ShieldCheck className="size-5" />),
        stat("Privileged", 2, "Super Admin and Organization Owner", <UsersRound className="size-5" />),
        stat("Actions", 6, "Read, create, update, delete, export, approve", <Flag className="size-5" />)
      ];
    case "white-label":
      return [
        stat("Tenant Configs", dashboard.tenantConfigs.length, "Brand profiles", <Palette className="size-5" />),
        stat("Custom Domains", dashboard.tenantConfigs.filter((item) => item.custom_domain).length, "Configured brand domains", <Globe2 className="size-5" />),
        stat("Enterprise", dashboard.tenantConfigs.filter((item) => item.plan_tier === "enterprise").length, "Enterprise brands", <CreditCard className="size-5" />),
        stat("Active", dashboard.tenantConfigs.filter((item) => item.status === "active" || item.status === "trial").length, "Active brand configs", <ShieldCheck className="size-5" />)
      ];
    case "security":
      return [
        stat("Security Events", dashboard.securityEvents.length, "Recent records", <ShieldCheck className="size-5" />),
        stat("Open", dashboard.securityEvents.filter((item) => item.status === "open" || item.status === "investigating").length, "Needs review", <AlertTriangle className="size-5" />),
        stat("Critical", dashboard.securityEvents.filter((item) => item.severity === "critical").length, "Critical severity", <LockKeyhole className="size-5" />),
        stat("Resolved", dashboard.securityEvents.filter((item) => item.status === "resolved").length, "Closed records", <ShieldCheck className="size-5" />)
      ];
    case "monitoring":
      return [
        stat("Health Checks", dashboard.healthChecks.length, "Recent checks", <HeartPulse className="size-5" />),
        stat("Healthy", dashboard.healthChecks.filter((item) => item.status === "healthy").length, "Healthy records", <ShieldCheck className="size-5" />),
        stat("Degraded", dashboard.healthChecks.filter((item) => item.status === "degraded").length, "Watch records", <AlertTriangle className="size-5" />),
        stat("Down", dashboard.healthChecks.filter((item) => item.status === "down").length, "Failed records", <AlertTriangle className="size-5" />)
      ];
    case "backups":
      return [
        stat("Backup Jobs", dashboard.backupJobs.length, "Recent jobs", <DatabaseBackup className="size-5" />),
        stat("Completed", dashboard.backupJobs.filter((item) => item.status === "completed").length, "Completed jobs", <ShieldCheck className="size-5" />),
        stat("Queued", dashboard.backupJobs.filter((item) => item.status === "queued" || item.status === "running").length, "Pending execution", <Activity className="size-5" />),
        stat("Failed", dashboard.backupJobs.filter((item) => item.status === "failed").length, "Needs recovery review", <AlertTriangle className="size-5" />)
      ];
    case "audit-logs":
      return [
        stat("Activity Events", dashboard.activityEvents.length, "Recent activity records", <FileText className="size-5" />),
        stat("Critical", dashboard.activityEvents.filter((item) => item.severity === "critical").length, "Critical activities", <AlertTriangle className="size-5" />),
        stat("Warnings", dashboard.activityEvents.filter((item) => item.severity === "warning").length, "Warning activities", <Flag className="size-5" />),
        stat("Actors", new Set(dashboard.activityEvents.map((item) => item.actor_id).filter(Boolean)).size, "Unique actors", <UsersRound className="size-5" />)
      ];
    case "feature-flags":
      return [
        stat("Feature Flags", dashboard.featureFlags.length, "Configured controls", <Flag className="size-5" />),
        stat("Enabled", dashboard.featureFlags.filter((item) => item.enabled).length, "Currently enabled", <ShieldCheck className="size-5" />),
        stat("Paused", dashboard.featureFlags.filter((item) => item.status === "paused").length, "Paused controls", <AlertTriangle className="size-5" />),
        stat("Global", dashboard.featureFlags.filter((item) => !item.organization_id && !item.branch_id).length, "Platform-wide controls", <Globe2 className="size-5" />)
      ];
    default:
      return base;
  }
}

function stat(label: string, value: number, detail: string, icon: ReactNode, format?: "currency"): SummaryStat {
  return {
    label,
    value: format === "currency" ? formatCurrency(value) : formatCompactNumber(value),
    detail,
    icon
  };
}

type ModuleContext = {
  totalRevenue: number;
  organizationName: (id: string | null | undefined) => string;
  branchName: (id: string | null | undefined) => string;
};

function buildModuleContext(dashboard: EnterpriseDashboard): ModuleContext {
  const organizations = new Map(dashboard.organizations.map((organization) => [organization.id, organization.name]));
  const branches = new Map(dashboard.branches.map((branch) => [branch.id, branch.name]));

  return {
    totalRevenue: dashboard.branchLatestMetrics.reduce((total, row) => total + Number(row.revenue_amount ?? 0), 0),
    organizationName: (id) => id ? organizations.get(id) ?? "Unknown organization" : "Platform scope",
    branchName: (id) => id ? branches.get(id) ?? "Unknown branch" : "All branches"
  };
}

function TwoColumn({ children, wideRight = false }: { children: ReactNode; wideRight?: boolean }) {
  return <section className={wideRight ? "grid gap-5 xl:grid-cols-[0.82fr_1.18fr]" : "grid gap-5 xl:grid-cols-2"}>{children}</section>;
}

function FormPanel({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-2xl font-black">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartPanel({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-2xl font-black">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RecordPanel<T>({ description, emptyText, items, renderItem, title }: { description: string; emptyText: string; items: readonly T[]; renderItem: (item: T) => ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-2xl font-black">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? items.slice(0, 12).map((item, index) => <div key={index}>{renderItem(item)}</div>) : <EmptyState text={emptyText} />}
      </CardContent>
    </Card>
  );
}

function RecordCard({ badges, meta, title }: { badges: Array<string | null | undefined>; meta: string; title: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-black">{title}</p>
        {badges.filter(Boolean).map((badge, index) => <EnterpriseStatusBadge key={`${badge}-${index}`} status={badge ?? "unknown"} />)}
      </div>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">{meta}</p>
    </div>
  );
}

function SubscriptionLedger({ dashboard, context }: { dashboard: EnterpriseDashboard; context: ModuleContext }) {
  return (
    <RecordPanel
      description="Plan tier, license limits, status, and renewal dates."
      emptyText="No platform subscriptions are configured."
      items={dashboard.subscriptions}
      title="Subscription Ledger"
      renderItem={(subscription) => (
        <RecordCard
          badges={[subscription.plan_tier, subscription.status]}
          meta={[context.organizationName(subscription.organization_id), `${subscription.branch_limit} branches`, `${subscription.member_limit} members`, `Renews ${formatDate(subscription.renews_on)}`].join(" · ")}
          title={`License ${subscription.id.slice(0, 8)}`}
        />
      )}
    />
  );
}

function SecurityEventList({ events, filters }: { events: EnterpriseDashboard["securityEvents"]; filters: Record<string, string | string[] | undefined> }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-2xl font-black">Security Events</h3>
        <p className="text-sm leading-6 text-muted-foreground">Review and update open, investigating, resolved, or dismissed security records.</p>
        <FilterSummary filters={filters} />
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length > 0 ? events.slice(0, 10).map((event) => (
          <div className="rounded-md border border-border bg-background p-4" key={event.id}>
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{formatEnterpriseLabel(event.event_type)}</p>
                  <EnterpriseStatusBadge status={event.severity} />
                  <EnterpriseStatusBadge status={event.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatDate(event.created_at)}</p>
              </div>
              <SecurityEventStatusForm event={event} />
            </div>
          </div>
        )) : <EmptyState text="No security events are open in your current scope." />}
      </CardContent>
    </Card>
  );
}

function HealthCheckList({ dashboard, context, filters }: { dashboard: EnterpriseDashboard; context: ModuleContext; filters: Record<string, string | string[] | undefined> }) {
  const healthByComponent = latestHealthByComponent(filterByStatus(dashboard.healthChecks, filters));

  return (
    <RecordPanel
      description="Latest component health record by component."
      emptyText="No health checks are available."
      items={healthByComponent}
      title="Component Health"
      renderItem={(check) => (
        <RecordCard
          badges={[check.status]}
          meta={[context.organizationName(check.organization_id), context.branchName(check.branch_id), `${check.latency_ms ?? 0}ms`, check.message ?? "No message"].join(" · ")}
          title={formatEnterpriseLabel(check.component)}
        />
      )}
    />
  );
}

function BackupList({ dashboard, context, filters }: { dashboard: EnterpriseDashboard; context: ModuleContext; filters: Record<string, string | string[] | undefined> }) {
  return (
    <RecordPanel
      description="Recent backup queue, execution, and failure records."
      emptyText="No backup jobs have been queued yet."
      items={filterByStatus(dashboard.backupJobs, filters)}
      title="Backup Jobs"
      renderItem={(job) => (
        <RecordCard
          badges={[job.status, job.scope, job.backup_type]}
          meta={[context.organizationName(job.organization_id), context.branchName(job.branch_id), buildRecoveryPointLabel(job.recovery_point_at), `${job.size_mb ?? 0} MB`].join(" · ")}
          title={`Backup ${job.id.slice(0, 8)}`}
        />
      )}
    />
  );
}

function RolePermissionMatrix() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {rolePriority.map((role, index) => (
        <Card key={`${role}-${index}`}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-black">{formatEnterpriseLabel(role)}</h3>
              {role === "super_admin" ? <EnterpriseStatusBadge status="critical" /> : null}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Permission coverage for platform RBAC actions.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(ROLE_PERMISSIONS[role]).map(([resource, actions]) => (
              <div className="rounded-md border border-border bg-background p-4" key={resource}>
                <p className="font-black">{formatEnterpriseLabel(resource)}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{actions?.join(" · ")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChecklistCard({ items, title }: { items: string[]; title: string }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-xl font-black">{title}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div className="rounded-md border border-border bg-background p-4 text-sm font-semibold leading-6" key={item}>
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DefaultOperationalNotes({ superModule }: { superModule: SuperAdminModule }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-2xl font-black">Module Workflows</h3>
        <p className="text-sm leading-6 text-muted-foreground">Operational boundaries for {superModule.label.toLowerCase()}.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {superModule.responsibilities.map((item) => (
          <div className="rounded-md border border-border bg-background p-4 text-sm font-semibold leading-6" key={item}>
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FilterSummary({ filters }: { filters: Record<string, string | string[] | undefined> }) {
  const entries = Object.entries(filters)
    .map(([key, value]) => [key, filterValues(value).join(", ")] as const)
    .filter(([, value]) => value.length > 0);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <EnterpriseStatusBadge key={key} status={`${formatEnterpriseLabel(key)}: ${value}`} />
      ))}
    </div>
  );
}

function filterSecurityEvents(events: EnterpriseDashboard["securityEvents"], filters: Record<string, string | string[] | undefined>) {
  const statuses = filterValues(filters.status);
  const severities = filterValues(filters.severity);

  return events.filter((event) => {
    const statusMatches = statuses.length === 0 || statuses.includes(event.status);
    const severityMatches = severities.length === 0 || severities.includes(event.severity);
    return statusMatches && severityMatches;
  });
}

function filterByStatus<T extends { status: string }>(items: T[], filters: Record<string, string | string[] | undefined>) {
  const statuses = filterValues(filters.status);

  if (statuses.length === 0) {
    return items;
  }

  return items.filter((item) => statuses.includes(item.status));
}

function filterValues(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-background p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined
  }).format(new Date(value));
}
