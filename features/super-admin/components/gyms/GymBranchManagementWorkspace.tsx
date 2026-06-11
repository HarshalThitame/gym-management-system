"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  Layers3,
  Loader2,
  MapPinned,
  MoveRight,
  Plus,
  Search,
  ShieldAlert,
  UserRoundCog
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState, type AuthActionState } from "@/features/auth/actions/action-state";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { branchStatuses, gymStatuses } from "@/types/enterprise";
import type { Json } from "@/types/database";
import {
  moveBranchToGymAction,
  moveGymToOrganizationAction,
  saveSuperAdminBranchAction,
  saveSuperAdminGymAction,
  transferGymAdminAction,
  updateBranchCapacityHoursAction,
  updateLocationLifecycleAction
} from "../../actions/gym-branch-actions";
import type { BranchNode, GymBranchManagementData, GymBranchNode } from "../../services/gym-branch-management-service";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";
const operatingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

type DrawerState =
  | { type: "closed" }
  | { type: "create_gym" }
  | { type: "edit_gym"; gym: GymBranchNode }
  | { type: "create_branch"; gymId?: string | undefined; organizationId?: string | undefined }
  | { type: "edit_branch"; branch: BranchNode }
  | { type: "transfer_admin"; gym: GymBranchNode }
  | { type: "lifecycle"; entityType: "gym"; gym: GymBranchNode }
  | { type: "lifecycle"; entityType: "branch"; branch: BranchNode }
  | { type: "capacity_hours"; branch: BranchNode }
  | { type: "move_gym"; gym: GymBranchNode }
  | { type: "move_branch"; branch: BranchNode };

