import type { Metadata } from "next";
import { Activity, AlertTriangle, Building2, DatabaseBackup, FileText, Flag, Gauge, Globe2, LockKeyhole, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { BranchPerformanceChart, TenantUsageChart } from "@/features/enterprise/components/lazy-enterprise-charts";
import {
  BackupJobForm,
  BranchForm,
  BranchSettingsForm,
  BranchUserForm,
  ComplianceRequestForm,
  FeatureFlagForm,
  HealthCheckForm,
  OrganizationForm,
  RetentionPolicyForm,
  SecurityEventStatusForm,
  SubscriptionForm,
  TenantConfigForm
} from "@/features/enterprise/components/enterprise-forms";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { buildRecoveryPointLabel, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { getEnterpriseDashboard, latestHealthByComponent } from "@/features/enterprise/services/enterprise-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import type { EnterpriseKpi } from "@/types/enterprise";

export const metadata: Metadata = createMetadata({
  title: "Enterprise Settings",
  description: "Multi-branch management, tenant settings, white labeling, governance, compliance, backups, monitoring, and enterprise readiness.",
  path: "/admin/settings"
});

export default async function AdminSettingsPage() {
  await requireRole(["super_admin", "gym_admin"], "/admin/settings");
  const dashboard = await getEnterpriseDashboard();
  const healthByComponent = latestHealthByComponent(dashboard.healthChecks);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Enterprise Platform Layer</p>
        <h2 className="mt-2 text-3xl font-black">Settings, branches, white labeling, and governance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Operate the platform as a commercial SaaS product with tenant isolation, branch-level controls, franchise governance, white-label branding, feature flags, licensing, compliance workflows, backup readiness, and health monitoring.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.kpis.map((kpi) => <EnterpriseKpiCard key={kpi.key} kpi={kpi} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-5" />
              <h3 className="text-2xl font-black">Branch Performance</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Latest branch metric snapshots for revenue, member volume, attendance, trainer utilization, and class utilization.</p>
          </CardHeader>
          <CardContent>
            {dashboard.branchPerformance.length > 0 ? <BranchPerformanceChart data={dashboard.branchPerformance} /> : <EmptyState text="Branch performance appears after branch metrics are recorded." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="size-5" />
              <h3 className="text-2xl font-black">Tenant Usage</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Usage against branch, member, and storage limits to support SaaS licensing and capacity planning.</p>
          </CardHeader>
          <CardContent>
            {dashboard.tenantUsagePoints.length > 0 ? <TenantUsageChart data={dashboard.tenantUsagePoints} /> : <EmptyState text="Tenant usage charts appear after organizations and subscriptions are configured." />}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Organization Management</h3>
            <p className="text-sm leading-6 text-muted-foreground">Create and maintain single-gym tenants, multi-branch operators, and franchise networks.</p>
          </CardHeader>
          <CardContent><OrganizationForm organizations={dashboard.organizations} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Organizations</h3>
            <p className="text-sm leading-6 text-muted-foreground">Platform-wide tenant visibility for super-admin governance.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.organizations.slice(0, 8).map((organization) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={organization.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{organization.name}</p>
                  <EnterpriseStatusBadge status={organization.status} />
                  <EnterpriseStatusBadge status={organization.organization_type} />
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{organization.primary_domain ?? organization.slug}</p>
              </div>
            ))}
            {dashboard.organizations.length === 0 ? <EmptyState text="No organizations are visible in your current scope." /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Branch Management</h3>
            <p className="text-sm leading-6 text-muted-foreground">Create branches, attach existing gym records, define location, capacity, operating hours, and operational status.</p>
          </CardHeader>
          <CardContent><BranchForm branches={dashboard.branches} organizations={dashboard.organizations} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Branch Users and Access</h3>
            <p className="text-sm leading-6 text-muted-foreground">Assign users to branches with system roles, branch roles, access scopes, and permission overrides.</p>
          </CardHeader>
          <CardContent><BranchUserForm branchUsers={dashboard.branchUsers} branches={dashboard.branches} organizations={dashboard.organizations} /></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5" />
              <h3 className="text-2xl font-black">Branch Settings Center</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Configure branch-specific membership, payment, attendance, classes, notifications, and security policies.</p>
          </CardHeader>
          <CardContent><BranchSettingsForm branchSettings={dashboard.branchSettings} branches={dashboard.branches} organizations={dashboard.organizations} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe2 className="size-5" />
              <h3 className="text-2xl font-black">White Label and Domains</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Manage tenant keys, SaaS plans, custom domains, subdomains, brand colors, typography, logos, email branding, and compliance defaults.</p>
          </CardHeader>
          <CardContent><TenantConfigForm organizations={dashboard.organizations} tenantConfigs={dashboard.tenantConfigs} /></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flag className="size-5" />
              <h3 className="text-2xl font-black">Feature Flags</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Control tenant-level, branch-level, and platform-level feature availability with rollout percentage and plan-tier targeting.</p>
          </CardHeader>
          <CardContent><FeatureFlagForm branches={dashboard.branches} featureFlags={dashboard.featureFlags} organizations={dashboard.organizations} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Feature Registry</h3>
            <p className="text-sm leading-6 text-muted-foreground">Global and scoped feature controls used for SaaS plan packaging.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.featureFlags.slice(0, 10).map((flag) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={flag.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{flag.name}</p>
                  <EnterpriseStatusBadge status={flag.status} />
                  <EnterpriseStatusBadge status={flag.enabled ? "active" : "paused"} />
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{flag.flag_key} · {flag.rollout_percentage}% rollout · {flag.target_plan_tiers.join(", ")}</p>
              </div>
            ))}
            {dashboard.featureFlags.length === 0 ? <EmptyState text="No feature flags are visible in your current scope." /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Subscription and Licensing</h3>
            <p className="text-sm leading-6 text-muted-foreground">Prepare Starter, Professional, and Enterprise SaaS plans with branch, member, staff, and storage limits.</p>
          </CardHeader>
          <CardContent><SubscriptionForm organizations={dashboard.organizations} subscriptions={dashboard.subscriptions} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Tenant Usage Summary</h3>
            <p className="text-sm leading-6 text-muted-foreground">Commercial SaaS capacity monitoring for plan enforcement and upgrade conversations.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.tenantUsage.map((tenant) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={tenant.organization_id ?? tenant.organization_name}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{tenant.organization_name}</p>
                  {tenant.plan_tier ? <EnterpriseStatusBadge status={tenant.plan_tier} /> : null}
                  {tenant.organization_status ? <EnterpriseStatusBadge status={tenant.organization_status} /> : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">{tenant.branches ?? 0}/{tenant.branch_limit ?? 0} branches · {tenant.active_members ?? 0}/{tenant.member_limit ?? 0} members · {tenant.storage_mb ?? 0}/{tenant.storage_limit_mb ?? 0} MB</p>
                <p className="mt-2 text-2xl font-black">{formatCurrency(Number(tenant.revenue_amount ?? 0))}</p>
              </div>
            ))}
            {dashboard.tenantUsage.length === 0 ? <EmptyState text="No tenant usage summary is available yet." /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              <h3 className="text-2xl font-black">Compliance and Retention</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Manage privacy requests, consent reviews, deletion workflows, and category-specific data retention policies.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ComplianceRequestForm branches={dashboard.branches} organizations={dashboard.organizations} requests={dashboard.complianceRequests} />
            <RetentionPolicyForm branches={dashboard.branches} organizations={dashboard.organizations} policies={dashboard.retentionPolicies} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DatabaseBackup className="size-5" />
              <h3 className="text-2xl font-black">Backup and Recovery</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Queue database, file, configuration, and full backups while tracking recovery points and failed jobs.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <BackupJobForm branches={dashboard.branches} organizations={dashboard.organizations} />
            <div className="space-y-3">
              {dashboard.backupJobs.slice(0, 6).map((job) => (
                <div className="rounded-md border border-border bg-surface-muted p-4" key={job.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{formatEnterpriseLabel(job.backup_type)}</p>
                    <EnterpriseStatusBadge status={job.status} />
                    <EnterpriseStatusBadge status={job.scope} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{buildRecoveryPointLabel(job.recovery_point_at)} · {job.size_mb ?? 0} MB</p>
                </div>
              ))}
              {dashboard.backupJobs.length === 0 ? <EmptyState text="No backup jobs have been queued yet." /> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-5" />
              <h3 className="text-2xl font-black">System Health Monitoring</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Track API, database, storage, queues, email, payments, auth, and background jobs across platform, tenant, and branch scopes.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <HealthCheckForm branches={dashboard.branches} organizations={dashboard.organizations} />
            <div className="grid gap-3 sm:grid-cols-2">
              {healthByComponent.map((check) => (
                <div className="rounded-md border border-border bg-surface-muted p-4" key={check.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{formatEnterpriseLabel(check.component)}</p>
                    <EnterpriseStatusBadge status={check.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{check.latency_ms ?? 0}ms · {check.message ?? "No message"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LockKeyhole className="size-5" />
              <h3 className="text-2xl font-black">Security and Audit Center</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Centralize security events, activity logs, role changes, settings updates, exports, and operational incidents.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.securityEvents.slice(0, 6).map((event) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={event.id}>
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{formatEnterpriseLabel(event.event_type)}</p>
                      <EnterpriseStatusBadge status={event.severity} />
                      <EnterpriseStatusBadge status={event.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
                  </div>
                  <SecurityEventStatusForm event={event} />
                </div>
              </div>
            ))}
            {dashboard.securityEvents.length === 0 ? <EmptyState text="No security events are open in your current scope." /> : null}
            <div className="pt-3">
              <h4 className="font-black">Recent Activity</h4>
              <div className="mt-3 space-y-2">
                {dashboard.activityEvents.slice(0, 6).map((event) => (
                  <div className="rounded-md border border-border bg-surface p-3 text-sm" key={event.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{formatEnterpriseLabel(event.event_type)}</p>
                      <EnterpriseStatusBadge status={event.severity} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatEnterpriseLabel(event.entity_type)} · {new Date(event.created_at).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {dashboard.activityEvents.length === 0 ? <EmptyState text="Activity events will appear after enterprise actions are recorded." /> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-5" />
              <h3 className="text-2xl font-black">Documentation Center</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Searchable help content for administrators, trainers, members, API consumers, and deployment operators.</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {dashboard.documentationArticles.map((article) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={article.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{article.title}</p>
                  <EnterpriseStatusBadge status={article.audience} />
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{article.category} · {article.tags.join(", ")}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.body}</p>
              </div>
            ))}
            {dashboard.documentationArticles.length === 0 ? <EmptyState text="Documentation articles will appear after the migration seeds the help center." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              <h3 className="text-2xl font-black">Production Readiness Review</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Enterprise readiness checks that should be completed before commercial SaaS rollout.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Apply tenant and branch RLS policies in staging and run isolation tests.",
              "Configure Supabase backups, storage backups, and documented recovery drills.",
              "Connect Sentry, Logtail, Datadog, or equivalent error monitoring.",
              "Verify custom domain ownership and TLS automation before white-label launch.",
              "Review retention policies with legal and finance stakeholders.",
              "Run Lighthouse, Playwright, API smoke, and migration rollback checks before production release."
            ].map((item) => (
              <div className="rounded-md border border-border bg-surface-muted p-4 text-sm font-semibold leading-6" key={item}>{item}</div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EnterpriseKpiCard({ kpi }: { kpi: EnterpriseKpi }) {
  return (
    <StatCard detail={kpi.detail} icon={kpiIcon(kpi.key)} label={kpi.label} value={kpi.value} />
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}

function kpiIcon(key: string) {
  if (key.includes("organization") || key.includes("branch")) {
    return <Building2 className="size-5" />;
  }
  if (key.includes("security")) {
    return <LockKeyhole className="size-5" />;
  }
  if (key.includes("compliance")) {
    return <ShieldCheck className="size-5" />;
  }
  if (key.includes("backup")) {
    return <DatabaseBackup className="size-5" />;
  }
  if (key.includes("feature")) {
    return <Flag className="size-5" />;
  }
  if (key.includes("storage") || key.includes("health")) {
    return <Activity className="size-5" />;
  }
  return <UsersRound className="size-5" />;
}
