"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  HeartPulse,
  KeyRound,
  ListChecks,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Tags,
  Trash2,
  UserRoundCog
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { organizationStatuses } from "@/types/enterprise";
import type { Json } from "@/types/database";
import {
  bulkOrganizationAction,
  organizationLifecycleAction,
  saveSuperAdminOrganizationAction,
  transferOrganizationOwnerAction
} from "../../actions/organization-actions";
import type { OrganizationManagementData, OrganizationManagementRecord, OrganizationOwnerCandidate } from "../../services/organization-management-service";
import { PackageBadge } from "../subscriptions/PackageBadge";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";
const organizationSortOptions = ["created_desc", "name_asc", "health_asc", "revenue_desc", "members_desc"] as const;
type LifecycleAction = "suspend" | "activate" | "delete" | "restore" | "purge";

type DrawerState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; record: OrganizationManagementRecord }
  | { type: "transfer"; record: OrganizationManagementRecord }
  | { type: "lifecycle"; record: OrganizationManagementRecord; action: LifecycleAction }
  | { type: "bulk"; selectedIds: string[] };

export function OrganizationManagementWorkspace({ criticalSuperAdminEmail, data }: { criticalSuperAdminEmail: string; data: OrganizationManagementData }) {
  const router = useRouter();
  const [query, setQuery] = useState(data.filters.query);
  const [status, setStatus] = useState(data.filters.status);
  const [sort, setSort] = useState(data.filters.sort);
  const [pageSize, setPageSize] = useState(String(data.filters.pageSize));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>({ type: "closed" });
  const selectedVisibleCount = data.records.filter((record) => selectedIds.includes(record.organization.id)).length;
  const allVisibleSelected = data.records.length > 0 && selectedVisibleCount === data.records.length;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => data.records.some((record) => record.organization.id === id)));
  }, [data.records]);

  function applyFilters(nextPage = 1) {
    router.push(buildOrganizationsUrl({
      q: query,
      status,
      sort,
      page: String(nextPage),
      pageSize
    }));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !data.records.some((record) => record.organization.id === id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...data.records.map((record) => record.organization.id)])));
  }

  return (
    <div className="space-y-5">
      <div className="bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-5 px-5 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Organizations</h1>
          <Button onClick={() => setDrawer({ type: "create" })} variant="accent">
            <Plus aria-hidden="true" className="size-4" />
            Create Organization
          </Button>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: <Building2 className="size-5" />, label: "Organizations", value: formatCompactNumber(data.summary.totalOrganizations) },
            { icon: <HeartPulse className="size-5" />, label: "Avg health", value: `${data.summary.averageHealthScore}/100` },
            { icon: <ShieldAlert className="size-5" />, label: "Pending approvals", value: formatCompactNumber(data.summary.pendingApprovals) },
            { icon: <KeyRound className="size-5" />, label: "Unassigned plans", value: formatCompactNumber(data.summary.unassignedPlans) }
          ].map((kpi, i) => (
            <div key={kpi.label}
              className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong"
              style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-3xl font-black text-foreground">{kpi.value}</p>
                </div>
                <div className="grid size-11 place-items-center rounded-md bg-accent/20">{kpi.icon}</div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-2xl font-black">Organization Registry</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Create tenants, govern lifecycle, transfer ownership, and review tenant health from one controlled workspace.</p>
            </div>
          </div>
          <form
            className="sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border py-3 -mx-5 px-5 mt-5 grid gap-3 xl:grid-cols-[1fr_190px_190px_140px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters(1);
            }}
          >
            <label className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search by organization, owner, domain, package..." value={query} />
            </label>
            <select aria-label="Filter organizations by status" className={selectClass} onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="all">All statuses</option>
              {organizationStatuses.map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
            </select>
            <select aria-label="Sort organizations" className={selectClass} onChange={(event) => setSort(event.target.value as typeof data.filters.sort)} value={sort}>
              {organizationSortOptions.map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
            </select>
            <select aria-label="Rows per page" className={selectClass} onChange={(event) => setPageSize(event.target.value)} value={pageSize}>
              {[6, 12, 24, 50].map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
            <Button type="submit" variant="primary">Apply</Button>
          </form>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              Showing {data.pagination.from}-{data.pagination.to} of {formatCompactNumber(data.pagination.total)} organizations.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={toggleAllVisible} variant="secondary">
                <ListChecks aria-hidden="true" className="size-4" />
                {allVisibleSelected ? "Clear Page" : "Select Page"}
              </Button>
              <Button disabled={selectedIds.length === 0} onClick={() => setDrawer({ type: "bulk", selectedIds })} variant="secondary">
                <Tags aria-hidden="true" className="size-4" />
                Bulk Actions {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
              </Button>
              <ButtonLink href={buildExportUrl(data.filters, "csv")} variant="secondary">
                <Download aria-hidden="true" className="size-4" />
                CSV
              </ButtonLink>
              <ButtonLink href={buildExportUrl(data.filters, "pdf")} variant="secondary">
                <Download aria-hidden="true" className="size-4" />
                PDF
              </ButtonLink>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        {data.records.length > 0 ? data.records.map((record) => (
          <OrganizationCard
            key={record.organization.id}
            onDelete={() => setDrawer({ type: "lifecycle", record, action: "delete" })}
            onEdit={() => setDrawer({ type: "edit", record })}
            onLifecycle={(action) => setDrawer({ type: "lifecycle", record, action })}
            onTransfer={() => setDrawer({ type: "transfer", record })}
            onToggleSelected={() => {
              setSelectedIds((current) => current.includes(record.organization.id)
                ? current.filter((id) => id !== record.organization.id)
                : [...current, record.organization.id]);
            }}
            record={record}
            selected={selectedIds.includes(record.organization.id)}
          />
        )) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg font-black">No organizations match these filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">Clear search filters or create a new tenant organization.</p>
              <Button className="mt-5" onClick={() => setDrawer({ type: "create" })} variant="accent">
                <Plus aria-hidden="true" className="size-4" />
                Create Organization
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <PaginationControls data={data} onPageChange={applyFilters} />
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right">
          <span className="text-sm font-black">{selectedIds.length} selected</span>
          <div className="w-px h-5 bg-border" />
          <button onClick={() => setDrawer({ type: "bulk", selectedIds })} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted transition-all">
            <Tags className="size-4" /> Bulk Actions
          </button>
          <button onClick={() => setSelectedIds([])} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted transition-all">
            Clear
          </button>
        </div>
      )}
      <OrganizationDrawer criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} drawer={drawer} onClose={() => setDrawer({ type: "closed" })} />
    </div>
  );
}

