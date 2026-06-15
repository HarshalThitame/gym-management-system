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

const tabs = ["profile", "governance", "users", "gyms", "billing", "audit", "security", "domains"] as const;
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

      <nav className="flex gap-2 overflow-x-auto rounded-md border border-border bg-surface p-2">
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
      {activeTab === "gyms" ? <GymsTab data={data} /> : null}
      {activeTab === "billing" ? <BillingTab data={data} /> : null}
      {activeTab === "audit" ? <AuditTab data={data} /> : null}
      {activeTab === "security" ? <SecurityTab data={data} /> : null}
      {activeTab === "domains" ? <DomainsTab data={data} /> : null}
    </div>
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
          <Line label="Maker-checker" value="Required for transfer, suspend, delete, purge, bulk suspend, package assignment" />
          <Line label="Requester approval" value="Blocked" />
        </InfoCard>
      </div>
      <OrganizationGovernanceControlPanel criticalSuperAdminEmail={criticalSuperAdminEmail} record={data.record} />
      <OrganizationApprovalReviewPanel approvals={data.approvalRequests} criticalSuperAdminEmail={criticalSuperAdminEmail} />
    </section>
  );
}

function ProfileTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  const profile = businessProfile(data.record.organization.settings);

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <InfoCard title="Organization Profile" icon={<Building2 className="size-5" />}>
        <Line label="Name" value={data.record.organization.name} />
        <Line label="Slug" value={data.record.organization.slug} />
        <Line label="Type" value={formatEnterpriseLabel(data.record.organization.organization_type)} />
        <Line label="Status" value={formatEnterpriseLabel(data.record.organization.status)} />
        <Line label="Primary domain" value={data.record.organization.primary_domain ?? "Not configured"} />
      </InfoCard>
      <InfoCard title="Business Details" icon={<CreditCard className="size-5" />}>
        <Line label="Legal name" value={profile.legalName || "Not configured"} />
        <Line label="GST" value={profile.gstNumber || "Not configured"} />
        <Line label="Billing email" value={data.record.organization.billing_email ?? "Not configured"} />
        <Line label="Phone" value={profile.phone || "Not configured"} />
        <Line label="Address" value={profile.address || "Not configured"} />
      </InfoCard>
      <InfoCard title="Usage Summary" icon={<Activity className="size-5" />}>
        <Line label="Locations" value={formatCompactNumber(data.record.usage.gyms)} />
        <Line label="Branches" value={`${data.record.usage.activeBranches}/${data.record.usage.branches}`} />
        <Line label="Active members" value={formatCompactNumber(data.record.usage.activeMembers)} />
        <Line label="Staff" value={formatCompactNumber(data.record.usage.staff)} />
        <Line label="Trainers" value={formatCompactNumber(data.record.usage.trainers)} />
      </InfoCard>
    </section>
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
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-3">
        <RecordGrid emptyText="No locations were found." title="Locations">
          {data.gyms.map((gym) => (
            <div className="rounded-md border border-border bg-background p-4" key={gym.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{gym.name}</p>
                <EnterpriseStatusBadge status={gym.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{gym.slug} · {gym.timezone} · {gym.currency}</p>
            </div>
          ))}
        </RecordGrid>
        <DetailPaginationControls organizationId={data.record.organization.id} pageParam="gymsPage" pageSizeParam="gymsPageSize" pagination={data.listPagination.gyms} tab="gyms" />
      </div>
      <div className="space-y-3">
        <RecordGrid emptyText="No branches were found." title="Branches">
          {data.branches.map((branch) => (
            <div className="rounded-md border border-border bg-background p-4" key={branch.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{branch.name}</p>
                <EnterpriseStatusBadge status={branch.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{branch.branch_code} · {branch.city ?? "No city"} · {formatCompactNumber(branch.capacity)} capacity</p>
            </div>
          ))}
        </RecordGrid>
        <DetailPaginationControls organizationId={data.record.organization.id} pageParam="branchesPage" pageSizeParam="branchesPageSize" pagination={data.listPagination.branches} tab="gyms" />
      </div>
    </section>
  );
}

function BillingTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <InfoCard title="Subscription" icon={<CreditCard className="size-5" />}>
        <Line label="Package" value={data.record.subscription.packageName ?? "Unassigned"} />
        <Line label="Status" value={data.record.subscription.status ? formatEnterpriseLabel(data.record.subscription.status) : "Unassigned"} />
        <Line label="Started" value={formatDate(data.record.subscription.startedAt)} />
        <Line label="Expires" value={data.record.subscription.expiresAt ? formatDate(data.record.subscription.expiresAt) : "Never"} />
        <Line label="Member limit" value={limitLabel(data.record.subscription.maxMembers)} />
        <Line label="Branch limit" value={limitLabel(data.record.subscription.maxBranches)} />
      </InfoCard>
      <RecordGrid emptyText="No payments were found." title="Recent Payments">
        {data.recentPayments.map((payment) => (
          <div className="rounded-md border border-border bg-background p-4" key={payment.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">{payment.payment_number}</p>
              <EnterpriseStatusBadge status={payment.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(Number(payment.amount), payment.currency)} · {formatEnterpriseLabel(payment.method)} · {formatDateTime(payment.created_at)}</p>
          </div>
        ))}
      </RecordGrid>
    </section>
  );
}

function AuditTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getOrganizationDetailData>>> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-2xl font-black">Audit Timeline</h3>
            <p className="text-sm leading-6 text-muted-foreground">Filter by action, severity, source, actor, IP, device, or metadata. Exports include the current organization scope.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/api/super-admin/organizations/export?scope=audit&organizationId=${data.record.organization.id}&format=csv`} variant="secondary"><Download aria-hidden="true" className="size-4" />CSV</ButtonLink>
            <ButtonLink href={`/api/super-admin/organizations/export?scope=audit&organizationId=${data.record.organization.id}&format=pdf`} variant="secondary"><Download aria-hidden="true" className="size-4" />PDF</ButtonLink>
          </div>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <input name="tab" type="hidden" value="audit" />
          <input className="h-11 rounded-md border border-border bg-surface px-3" name="auditQ" placeholder="Search audit events" defaultValue={data.auditFilters.query} />
          <select className="h-11 rounded-md border border-border bg-surface px-3" name="severity" defaultValue={data.auditFilters.severity}>
            {["all", "info", "notice", "warning", "critical"].map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
          </select>
          <select className="h-11 rounded-md border border-border bg-surface px-3" name="source" defaultValue={data.auditFilters.source}>
            {["all", "activity_events", "audit_logs"].map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
          </select>
          <Button type="submit" variant="primary">Filter</Button>
        </form>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.auditTimeline.length > 0 ? data.auditTimeline.map((event) => (
          <div className="rounded-md border border-border bg-background p-4" key={`${event.source}-${event.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <EnterpriseStatusBadge status={event.severity} />
              <EnterpriseStatusBadge status={event.source} />
              <p className="font-black">{formatEnterpriseLabel(event.action)}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(event.createdAt)} · {event.actorName ?? event.actorId ?? "System"} · {event.ipAddress ?? "No IP"}</p>
            <p className="mt-1 break-words text-xs font-semibold text-muted-foreground">{event.userAgent ?? "No device captured"}</p>
            <AuditDiffTable metadata={event.metadata} />
            <details className="mt-3 rounded-md border border-border bg-surface p-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Technical metadata</summary>
              <pre className="mt-3 max-h-40 overflow-auto text-xs text-muted-foreground">{JSON.stringify(event.metadata, null, 2)}</pre>
            </details>
          </div>
        )) : <EmptyState text="No audit events match these filters." />}
      </CardContent>
    </Card>
  );
}

function AuditDiffTable({ metadata }: { metadata: Json }) {
  const diff = metadataDiff(metadata);
  if (diff.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Before</th>
            <th className="px-3 py-2">After</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((item) => (
            <tr className="border-b border-border last:border-0" key={item.field}>
              <td className="px-3 py-2 font-black">{item.label}</td>
              <td className="max-w-xs break-words px-3 py-2 text-muted-foreground">{item.before}</td>
              <td className="max-w-xs break-words px-3 py-2 font-semibold">{item.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatDateTime(event.created_at)} · {event.source_ip ?? "No source IP"}</p>
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
