import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  Building2,
  CreditCard,
  Download,
  HeartPulse,
  ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { OrgBillingTab } from "@/features/super-admin/components/organizations/OrgBillingTab";
import { OrgDetailActions } from "@/features/super-admin/components/organizations/OrgDetailActions";
import { OrgUsageTab } from "@/features/super-admin/components/organizations/OrgUsageTab";

import { OrganizationApprovalReviewPanel } from "@/features/super-admin/components/organizations/OrganizationApprovalReviewPanel";
import { OrganizationGovernanceControlPanel } from "@/features/super-admin/components/organizations/OrganizationGovernanceControlPanel";
import { PackageBadge } from "@/features/super-admin/components/subscriptions/PackageBadge";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { getOrganizationDetailData, normalizeAuditFilters, normalizeDetailListFilters } from "@/features/super-admin/services/organization-management-service";
import { requireRole } from "@/lib/auth/guards";
import type { Json } from "@/types/database";

type OrganizationDetailPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const tabs = ["profile", "governance", "users", "usage", "gyms", "billing", "audit", "security", "domains"] as const;
type DetailTab = (typeof tabs)[number];

export default async function SuperAdminOrganizationDetailPage({ params, searchParams }: OrganizationDetailPageProps) {
  await requireRole(["super_admin"], "/super-admin/organizations");
  const { organizationId } = await params;
  const query = searchParams ? await searchParams : {};
  const activeTab = isDetailTab(stringParam(query.tab)) ? stringParam(query.tab) : "profile";
  const auditFilters = normalizeAuditFilters({
    query: stringParam(query.auditQ) ?? "",
    severity: stringParam(query.severity) ?? "all",
    source: stringParam(query.source) ?? "all"
  });
  const listFilters = normalizeDetailListFilters({
    gymsPage: Number(stringParam(query.gymsPage) ?? 1),
    gymsPageSize: Number(stringParam(query.gymsPageSize) ?? 25),
    branchesPage: Number(stringParam(query.branchesPage) ?? 1),
    branchesPageSize: Number(stringParam(query.branchesPageSize) ?? 25),
    usersPage: Number(stringParam(query.usersPage) ?? 1),
    usersPageSize: Number(stringParam(query.usersPageSize) ?? 25),
    domainsPage: Number(stringParam(query.domainsPage) ?? 1),
    domainsPageSize: Number(stringParam(query.domainsPageSize) ?? 25),
    securityPage: Number(stringParam(query.securityPage) ?? 1),
    securityPageSize: Number(stringParam(query.securityPageSize) ?? 25)
  });
  const data = await getOrganizationDetailData(organizationId, auditFilters, listFilters);
  const criticalSuperAdminEmail = getCriticalSuperAdminEmail();

  if (!data) {
    notFound();
  }

  const record = data.record;

  return (
    <OrgDetailActions criticalSuperAdminEmail={criticalSuperAdminEmail} data={data}>
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-3xl font-black md:text-4xl">{record.organization.name}</h2>
                  <EnterpriseStatusBadge status={record.organization.status} />
                  <PackageBadge packageName={record.subscription.packageName} />
                  <HealthBadge score={record.health.score} status={record.health.status} />
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {record.organization.primary_domain ?? record.organization.slug} · Owner {record.owner?.fullName ?? "Unassigned"} · Billing {record.organization.billing_email ?? "not configured"}
                </p>
                {record.tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {record.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/super-admin/organizations" variant="secondary">Back to Registry</ButtonLink>
                <ButtonLink href={`/api/super-admin/organizations/export?scope=audit&organizationId=${record.organization.id}&format=csv`} variant="secondary">
                  <Download aria-hidden="true" className="size-4" />
                  Audit CSV
                </ButtonLink>
                <ButtonLink href={`/api/super-admin/organizations/export?scope=audit&organizationId=${record.organization.id}&format=pdf`} variant="secondary">
                  <Download aria-hidden="true" className="size-4" />
                  Audit PDF
                </ButtonLink>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xl font-black">Customer Health</h3>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black">{record.health.score}/100</p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">{record.health.label}</p>
            <ul className="mt-4 space-y-2 text-sm font-semibold leading-6 text-muted-foreground">
              {record.health.factors.map((factor) => <li key={factor}>{factor}</li>)}
            </ul>
          </CardContent>
        </Card>
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-md border border-border bg-background/90 backdrop-blur p-2 sticky top-0 z-[5]">
        {tabs.map((tab) => (
          <ButtonLink
            className={activeTab === tab ? "bg-primary text-primary-foreground hover:bg-primary" : ""}
            href={`/super-admin/organizations/${record.organization.id}?tab=${tab}`}
            key={tab}
            variant={activeTab === tab ? "primary" : "ghost"}
          >
            {formatEnterpriseLabel(tab)}
          </ButtonLink>
        ))}
      </nav>

      {activeTab === "profile" ? <ProfileTab data={data} /> : null}
      {activeTab === "governance" ? <GovernanceTab criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} /> : null}
      {activeTab === "users" ? <UsersTab data={data} /> : null}
      {activeTab === "usage" ? <OrgUsageTab record={data.record} /> : null}
      {activeTab === "gyms" ? <GymsTab data={data} /> : null}
      {activeTab === "billing" ? <OrgBillingTab data={data} /> : null}
      {activeTab === "audit" ? <AuditTab data={data} /> : null}
      {activeTab === "security" ? <SecurityTab data={data} /> : null}
      {activeTab === "domains" ? <DomainsTab data={data} /> : null}
    </div>
    </OrgDetailActions>
  );
}

function GovernanceTab({ criticalSuperAdminEmail, data }: { criticalSuperAdminEmail: string; data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  const softDelete = data.record.softDelete;

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <InfoCard title="Governance Status" icon={<ShieldCheck className="size-5" />}>
          <Line label="Pending approvals" value={formatCompactNumber(data.record.pendingApprovalCount)} />
          <Line label="Soft-deleted" value={softDelete.deletedAt ? "Yes" : "No"} />
          <Line label="Restore available" value={softDelete.restoreAvailable ? "Yes" : "No"} />
          <Line label="Restore until" value={softDelete.restoreUntil ? formatDateTime(softDelete.restoreUntil) : "Not applicable"} />
          <Line label="Delete reason" value={softDelete.reason ?? "Not applicable"} />
          <Line label="Legal hold" value={data.record.legalHold.active ? "Active" : "Inactive"} />
        </InfoCard>
        <InfoCard title="Delete Protection" icon={<ShieldCheck className="size-5" />}>
          <Line label="Dependency warning" value={data.record.deletionProtection.reasons.length > 0 ? `${data.record.deletionProtection.reasons.length} dependency type(s)` : "No dependencies"} />
          <Line label="Policy" value="Soft delete with restore window" />
          <Line label="Restore window" value="30 days" />
          <Line label="Permanent purge" value={data.record.purgeEligibility.eligible ? "Requestable with approval" : "Blocked by governance controls"} />
        </InfoCard>
        <InfoCard title="Control Requirements" icon={<ShieldCheck className="size-5" />}>
          <Line label="Step-up email" value={criticalSuperAdminEmail} />
          <Line label="MFA freshness" value="10 minutes" />
          <Line label="Approval review" value="Fresh MFA required for transfer, suspend, delete, purge, bulk suspend, package assignment" />
          <Line label="Requester approval" value="Allowed after fresh MFA" />
        </InfoCard>
      </div>
      <OrganizationGovernanceControlPanel criticalSuperAdminEmail={criticalSuperAdminEmail} record={data.record} />
      <OrganizationApprovalReviewPanel approvals={data.approvalRequests} />
    </section>
  );
}

function ProfileTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  const profile = businessProfile(data.record.organization.settings);

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Locations</p>
          <p className="mt-2 text-3xl font-black">{formatCompactNumber(data.record.usage.gyms)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Branches</p>
          <p className="mt-2 text-3xl font-black">{data.record.usage.activeBranches}/{data.record.usage.branches}</p>
          <p className="mt-1 text-xs text-muted-foreground">Active / Total</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Active Members</p>
          <p className="mt-2 text-3xl font-black">{formatCompactNumber(data.record.usage.activeMembers)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Revenue</p>
          <p className="mt-2 text-3xl font-black">{formatCurrency(data.record.usage.revenue)}</p>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-black">Organization Profile</h3>
          </div>
          <div className="mt-4 grid gap-4">
            <DetailRow label="Name" value={data.record.organization.name} />
            <DetailRow label="Slug" value={data.record.organization.slug} />
            <DetailRow label="Status" value={formatEnterpriseLabel(data.record.organization.status)} />
            <DetailRow label="Primary Domain" value={data.record.organization.primary_domain ?? "Not configured"} />
            <DetailRow label="Billing Email" value={data.record.organization.billing_email ?? "Not configured"} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-black">Business Details</h3>
          </div>
          <div className="mt-4 grid gap-4">
            <DetailRow label="Legal Name" value={profile.legalName || "Not configured"} />
            <DetailRow label="GST Number" value={profile.gstNumber || "Not configured"} />
            <DetailRow label="Phone" value={profile.phone || "Not configured"} />
            <DetailRow label="Address" value={profile.address || "Not configured"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function UsersTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  return (
    <section className="space-y-3">
      <RecordGrid emptyText="No user assignments were found." title="Organization User Assignments">
        {data.users.map((user) => (
          <div className="rounded-md border border-border bg-background p-4" key={user.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">{user.profile?.fullName ?? user.user_id}</p>
              <EnterpriseStatusBadge status={user.role_name} />
              <EnterpriseStatusBadge status={user.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{user.profile?.email ?? "No email"} · {formatEnterpriseLabel(user.access_scope)} · {formatEnterpriseLabel(user.branch_role)}</p>
          </div>
        ))}
      </RecordGrid>
      <DetailPaginationControls organizationId={data.record.organization.id} pageParam="usersPage" pageSizeParam="usersPageSize" pagination={data.listPagination.users} tab="users" />
    </section>
  );
}

function GymsTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  const branches = data.branches || [];
  const gyms = data.gyms || [];
  const totalMembers = branches.reduce((sum, b) => sum + (b.capacity || 0), 0);
  const totalRevenue = (data.recentPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const activeGyms = gyms.filter((g) => g.status === "active").length;
  const activeBranches = branches.filter((b) => b.status === "active").length;

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Total Gyms</p>
          <p className="mt-1 text-2xl font-black">{formatCompactNumber(gyms.length)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{activeGyms} active</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Total Branches</p>
          <p className="mt-1 text-2xl font-black">{formatCompactNumber(branches.length)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{activeBranches} active</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Members (capacity)</p>
          <p className="mt-1 text-2xl font-black">{formatCompactNumber(totalMembers)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across all branches</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Revenue</p>
          <p className="mt-1 text-2xl font-black">{formatCurrency(totalRevenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">All payments</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black">Locations</h3>
            <span className="text-sm text-muted-foreground">{gyms.length} gym(s)</span>
          </div>
          {gyms.length > 0 ? gyms.map((gym) => {
            const gymBranches = branches.filter((b) => b.gym_id === gym.id);
            return (
              <details key={gym.id} className="group rounded-md border border-border bg-background transition-all hover:border-border-strong">
                <summary className="flex cursor-pointer items-center justify-between p-4 text-left list-none">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{gym.name}</p>
                    <EnterpriseStatusBadge status={gym.status} />
                    {gymBranches.length > 0 && (
                      <span className="text-xs font-semibold text-muted-foreground">{gymBranches.length} branch(es)</span>
                    )}
                    <span className="size-2 rounded-full bg-green-500" title="Admin assigned" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{gym.slug}</span>
                    <svg className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </summary>
                <div className="border-t border-border p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="text-xs text-muted-foreground">Timezone</p><p className="text-sm font-black">{gym.timezone}</p></div>
                    <div><p className="text-xs text-muted-foreground">Currency</p><p className="text-sm font-black">{gym.currency}</p></div>
                    <div><p className="text-xs text-muted-foreground">Branches</p><p className="text-sm font-black">{formatCompactNumber(gymBranches.length)}</p></div>
                  </div>
                  {gymBranches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Branches</p>
                      {gymBranches.map((branch) => (
                        <div key={branch.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{branch.name}</p>
                            <EnterpriseStatusBadge status={branch.status} />
                          </div>
                          <span className="text-xs text-muted-foreground">{branch.branch_code} · {formatCompactNumber(branch.capacity)} cap</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {gymBranches.length === 0 && (
                    <p className="text-xs font-semibold text-muted-foreground">No branches under this gym.</p>
                  )}
                </div>
              </details>
            );
          }) : (
            <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm font-semibold text-muted-foreground">No locations were found.</div>
          )}
          <DetailPaginationControls organizationId={data.record.organization.id} pageParam="gymsPage" pageSizeParam="gymsPageSize" pagination={data.listPagination.gyms} tab="gyms" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black">Branches</h3>
            <span className="text-sm text-muted-foreground">{branches.length} branch(es)</span>
          </div>
          {branches.length > 0 ? branches.map((branch) => (
            <div key={branch.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{branch.name}</p>
                <EnterpriseStatusBadge status={branch.status} />
                {branch.gym_id && <span className="text-xs text-muted-foreground">Gym: {gyms.find((g) => g.id === branch.gym_id)?.name ?? "Unknown"}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{branch.branch_code} · {branch.city ?? "No city"} · {formatCompactNumber(branch.capacity)} capacity</p>
            </div>
          )) : (
            <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm font-semibold text-muted-foreground">No branches were found.</div>
          )}
          <DetailPaginationControls organizationId={data.record.organization.id} pageParam="branchesPage" pageSizeParam="branchesPageSize" pagination={data.listPagination.branches} tab="gyms" />
        </div>
      </div>
    </section>
  );
}

function AuditTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Audit Timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Filter and export organization audit events</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/api/super-admin/organizations/export?scope=audit&organizationId=${data.record.organization.id}&format=csv`} variant="secondary" size="sm"><Download className="size-4" /> CSV</ButtonLink>
          <ButtonLink href={`/api/super-admin/organizations/export?scope=audit&organizationId=${data.record.organization.id}&format=pdf`} variant="secondary" size="sm"><Download className="size-4" /> PDF</ButtonLink>
        </div>
      </div>
      <form className="flex flex-wrap gap-3">
        <input name="tab" type="hidden" value="audit" />
        <input className="h-11 min-w-60 flex-1 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" name="auditQ" placeholder="Search events..." defaultValue={data.auditFilters.query} />
        <select className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary" name="severity" defaultValue={data.auditFilters.severity}>
          {["all", "info", "notice", "warning", "critical"].map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary" name="source" defaultValue={data.auditFilters.source}>
          {["all", "activity_events", "audit_logs"].map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
        </select>
        <Button type="submit" variant="primary">Filter</Button>
      </form>
      <div className="space-y-3">
        {data.auditTimeline.length > 0 ? data.auditTimeline.map((event) => (
          <AuditEventCard key={`${event.source}-${event.id}`} event={event} />
        )) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface py-16">
            <Activity className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-bold text-muted-foreground">No audit events match these filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditEventCard({ event }: { event: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>>["auditTimeline"][number] }) {
  const severityColor: Record<string, string> = {
    critical: "border-l-red-500 bg-red-50/50",
    warning: "border-l-amber-500 bg-amber-50/50",
    notice: "border-l-blue-500 bg-blue-50/50",
    info: "border-l-gray-400 bg-surface",
  };
  const severityBadge: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    notice: "bg-blue-100 text-blue-700",
    info: "bg-gray-100 text-gray-600",
  };

  return (
    <div className={`rounded-xl border border-border border-l-4 ${severityColor[event.severity] ?? "border-l-gray-400 bg-surface"} p-5 shadow-xs transition-shadow hover:shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${severityBadge[event.severity] ?? "bg-gray-100 text-gray-600"}`}>
            {formatEnterpriseLabel(event.severity)}
          </span>
          <span className="rounded-md bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
            {formatEnterpriseLabel(event.source)}
          </span>
          <p className="text-sm font-black">{formatEnterpriseLabel(event.action)}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {formatDateTime(event.createdAt)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UserIcon className="size-3" />
          {event.actorName ?? event.actorId ?? "System"}
        </span>
        {event.ipAddress && (
          <span className="flex items-center gap-1">
            <GlobeIcon className="size-3" />
            {event.ipAddress}
          </span>
        )}
        {event.userAgent && (
          <span className="flex items-center gap-1">
            <MonitorIcon className="size-3" />
            {compactUserAgent(event.userAgent)}
          </span>
        )}
      </div>
      <AuditDiffTable metadata={event.metadata} />
    </div>
  );
}

function AuditDiffTable({ metadata }: { metadata: Json }) {
  const diff = metadataDiff(metadata);
  if (diff.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50">
            <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Field</th>
            <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Before</th>
            <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">After</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((item, idx) => (
            <tr key={item.field} className={`${idx < diff.length - 1 ? "border-b border-border" : ""} transition-colors hover:bg-surface-muted/30`}>
              <td className="px-4 py-3 font-bold text-foreground">{item.label}</td>
              <td className="px-4 py-3">
                <span className="inline-block rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 line-through decoration-red-400">{item.before}</span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-block rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">{item.after}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}

function GlobeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}

function MonitorIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}

function compactUserAgent(ua: string): string {
  if (ua.length <= 60) return ua;
  const parts = ua.split(" ");
  if (parts.length > 3) return `${parts.slice(0, 3).join(" ")} ...`;
  return ua.slice(0, 57) + "...";
}

function SecurityTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  return (
    <section className="space-y-3">
      <RecordGrid emptyText="No security events were found." title="Security Events">
        {data.securityEvents.map((event) => (
          <div className="rounded-md border border-border bg-background p-4" key={event.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">{formatEnterpriseLabel(event.event_type)}</p>
              <EnterpriseStatusBadge status={event.severity} />
              <EnterpriseStatusBadge status={event.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatDateTime(event.created_at)} · {String(event.source_ip ?? "No source IP")}</p>
          </div>
        ))}
      </RecordGrid>
      <DetailPaginationControls organizationId={data.record.organization.id} pageParam="securityPage" pageSizeParam="securityPageSize" pagination={data.listPagination.security} tab="security" />
    </section>
  );
}

function DomainsTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  return (
    <section className="space-y-3">
      <RecordGrid emptyText="No domains were found." title="Domains">
        {data.domains.map((domain) => (
          <div className="rounded-md border border-border bg-background p-4" key={domain.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">{domain.domain}</p>
              <EnterpriseStatusBadge status={domain.status} />
              <EnterpriseStatusBadge status={domain.ssl_status} />
              {domain.is_primary ? <Badge variant="premium">Primary</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{formatEnterpriseLabel(domain.domain_type)} · {formatEnterpriseLabel(domain.routing_mode)} · {formatDateTime(domain.updated_at)}</p>
          </div>
        ))}
      </RecordGrid>
      <DetailPaginationControls organizationId={data.record.organization.id} pageParam="domainsPage" pageSizeParam="domainsPageSize" pagination={data.listPagination.domains} tab="domains" />
    </section>
  );
}

function InfoCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xl font-black">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function RecordGrid({ children, emptyText, title }: { children: ReactNode; emptyText: string; title: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  return (
    <Card>
      <CardHeader>
        <h3 className="text-2xl font-black">{title}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.isArray(items) && items.length === 0 ? <EmptyState text={emptyText} /> : items}
      </CardContent>
    </Card>
  );
}

function DetailPaginationControls({
  organizationId,
  pageParam,
  pageSizeParam,
  pagination,
  tab
}: {
  organizationId: string;
  pageParam: string;
  pageSizeParam: string;
  pagination: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>>["listPagination"][keyof NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>>["listPagination"]];
  tab: DetailTab;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 text-sm font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {pagination.from}-{pagination.to} of {formatCompactNumber(pagination.total)} records.
      </span>
      <div className="flex gap-2">
        <ButtonLink aria-disabled={pagination.page <= 1} href={buildDetailPaginationUrl({ organizationId, page: pagination.page - 1, pageParam, pageSizeParam, pageSize: pagination.pageSize, tab })} size="sm" variant="secondary">
          Previous
        </ButtonLink>
        <ButtonLink aria-disabled={pagination.page >= pagination.totalPages} href={buildDetailPaginationUrl({ organizationId, page: pagination.page + 1, pageParam, pageSizeParam, pageSize: pagination.pageSize, tab })} size="sm" variant="secondary">
          Next
        </ButtonLink>
      </div>
    </div>
  );
}

function buildDetailPaginationUrl({
  organizationId,
  page,
  pageParam,
  pageSize,
  pageSizeParam,
  tab
}: {
  organizationId: string;
  page: number;
  pageParam: string;
  pageSize: number;
  pageSizeParam: string;
  tab: DetailTab;
}) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set(pageParam, String(Math.max(1, page)));
  params.set(pageSizeParam, String(pageSize));
  return `/super-admin/organizations/${organizationId}?${params.toString()}`;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-black">{value}</span>
    </div>
  );
}

function HealthBadge({ score, status }: { score: number; status: "good" | "watch" | "risk" }) {
  const variant = status === "good" ? "success" : status === "watch" ? "warning" : "error";
  return <Badge variant={variant}><HeartPulse aria-hidden="true" className="mr-1 size-3" />{score}/100</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}

function businessProfile(settings: Json) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return emptyBusinessProfile();
  }

  const root = settings as Record<string, Json | undefined>;
  const profile = root.businessProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return emptyBusinessProfile();
  }

  const value = profile as Record<string, Json | undefined>;
  return {
    legalName: stringValue(value.legalName),
    gstNumber: stringValue(value.gstNumber),
    phone: stringValue(value.phone),
    address: stringValue(value.address)
  };
}

function emptyBusinessProfile() {
  return {
    legalName: "",
    gstNumber: "",
    phone: "",
    address: ""
  };
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

function limitLabel(value: number | null) {
  if (value === null) {
    return "Not configured";
  }
  return value === -1 ? "Unlimited" : formatCompactNumber(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDetailTab(value: string | undefined): value is DetailTab {
  return Boolean(value && tabs.includes(value as DetailTab));
}

function metadataDiff(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const diff = (metadata as Record<string, Json | undefined>).diff;
  if (!Array.isArray(diff)) {
    return [];
  }

  return diff.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const value = item as Record<string, Json | undefined>;
    const field = typeof value.field === "string" ? value.field : "";
    const label = typeof value.label === "string" ? value.label : field;
    const before = typeof value.before === "string" ? value.before : "";
    const after = typeof value.after === "string" ? value.after : "";

    return field && label ? [{ field, label, before, after }] : [];
  });
}