function OrganizationCard({
  onDelete,
  onEdit,
  onLifecycle,
  onToggleSelected,
  onTransfer,
  record,
  selected
}: {
  onDelete: () => void;
  onEdit: () => void;
  onLifecycle: (action: LifecycleAction) => void;
  onToggleSelected: () => void;
  onTransfer: () => void;
  record: OrganizationManagementRecord;
  selected: boolean;
}) {
  const organization = record.organization;
  const canActivate = organization.status === "suspended" || organization.status === "deactivated";
  const canSuspend = organization.status === "active" || organization.status === "trial";
  const canRestore = organization.status === "archived" && record.softDelete.restoreAvailable;
  const canPurge = organization.status === "archived" && record.purgeEligibility.eligible;
  const detailUrl = `/super-admin/organizations/${organization.id}`;

  return (
    <div
      className="group relative rounded-xl border border-border bg-surface shadow-xs transition-all hover:shadow-md hover:border-border-strong"
    >
      {/* Clickable header banner */}
      <a
        href={detailUrl}
        className="block rounded-t-xl border-b border-border bg-gradient-to-r from-background to-surface-muted/30 transition-colors hover:from-accent/5 hover:to-accent/10"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <input
              aria-label={`Select ${organization.name}`}
              checked={selected}
              className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
              onClick={(e) => e.stopPropagation()}
              onChange={onToggleSelected}
              type="checkbox"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black group-hover:text-primary transition-colors">
                  {organization.name}
                </h3>
                <EnterpriseStatusBadge status={organization.status} />
                <HealthBadge record={record} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{organization.primary_domain ?? organization.slug}</span>
                <span className="text-border-strong">|</span>
                <span>{record.owner?.fullName ?? "Unassigned owner"}</span>
                {organization.billing_email ? (
                  <>
                    <span className="text-border-strong">|</span>
                    <span>{organization.billing_email}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!record.deletionProtection.canDelete && (
              <Badge variant="warning" className="shrink-0">
                <Lock className="mr-1 size-3" />Protected
              </Badge>
            )}
            {record.pendingApprovalCount > 0 && (
              <Badge variant="warning" className="shrink-0">
                <ShieldAlert className="mr-1 size-3" />{record.pendingApprovalCount} Pending
              </Badge>
            )}
            {record.softDelete.restoreAvailable && (
              <Badge variant="premium" className="shrink-0">
                <RotateCcw className="mr-1 size-3" />Restorable
              </Badge>
            )}
            {record.tags.length > 0 && record.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="neutral" className="shrink-0">{tag}</Badge>
            ))}
            {record.tags.length > 2 && (
              <Badge variant="neutral" className="shrink-0">+{record.tags.length - 2}</Badge>
            )}
          </div>
        </div>
      </a>

      {/* Metrics grid */}
      <div className="grid gap-px bg-border xl:grid-cols-3">
        <div className="bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Usage</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricBlock label="Branches" value={`${record.usage.activeBranches}/${record.usage.branches}`} />
            <MetricBlock label="Members" value={formatCompactNumber(record.usage.activeMembers)} />
            <MetricBlock label="Revenue" value={formatCurrency(record.usage.revenue)} />
          </div>
        </div>
        <div className="bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Subscription</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PackageBadge packageName={record.subscription.packageName} />
            {record.subscription.status ? (
              <span className="text-xs font-semibold text-muted-foreground">
                {formatEnterpriseLabel(record.subscription.status)}
              </span>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">No plan</span>
            )}
          </div>
          {record.subscription.expiresAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Expires <HydrationSafeDate date={record.subscription.expiresAt} />
            </p>
          )}
        </div>
        <div className="bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Quick Actions</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <a
              href={detailUrl}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
            >
              <ExternalLink className="size-3" /> Open
            </a>
            <button onClick={onEdit} type="button" className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-border hover:text-foreground">
              <Edit3 className="size-3" /> Edit
            </button>
            <button onClick={onTransfer} type="button" className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-border hover:text-foreground">
              <UserRoundCog className="size-3" /> Transfer
            </button>
            {canSuspend && (
              <button onClick={() => onLifecycle("suspend")} type="button" className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100">
                <AlertTriangle className="size-3" /> Suspend
              </button>
            )}
            {canActivate && (
              <button onClick={() => onLifecycle("activate")} type="button" className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 transition-colors hover:bg-green-100">
                <CheckCircle2 className="size-3" /> Activate
              </button>
            )}
            {canRestore && (
              <button onClick={() => onLifecycle("restore")} type="button" className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100">
                <RotateCcw className="size-3" /> Restore
              </button>
            )}
            {organization.status !== "archived" && (
              <button onClick={onDelete} type="button" className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700">
                <Trash2 className="size-3" /> Delete
              </button>
            )}
            {canPurge && (
              <button onClick={() => onLifecycle("purge")} type="button" className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800 transition-colors hover:bg-red-100">
                <Trash2 className="size-3" /> Purge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-black">{value}</p>
    </div>
  );
}