export function GymBranchManagementWorkspace({ data }: { data: GymBranchManagementData }) {
  const router = useRouter();
  const [query, setQuery] = useState(data.filters.query);
  const [organizationId, setOrganizationId] = useState(data.filters.organizationId);
  const [status, setStatus] = useState(data.filters.status);
  const [drawer, setDrawer] = useState<DrawerState>({ type: "closed" });

  function applyFilters() {
    const params = new URLSearchParams();
    if (query) {
      params.set("q", query);
    }
    if (organizationId !== "all") {
      params.set("organizationId", organizationId);
    }
    if (status !== "all") {
      params.set("status", status);
    }
    router.push(`/super-admin/gyms${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard icon={<Building2 className="size-5" />} label="Gyms" value={formatCompactNumber(data.summary.gyms)} detail={`${formatCompactNumber(data.summary.activeGyms)} active`} />
        <SummaryCard icon={<GitBranch className="size-5" />} label="Branches" value={formatCompactNumber(data.summary.branches)} detail={`${formatCompactNumber(data.summary.activeBranches)} active`} />
        <SummaryCard icon={<UserRoundCog className="size-5" />} label="Missing Admins" value={formatCompactNumber(data.summary.branchesWithoutAdmins)} detail="Branches without active gym admin" />
        <SummaryCard icon={<ShieldAlert className="size-5" />} label="Warnings" value={formatCompactNumber(data.summary.consistencyWarnings)} detail="Hierarchy and data consistency checks" />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-2xl font-black">Gym and Branch Governance</h3>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                Manage tenant location hierarchy, gym admin ownership, branch operating rules, lifecycle state, and cross-organization movement controls.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDrawer({ type: "create_gym" })} variant="accent">
                <Plus aria-hidden="true" className="size-4" />
                Create Gym
              </Button>
              <Button onClick={() => setDrawer({ type: "create_branch" })} variant="secondary">
                <Plus aria-hidden="true" className="size-4" />
                Create Branch
              </Button>
            </div>
          </div>
          <form
            className="mt-5 grid gap-3 xl:grid-cols-[1fr_220px_190px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <label className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search gym, branch, code, city, organization..." value={query} />
            </label>
            <select aria-label="Filter by organization" className={selectClass} onChange={(event) => setOrganizationId(event.target.value)} value={organizationId}>
              <option value="all">All organizations</option>
              {data.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </select>
            <select aria-label="Filter by status" className={selectClass} onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="all">All statuses</option>
              {[...new Set([...gymStatuses, ...branchStatuses])].map((item) => <option key={item} value={item}>{formatEnterpriseLabel(item)}</option>)}
            </select>
            <Button type="submit" variant="primary">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        {data.gyms.length > 0 ? data.gyms.map((gym) => (
          <GymHierarchyCard gym={gym} key={gym.gym.id} onOpen={setDrawer} />
        )) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg font-black">No gyms match these filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">Create a gym or clear filters to review the location hierarchy.</p>
              <Button className="mt-5" onClick={() => setDrawer({ type: "create_gym" })} variant="accent">
                <Plus aria-hidden="true" className="size-4" />
                Create Gym
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {data.orphanBranches.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Branches Without Gym Link</h3>
            <p className="text-sm leading-6 text-muted-foreground">These branches are tenant-scoped but not attached to a gym. Attach them before production use.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.orphanBranches.map((branch) => <BranchRowCard branch={branch} key={branch.branch.id} onOpen={setDrawer} />)}
          </CardContent>
        </Card>
      ) : null}

      <GymBranchDrawer data={data} drawer={drawer} onClose={() => setDrawer({ type: "closed" })} />
    </div>
  );
}

function GymHierarchyCard({ gym, onOpen }: { gym: GymBranchNode; onOpen: (drawer: DrawerState) => void }) {
  const criticalWarnings = gym.warnings.filter((warning) => warning.severity === "critical").length;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Layers3 aria-hidden="true" className="size-5 text-secondary" />
              <h3 className="text-2xl font-black">{gym.gym.name}</h3>
              <EnterpriseStatusBadge status={gym.gym.status} />
              {gym.organization ? <Badge variant="neutral">{gym.organization.name}</Badge> : <Badge variant="error">No organization</Badge>}
              {gym.warnings.length > 0 ? <Badge variant={criticalWarnings > 0 ? "error" : "warning"}>{gym.warnings.length} warning(s)</Badge> : <Badge variant="success">Consistent</Badge>}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {gym.gym.slug} · {gym.gym.timezone} · {gym.gym.currency} · Capacity {formatCompactNumber(gym.totalCapacity)}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Admin: {gym.admins[0]?.profile?.full_name ?? gym.admins[0]?.profile?.email ?? "Unassigned"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onOpen({ type: "edit_gym", gym })} size="sm" variant="secondary">Edit</Button>
            <Button onClick={() => onOpen({ type: "transfer_admin", gym })} size="sm" variant="primary"><UserRoundCog aria-hidden="true" className="size-4" />Admin</Button>
            <Button
              onClick={() => onOpen({
                type: "create_branch",
                gymId: gym.gym.id,
                ...(gym.gym.organization_id ? { organizationId: gym.gym.organization_id } : {})
              })}
              size="sm"
              variant="secondary"
            >
              <Plus aria-hidden="true" className="size-4" />Branch
            </Button>
            <Button onClick={() => onOpen({ type: "lifecycle", entityType: "gym", gym })} size="sm" variant="secondary">Lifecycle</Button>
            <Button onClick={() => onOpen({ type: "move_gym", gym })} size="sm" variant="secondary"><MoveRight aria-hidden="true" className="size-4" />Move</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Active members" value={formatCompactNumber(gym.metrics.activeMembers)} />
          <Metric label="Revenue" value={formatCurrency(gym.metrics.revenue)} />
          <Metric label="Inside now" value={formatCompactNumber(gym.metrics.activeAttendanceSessions)} />
          <Metric label="Branches" value={formatCompactNumber(gym.branches.length)} />
        </div>
        <WarningList warnings={gym.warnings} />
        <div className="space-y-3">
          {gym.branches.length > 0 ? gym.branches.map((branch) => <BranchRowCard branch={branch} key={branch.branch.id} onOpen={onOpen} />) : (
            <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm font-semibold text-muted-foreground">No branches under this gym.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BranchRowCard({ branch, onOpen }: { branch: BranchNode; onOpen: (drawer: DrawerState) => void }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MapPinned aria-hidden="true" className="size-4 text-secondary" />
            <p className="font-black">{branch.branch.name}</p>
            <EnterpriseStatusBadge status={branch.branch.status} />
            <Badge variant="neutral">{branch.branch.branch_code}</Badge>
            {branch.settings ? <Badge variant="success">Settings</Badge> : <Badge variant="warning">No settings</Badge>}
            {branch.admins.length > 0 ? <Badge variant="success">Admin assigned</Badge> : <Badge variant="warning">No admin</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {branch.branch.city ?? "No city"} · {branch.branch.timezone} · {branch.branch.currency} · Capacity {formatCompactNumber(branch.branch.capacity)}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Hours: {formatOperatingHours(branch.branch.operating_hours)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onOpen({ type: "edit_branch", branch })} size="sm" variant="secondary">Edit</Button>
          <Button onClick={() => onOpen({ type: "capacity_hours", branch })} size="sm" variant="secondary"><CalendarClock aria-hidden="true" className="size-4" />Hours</Button>
          <Button onClick={() => onOpen({ type: "lifecycle", entityType: "branch", branch })} size="sm" variant="secondary">Lifecycle</Button>
          <Button onClick={() => onOpen({ type: "move_branch", branch })} size="sm" variant="secondary"><MoveRight aria-hidden="true" className="size-4" />Move</Button>
        </div>
      </div>
      <WarningList warnings={branch.warnings} />
    </div>
  );
}

function GymBranchDrawer({ data, drawer, onClose }: { data: GymBranchManagementData; drawer: DrawerState; onClose: () => void }) {
  if (drawer.type === "closed") {
    return null;
  }
  if (drawer.type === "create_gym") {
    return <GymForm data={data} onClose={onClose} title="Create Gym" />;
  }
  if (drawer.type === "edit_gym") {
    return <GymForm data={data} gym={drawer.gym} onClose={onClose} title="Edit Gym" />;
  }
  if (drawer.type === "create_branch") {
    return <BranchForm data={data} defaultGymId={drawer.gymId} defaultOrganizationId={drawer.organizationId} onClose={onClose} title="Create Branch" />;
  }
  if (drawer.type === "edit_branch") {
    return <BranchForm branch={drawer.branch} data={data} onClose={onClose} title="Edit Branch" />;
  }
  if (drawer.type === "transfer_admin") {
    return <TransferAdminForm data={data} gym={drawer.gym} onClose={onClose} />;
  }
  if (drawer.type === "capacity_hours") {
    return <CapacityHoursForm branch={drawer.branch} onClose={onClose} />;
  }
  if (drawer.type === "move_gym") {
    return <MoveGymForm data={data} gym={drawer.gym} onClose={onClose} />;
  }
  if (drawer.type === "move_branch") {
    return <MoveBranchForm branch={drawer.branch} data={data} onClose={onClose} />;
  }
  return <LifecycleForm drawer={drawer} onClose={onClose} />;
}

function GymForm({ data, gym, onClose, title }: { data: GymBranchManagementData; gym?: GymBranchNode; onClose: () => void; title: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveSuperAdminGymAction, initialAuthActionState);
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);

  return (
    <DrawerShell onClose={onClose} title={title}>
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="gymId" type="hidden" value={gym?.gym.id ?? ""} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.name?.[0]} label="Gym name"><Input name="name" defaultValue={gym?.gym.name ?? ""} placeholder="Apex Fitness Mumbai" /></Field>
          <Field error={state.fieldErrors?.slug?.[0]} label="Slug"><Input name="slug" defaultValue={gym?.gym.slug ?? ""} placeholder="apex-fitness-mumbai" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2"><span className="text-sm font-bold">Organization</span><select className={selectClass} name="organizationId" defaultValue={gym?.gym.organization_id ?? ""}>{data.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select><FieldError message={state.fieldErrors?.organizationId?.[0]} /></label>
          <label className="space-y-2"><span className="text-sm font-bold">Status</span><select className={selectClass} name="status" defaultValue={gym?.gym.status ?? "active"}>{gymStatuses.map((status) => <option key={status} value={status}>{formatEnterpriseLabel(status)}</option>)}</select></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.timezone?.[0]} label="Timezone"><Input name="timezone" defaultValue={gym?.gym.timezone ?? "Asia/Kolkata"} /></Field>
          <Field error={state.fieldErrors?.currency?.[0]} label="Currency"><Input name="currency" defaultValue={gym?.gym.currency ?? "INR"} /></Field>
        </div>
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Reason for this location change." /></Field>
        <DrawerActions onClose={onClose} submitLabel={gym ? "Save Gym" : "Create Gym"} />
      </form>
    </DrawerShell>
  );
}

function BranchForm({
  branch,
  data,
  defaultGymId,
  defaultOrganizationId,
  onClose,
  title
}: {
  branch?: BranchNode;
  data: GymBranchManagementData;
  defaultGymId?: string | undefined;
  defaultOrganizationId?: string | undefined;
  onClose: () => void;
  title: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveSuperAdminBranchAction, initialAuthActionState);
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);
  const selectedOrganizationId = branch?.branch.organization_id ?? defaultOrganizationId ?? data.organizations[0]?.id ?? "";

  return (
    <DrawerShell onClose={onClose} title={title}>
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="branchId" type="hidden" value={branch?.branch.id ?? ""} />
        <div className="grid gap-4 md:grid-cols-3">
          <Field error={state.fieldErrors?.name?.[0]} label="Branch name"><Input name="name" defaultValue={branch?.branch.name ?? ""} placeholder="Apex Bandra" /></Field>
          <Field error={state.fieldErrors?.slug?.[0]} label="Slug"><Input name="slug" defaultValue={branch?.branch.slug ?? ""} placeholder="apex-bandra" /></Field>
          <Field error={state.fieldErrors?.branchCode?.[0]} label="Branch code"><Input name="branchCode" defaultValue={branch?.branch.branch_code ?? ""} placeholder="BND001" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2"><span className="text-sm font-bold">Organization</span><select className={selectClass} name="organizationId" defaultValue={selectedOrganizationId}>{data.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select><FieldError message={state.fieldErrors?.organizationId?.[0]} /></label>
          <label className="space-y-2"><span className="text-sm font-bold">Parent gym</span><select className={selectClass} name="gymId" defaultValue={branch?.branch.gym_id ?? defaultGymId ?? ""}><option value="">No parent gym</option>{data.gyms.map((gym) => <option key={gym.gym.id} value={gym.gym.id}>{gym.gym.name}</option>)}</select><FieldError message={state.fieldErrors?.gymId?.[0]} /></label>
          <label className="space-y-2"><span className="text-sm font-bold">Status</span><select className={selectClass} name="status" defaultValue={branch?.branch.status ?? "planned"}>{branchStatuses.map((status) => <option key={status} value={status}>{formatEnterpriseLabel(status)}</option>)}</select></label>
        </div>
        <BranchProfileFields branch={branch} state={state} />
        <OperatingHoursFields hours={branch?.branch.operating_hours} />
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Reason for this branch change." /></Field>
        <DrawerActions onClose={onClose} submitLabel={branch ? "Save Branch" : "Create Branch"} />
      </form>
    </DrawerShell>
  );
}

function TransferAdminForm({ data, gym, onClose }: { data: GymBranchManagementData; gym: GymBranchNode; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(transferGymAdminAction, initialAuthActionState);
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);

  return (
    <DrawerShell onClose={onClose} title="Assign or Transfer Gym Admin">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="gymId" type="hidden" value={gym.gym.id} />
        <div className="rounded-md border border-border bg-background p-4">
          <p className="font-black">{gym.gym.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{gym.branches.length} branch scope · Current admin {gym.admins[0]?.profile?.full_name ?? gym.admins[0]?.profile?.email ?? "Unassigned"}</p>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-bold">New gym admin</span>
          <select className={selectClass} name="newAdminUserId" defaultValue="">
            <option value="">Select user</option>
            {data.adminCandidates.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email || profile.id} · {profile.email ?? "No email"}</option>)}
          </select>
          <FieldError message={state.fieldErrors?.newAdminUserId?.[0]} />
        </label>
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Reason for ownership/admin transfer." /></Field>
        <Field error={state.fieldErrors?.confirmation?.[0]} label="Confirmation"><Input name="confirmation" placeholder="Type TRANSFER_ADMIN" /></Field>
        <WarningBox>Existing active gym admin assignments across this gym&apos;s branch scope will be revoked and replaced by the selected user.</WarningBox>
        <DrawerActions onClose={onClose} submitLabel="Transfer Admin" variant="primary" />
      </form>
    </DrawerShell>
  );
}

function LifecycleForm({ drawer, onClose }: { drawer: Extract<DrawerState, { type: "lifecycle" }>; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateLocationLifecycleAction, initialAuthActionState);
  const entityType = drawer.entityType;
  const entityId = entityType === "gym" ? drawer.gym.gym.id : drawer.branch.branch.id;
  const currentStatus = entityType === "gym" ? drawer.gym.gym.status : drawer.branch.branch.status;
  const statusOptions = entityType === "gym" ? gymStatuses : branchStatuses;
  const [nextStatus, setNextStatus] = useState<LocationStatus>(currentStatus);
  const confirmation = `${entityType.toUpperCase()}:${nextStatus.toUpperCase()}`;
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);

  return (
    <DrawerShell onClose={onClose} title={`${formatEnterpriseLabel(entityType)} Lifecycle`}>
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="entityType" type="hidden" value={entityType} />
        <input name="entityId" type="hidden" value={entityId} />
        <label className="space-y-2">
          <span className="text-sm font-bold">Next status</span>
          <select className={selectClass} name="nextStatus" onChange={(event) => setNextStatus(event.target.value as LocationStatus)} value={nextStatus}>
            {statusOptions.map((status) => <option key={status} value={status}>{formatEnterpriseLabel(status)}</option>)}
          </select>
        </label>
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Why is this lifecycle change required?" /></Field>
        <Field error={state.fieldErrors?.confirmation?.[0]} label="Confirmation"><Input name="confirmation" placeholder={`Type ${confirmation}`} /></Field>
        <WarningBox>Archiving is blocked when operational dependencies remain. Suspend or deactivate first when you need reversible restriction.</WarningBox>
        <DrawerActions onClose={onClose} submitLabel="Update Lifecycle" variant={nextStatus === "archived" || nextStatus === "suspended" ? "destructive" : "primary"} />
      </form>
    </DrawerShell>
  );
}

function CapacityHoursForm({ branch, onClose }: { branch: BranchNode; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateBranchCapacityHoursAction, initialAuthActionState);
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);

  return (
    <DrawerShell onClose={onClose} title="Capacity and Operating Hours">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="branchId" type="hidden" value={branch.branch.id} />
        <BranchProfileFields branch={branch} capacityOnly state={state} />
        <OperatingHoursFields hours={branch.branch.operating_hours} />
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Reason for changing capacity or hours." /></Field>
        <DrawerActions onClose={onClose} submitLabel="Save Capacity and Hours" />
      </form>
    </DrawerShell>
  );
}

function MoveGymForm({ data, gym, onClose }: { data: GymBranchManagementData; gym: GymBranchNode; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(moveGymToOrganizationAction, initialAuthActionState);
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);

  return (
    <DrawerShell onClose={onClose} title="Move Gym Across Organization">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="gymId" type="hidden" value={gym.gym.id} />
        <label className="space-y-2">
          <span className="text-sm font-bold">Target organization</span>
          <select className={selectClass} name="targetOrganizationId" defaultValue={gym.gym.organization_id ?? ""}>
            {data.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
          <FieldError message={state.fieldErrors?.targetOrganizationId?.[0]} />
        </label>
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Why is this cross-org movement required?" /></Field>
        <Field error={state.fieldErrors?.confirmation?.[0]} label="Confirmation"><Input name="confirmation" placeholder="Type MOVE_GYM" /></Field>
        <WarningBox>Cross-organization gym moves are blocked if branches, members, payments, or domain routes still exist.</WarningBox>
        <DrawerActions onClose={onClose} submitLabel="Move Gym" variant="destructive" />
      </form>
    </DrawerShell>
  );
}

function MoveBranchForm({ branch, data, onClose }: { branch: BranchNode; data: GymBranchManagementData; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(moveBranchToGymAction, initialAuthActionState);
  useCloseOnSuccess(state.status, onClose);
  useRefreshOnSuccess(state.status, router);

  return (
    <DrawerShell onClose={onClose} title="Move Branch">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="branchId" type="hidden" value={branch.branch.id} />
        <label className="space-y-2">
          <span className="text-sm font-bold">Target gym</span>
          <select className={selectClass} name="targetGymId" defaultValue={branch.branch.gym_id ?? ""}>
            <option value="">Detach from gym</option>
            {data.gyms.map((gym) => <option key={gym.gym.id} value={gym.gym.id}>{gym.gym.name} · {gym.organization?.name ?? "No organization"}</option>)}
          </select>
          <FieldError message={state.fieldErrors?.targetGymId?.[0]} />
        </label>
        <Field error={state.fieldErrors?.reason?.[0]} label="Audit reason"><Textarea className="min-h-24" name="reason" placeholder="Why is this branch movement required?" /></Field>
        <Field error={state.fieldErrors?.confirmation?.[0]} label="Confirmation"><Input name="confirmation" placeholder="Type MOVE_BRANCH" /></Field>
        <WarningBox>Cross-organization branch moves are blocked when branch users, settings, or domain routes remain attached.</WarningBox>
        <DrawerActions onClose={onClose} submitLabel="Move Branch" variant="destructive" />
      </form>
    </DrawerShell>
  );
}

type LocationStatus = (typeof gymStatuses)[number] | (typeof branchStatuses)[number];

function BranchProfileFields({ branch, capacityOnly = false, state }: { branch?: BranchNode | undefined; capacityOnly?: boolean | undefined; state: AuthActionState }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {!capacityOnly ? null : <input name="branchId" type="hidden" value={branch?.branch.id ?? ""} />}
      {!capacityOnly ? (
        <>
          <Field error={state.fieldErrors?.city?.[0]} label="City"><Input name="city" defaultValue={branch?.branch.city ?? ""} placeholder="Mumbai" /></Field>
          <Field error={state.fieldErrors?.state?.[0]} label="State"><Input name="state" defaultValue={branch?.branch.state ?? ""} placeholder="Maharashtra" /></Field>
          <Field error={state.fieldErrors?.country?.[0]} label="Country"><Input name="country" defaultValue={branch?.branch.country ?? "India"} /></Field>
          <Field error={state.fieldErrors?.address?.[0]} label="Address"><Input name="address" defaultValue={branch?.branch.address ?? ""} placeholder="Full branch address" /></Field>
          <Field error={state.fieldErrors?.phone?.[0]} label="Phone"><Input name="phone" defaultValue={branch?.branch.phone ?? ""} /></Field>
          <Field error={state.fieldErrors?.email?.[0]} label="Email"><Input name="email" defaultValue={branch?.branch.email ?? ""} type="email" /></Field>
        </>
      ) : null}
      <Field error={state.fieldErrors?.capacity?.[0]} label="Capacity"><Input name="capacity" defaultValue={String(branch?.branch.capacity ?? 120)} type="number" /></Field>
      <Field error={state.fieldErrors?.timezone?.[0]} label="Timezone"><Input name="timezone" defaultValue={branch?.branch.timezone ?? "Asia/Kolkata"} /></Field>
      <Field error={state.fieldErrors?.currency?.[0]} label="Currency"><Input name="currency" defaultValue={branch?.branch.currency ?? "INR"} /></Field>
      {!capacityOnly ? <Field error={state.fieldErrors?.postalCode?.[0]} label="Postal code"><Input name="postalCode" defaultValue={branch?.branch.postal_code ?? ""} /></Field> : null}
    </div>
  );
}

function OperatingHoursFields({ hours }: { hours?: Json | undefined }) {
  return (
    <section className="rounded-md border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <CalendarClock aria-hidden="true" className="size-4 text-secondary" />
        <h4 className="font-black">Operating Hours</h4>
      </div>
      <div className="mt-4 grid gap-3">
        {operatingDays.map((day) => {
          const dayHours = getDayHours(hours, day);
          return (
            <div className="grid gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-[120px_1fr_1fr_120px]" key={day}>
              <p className="self-center text-sm font-black">{formatEnterpriseLabel(day)}</p>
              <Input aria-label={`${day} open time`} name={`${day}Open`} type="time" defaultValue={dayHours.opensAt} />
              <Input aria-label={`${day} close time`} name={`${day}Close`} type="time" defaultValue={dayHours.closesAt} />
              <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <input defaultChecked={dayHours.closed} name={`${day}Closed`} type="checkbox" />
                Closed
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DrawerShell({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border p-5">
          <h3 className="text-2xl font-black">{title}</h3>
          <Button aria-label="Close drawer" onClick={onClose} size="sm" type="button" variant="secondary">Close</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}

function DrawerActions({ onClose, submitLabel, variant = "primary" }: { onClose: () => void; submitLabel: string; variant?: "primary" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      <Button disabled={pending} type="submit" variant={variant}>
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
        {pending ? "Saving" : submitLabel}
      </Button>
    </div>
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

function SummaryCard({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-3 text-secondary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function WarningList({ warnings }: { warnings: Array<{ severity: "warning" | "critical"; title: string; detail: string }> }) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="mt-4 grid gap-2">
      {warnings.map((warning) => (
        <div className={warning.severity === "critical" ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" : "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"} key={`${warning.title}-${warning.detail}`}>
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle aria-hidden="true" className="size-4" />
            {warning.title}
          </div>
          <p className="mt-1 font-semibold leading-6">{warning.detail}</p>
        </div>
      ))}
    </div>
  );
}

function WarningBox({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{children}</div>;
}

function useCloseOnSuccess(status: string, onClose: () => void) {
  useEffect(() => {
    if (status === "success") {
      onClose();
    }
  }, [onClose, status]);
}

function useRefreshOnSuccess(status: string, router: ReturnType<typeof useRouter>) {
  useEffect(() => {
    if (status === "success") {
      router.refresh();
    }
  }, [router, status]);
}

function getDayHours(hours: Json | undefined, day: string) {
  const fallback = { closed: false, opensAt: "06:00", closesAt: "22:00" };
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) {
    return fallback;
  }
  const raw = (hours as Record<string, Json | undefined>)[day];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallback;
  }
  const value = raw as Record<string, Json | undefined>;
  return {
    closed: value.closed === true,
    opensAt: typeof value.opensAt === "string" ? value.opensAt : fallback.opensAt,
    closesAt: typeof value.closesAt === "string" ? value.closesAt : fallback.closesAt
  };
}

function formatOperatingHours(hours: Json) {
  const monday = getDayHours(hours, "monday");
  return monday.closed ? "Monday closed" : `Monday ${monday.opensAt}-${monday.closesAt}`;
}

export default GymBranchManagementWorkspace;