function UsageSummary({ record }: { record: OrganizationManagementRecord }) {
  return (
    <section className="rounded-md border border-border bg-background p-4">
      <h4 className="font-black">Usage Summary</h4>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <UsageMetric label="Gyms" value={record.usage.gyms} />
        <UsageMetric label="Branches" value={`${record.usage.activeBranches}/${record.usage.branches}`} />
        <UsageMetric label="Members" value={record.usage.activeMembers} />
        <UsageMetric label="Trainers" value={record.usage.trainers} />
        <UsageMetric label="Staff" value={record.usage.staff} />
        <UsageMetric label="Domains" value={record.usage.domains} />
      </div>
      <div className="mt-4 rounded-md border border-border bg-surface p-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Revenue</p>
        <p className="mt-1 text-xl font-black">{formatCurrency(record.usage.revenue)}</p>
      </div>
      <div className="mt-4 rounded-md border border-border bg-surface p-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Health Signals</p>
        <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-muted-foreground">
          {record.health.factors.slice(0, 3).map((factor) => <li key={factor}>{factor}</li>)}
        </ul>
      </div>
    </section>
  );
}

function HealthBadge({ record }: { record: OrganizationManagementRecord }) {
  const variant = record.health.status === "good" ? "success" : record.health.status === "watch" ? "warning" : "error";
  return <Badge variant={variant}><HeartPulse aria-hidden="true" className="mr-1 size-3" />{record.health.score}/100 {record.health.label}</Badge>;
}

function OrganizationDrawer({ data, drawer, onClose }: { criticalSuperAdminEmail?: string; data: OrganizationManagementData; drawer: DrawerState; onClose: () => void }) {
  if (drawer.type === "closed") {
    return null;
  }

  if (drawer.type === "create" || drawer.type === "edit") {
    return <OrganizationEditDrawer data={data} onClose={onClose} record={drawer.type === "edit" ? drawer.record : null} />;
  }

  if (drawer.type === "transfer") {
    return <TransferOwnerDrawer candidates={data.ownerCandidates} onClose={onClose} record={drawer.record} />;
  }

  if (drawer.type === "bulk") {
    return <BulkActionDrawer data={data} onClose={onClose} selectedIds={drawer.selectedIds} />;
  }

  return <LifecycleConfirmDrawer action={drawer.action} onClose={onClose} record={drawer.record} />;
}

function OrganizationEditDrawer({ data, onClose, record }: { data: OrganizationManagementData; onClose: () => void; record: OrganizationManagementRecord | null }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveSuperAdminOrganizationAction, initialAuthActionState);
  const profile = businessProfile(record?.organization.settings);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.status]);

  return (
    <DrawerShell onClose={onClose} title={record ? "Edit Organization" : "Create Organization"}>
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="organizationId" suppressHydrationWarning type="hidden" value={record?.organization.id ?? ""} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.name?.[0]} label="Organization name">
            <Input name="name" placeholder="Apex Fitness Group" required defaultValue={record?.organization.name ?? ""} />
          </Field>
          <Field error={state.fieldErrors?.slug?.[0]} label="Slug">
            <Input name="slug" placeholder="apex-fitness-group" defaultValue={record?.organization.slug ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField defaultValue={record?.organization.status ?? "active"} label="Status" name="status" options={organizationStatuses} />
          <Field error={state.fieldErrors?.billingEmail?.[0]} label="Billing email">
            <Input name="billingEmail" placeholder="billing@apexfit.com" type="email" defaultValue={record?.organization.billing_email ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.primaryDomain?.[0]} label="Primary domain">
            <Input name="primaryDomain" placeholder="apexfit.com" defaultValue={record?.organization.primary_domain ?? ""} />
          </Field>
          <SelectOwner candidates={data.ownerCandidates} defaultValue={record?.organization.owner_user_id ?? ""} error={state.fieldErrors?.ownerUserId?.[0]} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.legalName?.[0]} label="Legal name">
            <Input name="legalName" placeholder="Apex Fitness Private Limited" defaultValue={profile.legalName} />
          </Field>
          <Field error={state.fieldErrors?.gstNumber?.[0]} label="GST number">
            <Input name="gstNumber" placeholder="27ABCDE1234F1Z5" defaultValue={profile.gstNumber} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.phone?.[0]} label="Phone">
            <Input name="phone" placeholder="+91 90000 00000" defaultValue={profile.phone} />
          </Field>
          <Field error={state.fieldErrors?.address?.[0]} label="Address">
            <Input name="address" placeholder="Registered business address" defaultValue={profile.address} />
          </Field>
        </div>
        <Field error={state.fieldErrors?.supportNotes?.[0]} label="Internal Super Admin notes">
          <Textarea className="min-h-24" name="supportNotes" placeholder="Commercial, onboarding, or risk notes visible only to Super Admins." defaultValue={profile.supportNotes} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
          <SubmitButton>{record ? "Save Changes" : "Create Organization"}</SubmitButton>
        </div>
      </form>
    </DrawerShell>
  );
}

function TransferOwnerDrawer({ candidates, onClose, record }: { candidates: OrganizationOwnerCandidate[]; criticalSuperAdminEmail?: string; onClose: () => void; record: OrganizationManagementRecord }) {
  const router = useRouter();
  const [state, formAction] = useActionState(transferOrganizationOwnerAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.status]);

  return (
    <DrawerShell onClose={onClose} title="Transfer Ownership">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="organizationId" suppressHydrationWarning type="hidden" value={record.organization.id} />
        <InlineMfaStepUp />
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm font-black">{record.organization.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">Current owner: {record.owner?.fullName ?? "Unassigned"}</p>
        </div>
        <SelectOwner candidates={candidates} defaultValue="" error={state.fieldErrors?.newOwnerUserId?.[0]} label="New owner" name="newOwnerUserId" />
        <Field error={state.fieldErrors?.reason?.[0]} label="Transfer reason">
          <Textarea className="min-h-24" name="reason" placeholder="Reason for audit trail." />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
          <SubmitButton>Request Transfer</SubmitButton>
        </div>
      </form>
    </DrawerShell>
  );
}

function BulkActionDrawer({ data, onClose, selectedIds }: { criticalSuperAdminEmail?: string; data: OrganizationManagementData; onClose: () => void; selectedIds: string[] }) {
  const deleteReasons = ["GDPR Request", "Duplicate Account", "Fraud", "Abandoned", "Other"];
  const router = useRouter();
  const [state, formAction] = useActionState(bulkOrganizationAction, initialAuthActionState);
  const [action, setAction] = useState("suspend");
  const selectedRecords = data.records.filter((record) => selectedIds.includes(record.organization.id));

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.status]);

  return (
    <DrawerShell onClose={onClose} title="Bulk Organization Actions">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        {selectedIds.map((id) => <input key={id} name="organizationIds" suppressHydrationWarning type="hidden" value={id} />)}
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm font-black">{selectedIds.length} organization(s) selected</p>
          <p className="mt-2 text-sm text-muted-foreground">{selectedRecords.map((record) => record.organization.name).join(", ") || "Selected organizations may be on another page."}</p>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-bold">Bulk action</span>
          <select className={selectClass} name="action" onChange={(event) => setAction(event.target.value)} value={action}>
            <option value="suspend">Suspend organizations</option>
            <option value="activate">Activate organizations</option>
            <option value="assign_package">Assign package</option>
            <option value="tag">Add tags</option>
            <option value="delete">Delete organizations</option>
          </select>
        </label>
        {action === "assign_package" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field error={state.fieldErrors?.packageId?.[0]} label="Package">
              <select className={selectClass} name="packageId">
                <option value="">Select package</option>
                {data.packages.map((packageRow) => <option key={packageRow.id} value={packageRow.id}>{packageRow.name}</option>)}
              </select>
            </Field>
            <label className="space-y-2">
              <span className="text-sm font-bold">Subscription status</span>
              <select className={selectClass} defaultValue="active" name="status">
                {["active", "trial", "expired", "suspended", "cancelled"].map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
              </select>
            </label>
          </div>
        ) : null}
        {action === "tag" ? (
          <Field error={state.fieldErrors?.tags?.[0]} label="Tags">
            <Input name="tags" placeholder="enterprise, priority, migration" />
          </Field>
        ) : null}
        {action === "delete" ? (
          <label className="space-y-2">
            <span className="text-sm font-bold">Delete reason</span>
            <select className={selectClass} name="deleteReason" defaultValue="">
              <option value="">Select a reason</option>
              {deleteReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            <FieldError message={state.fieldErrors?.deleteReason?.[0]} />
          </label>
        ) : null}
        {action === "delete" ? (
          <Field error={state.fieldErrors?.confirmation?.[0]} label={`Type BULK_DELETE:${selectedIds.length} to confirm`}>
            <Input name="confirmation" placeholder={`BULK_DELETE:${selectedIds.length}`} />
          </Field>
        ) : (
          <Field error={state.fieldErrors?.confirmation?.[0]} label='Type BULK to confirm'>
            <Input name="confirmation" placeholder="BULK" />
          </Field>
        )}
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason">
          <Textarea className="min-h-24" name="reason" placeholder="Reason for bulk operation." />
        </Field>
        <InlineMfaStepUp />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          {action === "delete"
            ? "Bulk deletion is permanent (soft-delete with 30-day restore window). This action is rate-limited to 1 request per 120 seconds."
            : "Bulk suspension and bulk package assignment create MFA-protected approval requests per organization."}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
          <SubmitButton variant={action === "suspend" || action === "delete" ? "destructive" : "primary"}>Run Bulk Action</SubmitButton>
        </div>
      </form>
    </DrawerShell>
  );
}

function LifecycleConfirmDrawer({ action, onClose, record }: { action: LifecycleAction; criticalSuperAdminEmail?: string; onClose: () => void; record: OrganizationManagementRecord }) {
  const router = useRouter();
  const [state, formAction] = useActionState(organizationLifecycleAction, initialAuthActionState);
  const isDelete = action === "delete";
  const isRestore = action === "restore";
  const isPurge = action === "purge";

  const [forceDelete, setForceDelete] = useState(false);
  const [forceConfirmation, setForceConfirmation] = useState("");
  const [forceConfirmation2, setForceConfirmation2] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.status]);

  return (
    <DrawerShell onClose={onClose} title={action === "suspend" ? "Suspend Organization" : action === "activate" ? "Activate Organization" : isRestore ? "Restore Organization" : isPurge ? "Permanent Purge Request" : "Soft Delete Organization"}>
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="organizationId" suppressHydrationWarning type="hidden" value={record.organization.id} />
        <input name="action" suppressHydrationWarning type="hidden" value={action} />
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm font-black">{record.organization.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{record.organization.primary_domain ?? record.organization.slug}</p>
        </div>
        <Field error={state.fieldErrors?.reason?.[0]} label="Reason">
          <Textarea className="min-h-24" name="reason" placeholder="Reason for audit trail." />
        </Field>
        <InlineMfaStepUp />

        {isDelete && (
          <label className="flex items-center gap-3 rounded-md border border-border bg-background p-4">
            <input
              type="checkbox"
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              className="size-4 rounded border-border accent-destructive"
            />
            <div>
              <p className="text-sm font-black text-destructive">Emergency: Bypass approval and delete immediately</p>
              <p className="mt-1 text-xs text-muted-foreground">This will skip the maker-checker approval flow.</p>
            </div>
          </label>
        )}

        <input name="forceDelete" type="hidden" value={isDelete && forceDelete ? "true" : ""} />

        {isDelete && forceDelete && (
          <div className="space-y-4 rounded-md border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2 text-sm font-semibold leading-6 text-red-800">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <span>Deleting this organization immediately will permanently remove all associated data. This action cannot be undone.</span>
            </div>
            {record.usage.branches > 0 && (
              <div className="rounded-md border border-red-200 bg-red-100 p-3 text-sm font-semibold text-red-800">
                Blockers: {record.usage.branches} active branch(es), {record.usage.activeMembers} active member(s), {record.usage.gyms} gym(s)
              </div>
            )}
            <Field error={state.fieldErrors?.confirmation?.[0]} label='Type the organization slug to confirm'>
              <Input name="confirmation" placeholder={record.organization.slug} value={forceConfirmation} onChange={(e) => setForceConfirmation(e.target.value)} />
            </Field>
            <Field label='Type "I UNDERSTAND THE CONSEQUENCES" to proceed'>
              <Input name="forceConfirm" placeholder="I UNDERSTAND THE CONSEQUENCES" value={forceConfirmation2} onChange={(e) => setForceConfirmation2(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">
          {isDelete && !forceDelete
            ? "Soft delete creates an approval request. If approved, the tenant is archived and can be restored for 30 days."
            : isDelete && forceDelete
              ? "Force delete bypasses approval. The organization will be archived immediately with all auth users deleted."
              : isRestore
                ? "Restore reactivates a soft-deleted tenant inside its restore window and is fully audited."
                : isPurge
                  ? "Permanent purge creates an approval request. If approved, customer-identifying data is purged to a retained governance tombstone."
                  : action === "suspend"
                    ? "Suspension creates an approval request. Tenant access changes only after another Super Admin approves it."
                    : "Activation applies immediately after MFA and is audited."}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">Close</Button>
          <SubmitButton variant={action === "suspend" || action === "delete" || action === "purge" ? "destructive" : "primary"}>{isDelete && forceDelete ? "Force Delete Immediately" : action === "delete" ? "Request Soft Delete" : action === "purge" ? "Request Purge" : action === "suspend" ? "Request Suspension" : isRestore ? "Restore Organization" : "Activate Organization"}</SubmitButton>
        </div>
      </form>
    </DrawerShell>
  );
}

function DrawerShell({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border p-5">
          <h3 className="text-2xl font-black">{title}</h3>
          <Button aria-label="Close drawer" onClick={onClose} size="sm" type="button" variant="secondary">Close</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}

function SelectOwner({ candidates, defaultValue, error, label = "Owner", name = "ownerUserId" }: { candidates: OrganizationOwnerCandidate[]; defaultValue: string; error: string | undefined; label?: string; name?: string }) {
  return (
    <Field error={error} label={label}>
      <select className={selectClass} defaultValue={defaultValue} name={name}>
        <option value="">Unassigned</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.fullName} {candidate.email ? `(${candidate.email})` : ""}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SelectField<T extends readonly string[]>({ defaultValue, label, name, options }: { defaultValue: string; label: string; name: string; options: T }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-bold">{label}</span>
      <select className={selectClass} defaultValue={defaultValue} name={name}>
        {options.map((option) => <option key={option} value={option}>{formatEnterpriseLabel(option)}</option>)}
      </select>
    </label>
  );
}

function Field({ children, error, label }: { children: ReactNode; error?: string | undefined; label: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-bold">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function SubmitButton({ children, variant = "primary" }: { children: string; variant?: "primary" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" variant={variant}>
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? "Processing" : children}
    </Button>
  );
}

function UsageMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{typeof value === "number" ? formatCompactNumber(value) : value}</p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-black">{value}</span>
    </div>
  );
}

function PaginationControls({ data, onPageChange }: { data: OrganizationManagementData; onPageChange: (page: number) => void }) {
  if (data.pagination.totalPages <= 1) {
    return null;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          Page {data.pagination.page} of {data.pagination.totalPages}
        </p>
        <div className="flex gap-2">
          <Button disabled={data.pagination.page <= 1} onClick={() => onPageChange(data.pagination.page - 1)} variant="secondary">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
          <Button disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => onPageChange(data.pagination.page + 1)} variant="secondary">
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function businessProfile(settings: Json | undefined) {
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
    address: stringValue(value.address),
    supportNotes: stringValue(value.supportNotes)
  };
}

function emptyBusinessProfile() {
  return {
    legalName: "",
    gstNumber: "",
    phone: "",
    address: "",
    supportNotes: ""
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

function compactUserAgent(value: string) {
  return value.length > 64 ? `${value.slice(0, 64)}...` : value;
}

function buildOrganizationsUrl(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value && value !== "all" && !(key === "page" && value === "1")) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/super-admin/organizations?${query}` : "/super-admin/organizations";
}

function buildExportUrl(filters: OrganizationManagementData["filters"], format: "csv" | "pdf") {
  const params = new URLSearchParams();
  params.set("format", format);
  if (filters.query) {
    params.set("q", filters.query);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  params.set("sort", filters.sort);
  return `/api/super-admin/organizations/export?${params.toString()}`;
}
