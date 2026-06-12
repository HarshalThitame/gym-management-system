"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Download,
  Edit3,
  Eye,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserRoundCog,
  UsersRound,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { roleNames } from "@/types/auth";
import {
  bulkUserActionAction,
  forceLogoutUserAction,
  inviteUserAction,
  resetUserPasswordAction,
  saveUserProfileAction,
  transferUserRoleAction,
  updateUserStatusAction
} from "../../actions/user-management-actions";
import type { UserManagementData, UserManagementRecord } from "../../services/user-management-service";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

type DrawerState =
  | { type: "closed" }
  | { type: "invite" }
  | { type: "detail"; record: UserManagementRecord }
  | { type: "edit"; record: UserManagementRecord }
  | { type: "status"; record: UserManagementRecord; action: "activate" | "suspend" | "archive" }
  | { type: "force_logout"; record: UserManagementRecord }
  | { type: "reset_password"; record: UserManagementRecord }
  | { type: "transfer_role"; record: UserManagementRecord }
  | { type: "bulk"; selectedIds: string[] };

type SortOption = "created_desc" | "name_asc" | "email_asc" | "role_asc";

export function UserManagementWorkspace({ criticalSuperAdminEmail, data }: { criticalSuperAdminEmail: string; data: UserManagementData }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerState>({ type: "closed" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>(data.filters.sort);

  useEffect(() => {
    if (drawer.type === "closed") {
      setSelectedIds(new Set());
    }
  }, [drawer.type]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Global User Management</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Manage organization owners, gym admins, reception staff, trainers, and members across all tenants.
            Invite users, reset passwords, lock/unlock accounts, force logout, transfer roles, and review activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/super-admin/users/export?format=csv" variant="secondary">
            <Download aria-hidden="true" className="size-4" />
            Export CSV
          </ButtonLink>
          <Button onClick={() => setDrawer({ type: "invite" })} variant="primary">
            <Plus aria-hidden="true" className="size-4" />
            Invite User
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <SummaryCard label="Total Users" value={formatCompactNumber(data.summary.totalUsers)} icon={<UsersRound className="size-5" />} />
        <SummaryCard label="Active" value={formatCompactNumber(data.summary.activeUsers)} icon={<UserCheck className="size-5 text-emerald-600" />} />
        <SummaryCard label="Invited" value={formatCompactNumber(data.summary.invitedUsers)} icon={<Mail className="size-5 text-amber-600" />} />
        <SummaryCard label="Suspended" value={formatCompactNumber(data.summary.suspendedUsers)} icon={<Ban className="size-5 text-red-600" />} />
        <SummaryCard label="Super Admins" value={formatCompactNumber(data.summary.superAdmins)} icon={<ShieldCheck className="size-5 text-indigo-600" />} />
      </section>

      <Card>
        <CardHeader>
          <form className="grid gap-3 lg:grid-cols-[1fr_160px_160px_200px_140px_auto]">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-base shadow-sm"
                name="q"
                placeholder="Search name, email, phone..."
                defaultValue={data.filters.query}
              />
            </div>
            <select className={selectClass} name="role" defaultValue={data.filters.role}>
              <option value="all">All Roles</option>
              {roleNames.map((role) => <option key={role} value={role}>{formatEnterpriseLabel(role)}</option>)}
            </select>
            <select className={selectClass} name="status" defaultValue={data.filters.status}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
            <select className={selectClass} name="organizationId" defaultValue={data.filters.organizationId}>
              <option value="all">All Organizations</option>
              {data.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <select className={selectClass} value={sort} onChange={(e) => { setSort(e.target.value as SortOption); router.push(`/super-admin/users?sort=${e.target.value}`); }}>
              <option value="created_desc">Newest First</option>
              <option value="name_asc">Name A-Z</option>
              <option value="email_asc">Email A-Z</option>
              <option value="role_asc">Role A-Z</option>
            </select>
            <Button type="submit" variant="primary">Filter</Button>
          </form>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              Showing {data.pagination.from}-{data.pagination.to} of {formatCompactNumber(data.pagination.total)} users.
            </span>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{selectedIds.size} selected</span>
                <Button onClick={() => setDrawer({ type: "bulk", selectedIds: Array.from(selectedIds) })} size="sm" variant="secondary">
                  <UserCog aria-hidden="true" className="size-4" />
                  Bulk Actions
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {data.records.length > 0 ? data.records.map((record) => (
              <UserRow
                key={record.user.id}
                record={record}
                isSelected={selectedIds.has(record.user.id)}
                onToggle={() => {
                  const next = new Set(selectedIds);
                  if (next.has(record.user.id)) next.delete(record.user.id);
                  else next.add(record.user.id);
                  setSelectedIds(next);
                }}
                onView={() => setDrawer({ type: "detail", record })}
                onEdit={() => setDrawer({ type: "edit", record })}
                onStatus={(action) => setDrawer({ type: "status", record, action })}
                onForceLogout={() => setDrawer({ type: "force_logout", record })}
                onResetPassword={() => setDrawer({ type: "reset_password", record })}
                onTransferRole={() => setDrawer({ type: "transfer_role", record })}
              />
            )) : (
              <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm font-semibold text-muted-foreground">
                No users match these filters.
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages}</p>
            <div className="flex gap-2">
              <ButtonLink
                aria-disabled={data.pagination.page <= 1}
                href={buildPageUrl(data.filters, data.pagination.page - 1, data.pagination.pageSize, sort)}
                variant="secondary">Previous</ButtonLink>
              <ButtonLink
                aria-disabled={data.pagination.page >= data.pagination.totalPages}
                href={buildPageUrl(data.filters, data.pagination.page + 1, data.pagination.pageSize, sort)}
                variant="secondary">Next</ButtonLink>
            </div>
          </div>
        </CardContent>
      </Card>

      <DrawerModal drawer={drawer} onClose={() => setDrawer({ type: "closed" })} criticalSuperAdminEmail={criticalSuperAdminEmail} organizations={data.organizations} />
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function UserRow({
  record,
  isSelected,
  onToggle,
  onView,
  onEdit,
  onStatus,
  onForceLogout,
  onResetPassword,
  onTransferRole
}: {
  record: UserManagementRecord;
  isSelected: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  onStatus: (action: "activate" | "suspend" | "archive") => void;
  onForceLogout: () => void;
  onResetPassword: () => void;
  onTransferRole: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3 lg:items-center">
        <input
          aria-label={`Select ${record.user.full_name}`}
          checked={isSelected}
          className="mt-1 size-4 accent-primary lg:mt-0"
          onChange={onToggle}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-black">{record.user.full_name}</p>
            <EnterpriseStatusBadge status={record.user.status} />
            {record.roles.map((role) => (
              <Badge key={role} variant={role === "super_admin" ? "premium" : "neutral"}>{formatEnterpriseLabel(role)}</Badge>
            ))}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">
            {record.user.email ?? "No email"} · {record.user.phone ?? "No phone"}
            {record.organizations.length > 0 && ` · ${record.organizations.map((o) => o.name).join(", ")}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button onClick={onView} size="sm" variant="ghost" title="View details"><Eye className="size-4" /></Button>
        <Button onClick={onEdit} size="sm" variant="ghost" title="Edit profile"><Edit3 className="size-4" /></Button>
        {record.user.status !== "active" ? (
          <Button onClick={() => onStatus("activate")} size="sm" variant="ghost" title="Activate"><RotateCcw className="size-4 text-emerald-600" /></Button>
        ) : (
          <>
            <Button onClick={() => onStatus("suspend")} size="sm" variant="ghost" title="Suspend"><Ban className="size-4 text-amber-600" /></Button>
            <Button onClick={() => onStatus("archive")} size="sm" variant="ghost" title="Archive"><XCircle className="size-4 text-red-600" /></Button>
          </>
        )}
        <Button onClick={onForceLogout} size="sm" variant="ghost" title="Force logout"><LogOut className="size-4 text-red-600" /></Button>
        <Button onClick={onResetPassword} size="sm" variant="ghost" title="Reset password"><KeyRound className="size-4" /></Button>
        <Button onClick={onTransferRole} size="sm" variant="ghost" title="Transfer role"><UserRoundCog className="size-4" /></Button>
      </div>
    </div>
  );
}

function DrawerModal({
  drawer,
  onClose,
  criticalSuperAdminEmail,
  organizations
}: {
  drawer: DrawerState;
  onClose: () => void;
  criticalSuperAdminEmail: string;
  organizations: UserManagementData["organizations"];
}) {
  if (drawer.type === "closed") return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-w-xl flex-col overflow-y-auto bg-background p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black">{drawerTitle(drawer)}</h2>
          <Button onClick={onClose} size="sm" variant="ghost"><XCircle className="size-5" /></Button>
        </div>

        {drawer.type === "invite" && (
          <InviteUserForm onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} organizations={organizations} />
        )}
        {drawer.type === "detail" && (
          <UserDetailView record={drawer.record} />
        )}
        {drawer.type === "edit" && (
          <EditUserForm record={drawer.record} onClose={onClose} />
        )}
        {drawer.type === "status" && (
          <UserStatusForm record={drawer.record} action={drawer.action} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "force_logout" && (
          <UserForceLogoutForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "reset_password" && (
          <UserResetPasswordForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "transfer_role" && (
          <UserTransferRoleForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} organizations={organizations} />
        )}
        {drawer.type === "bulk" && (
          <BulkUserActionForm selectedIds={drawer.selectedIds} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
      </div>
    </div>
  );
}

function drawerTitle(drawer: DrawerState): string {
  switch (drawer.type) {
    case "invite": return "Invite New User";
    case "detail": return `User: ${drawer.record.user.full_name}`;
    case "edit": return `Edit: ${drawer.record.user.full_name}`;
    case "status": return `${formatEnterpriseLabel(drawer.action)} User`;
    case "force_logout": return `Force Logout: ${drawer.record.user.full_name}`;
    case "reset_password": return `Reset Password: ${drawer.record.user.full_name}`;
    case "transfer_role": return `Transfer Role: ${drawer.record.user.full_name}`;
    case "bulk": return `Bulk Actions (${drawer.selectedIds.length} users)`;
    default: return "";
  }
}

function InviteUserForm({ onClose, criticalSuperAdminEmail, organizations }: { onClose: () => void; criticalSuperAdminEmail: string; organizations: UserManagementData["organizations"] }) {
  const [state, formAction] = useActionState(inviteUserAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Create a new user account with role-based access. The user will receive an email with login instructions.
      </p>

      <FormField label="Email address" error={state.fieldErrors?.email}>
        <Input name="email" placeholder="user@example.com" required />
      </FormField>

      <FormField label="Full name" error={state.fieldErrors?.fullName}>
        <Input name="fullName" placeholder="Full name" required />
      </FormField>

      <FormField label="Phone (optional)" error={state.fieldErrors?.phone}>
        <Input name="phone" placeholder="+91 98765 43210" />
      </FormField>

      <FormField label="Role" error={state.fieldErrors?.role}>
        <select className={selectClass} name="role" required>
          <option value="">Select a role</option>
          {roleNames.map((role) => <option key={role} value={role}>{formatEnterpriseLabel(role)}</option>)}
        </select>
      </FormField>

      <FormField label="Organization" error={state.fieldErrors?.organizationId}>
        <select className={selectClass} name="organizationId" required>
          <option value="">Select an organization</option>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </FormField>

      <FormField label="Gym ID (optional)" error={state.fieldErrors?.gymId}>
        <Input name="gymId" placeholder="UUID of gym" />
      </FormField>

      <FormField label="Branch ID (optional)" error={state.fieldErrors?.branchId}>
        <Input name="branchId" placeholder="UUID of branch" />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Enter {criticalSuperAdminEmail} to confirm your identity.</p>
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this user being invited?" rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Send Invitation" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function EditUserForm({ record, onClose }: { record: UserManagementRecord; onClose: () => void }) {
  const [state, formAction] = useActionState(saveUserProfileAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <FormField label="Full name" error={state.fieldErrors?.fullName}>
        <Input name="fullName" defaultValue={record.user.full_name} required />
      </FormField>

      <FormField label="Phone" error={state.fieldErrors?.phone}>
        <Input name="phone" defaultValue={record.user.phone ?? ""} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Save Changes" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function UserStatusForm({ record, action, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; action: "activate" | "suspend" | "archive"; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(updateUserStatusAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const actionLabels = { activate: "Activate", suspend: "Suspend", archive: "Archive" };
  const currentStatus = record.user.status;

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="action" type="hidden" value={action} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">{record.user.full_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">Current status: {formatEnterpriseLabel(currentStatus)}</p>
          <p className="text-sm font-semibold text-muted-foreground">New status: {formatEnterpriseLabel(actionLabels[action])}</p>
        </CardContent>
      </Card>

      <FormField label={`Type ${actionLabels[action].toUpperCase()} to confirm`} error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder={actionLabels[action].toUpperCase()} required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder={`Why is this user being ${actionLabels[action].toLowerCase()}d?`} rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label={actionLabels[action]} />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function UserForceLogoutForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(forceLogoutUserAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <Card className="border-red-300 bg-red-50">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-600" />
            <p className="font-black text-red-800">Force Logout</p>
          </div>
          <p className="text-sm leading-6 text-red-700">
            This will immediately revoke all active sessions for <strong>{record.user.full_name}</strong> ({record.user.email}).
            They will be signed out on their next request and must log in again.
          </p>
        </CardContent>
      </Card>

      <FormField label="Type FORCE_LOGOUT to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="FORCE_LOGOUT" required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (required)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this user being force logged out?" rows={2} required />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Force Logout" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function UserResetPasswordForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(resetUserPasswordAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="email" type="hidden" value={record.user.email ?? ""} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">{record.user.full_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">A password reset email will be sent to: {record.user.email ?? "No email on file"}</p>
        </CardContent>
      </Card>

      <FormField label="Type RESET_PASSWORD to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="RESET_PASSWORD" required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this password being reset?" rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Send Reset Email" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function UserTransferRoleForm({ record, onClose, criticalSuperAdminEmail, organizations }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string; organizations: UserManagementData["organizations"] }) {
  const [state, formAction] = useActionState(transferUserRoleAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <Card>
        <CardContent className="space-y-2 p-5">
          <p className="font-black">{record.user.full_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">Current roles: {record.roles.map(formatEnterpriseLabel).join(", ") || "None"}</p>
        </CardContent>
      </Card>

      <FormField label="Target role" error={state.fieldErrors?.targetRole}>
        <select className={selectClass} name="targetRole" required>
          <option value="">Select target role</option>
          {roleNames.map((role) => <option key={role} value={role}>{formatEnterpriseLabel(role)}</option>)}
        </select>
      </FormField>

      <FormField label="Target organization" error={state.fieldErrors?.targetOrganizationId}>
        <select className={selectClass} name="targetOrganizationId" required>
          <option value="">Select organization</option>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </FormField>

      <FormField label="Target gym ID (optional)" error={state.fieldErrors?.targetGymId}>
        <Input name="targetGymId" placeholder="UUID of gym" />
      </FormField>

      <FormField label="Type TRANSFER_ROLE to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="TRANSFER_ROLE" required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this role being transferred?" rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Transfer Role" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function BulkUserActionForm({ selectedIds, onClose, criticalSuperAdminEmail }: { selectedIds: string[]; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(bulkUserActionAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      {selectedIds.map((id) => <input key={id} name="userIds" type="hidden" value={id} />)}

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">Bulk action on {selectedIds.length} user(s)</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Select the action to apply to all selected users. Each action requires MFA step-up confirmation.
          </p>
        </CardContent>
      </Card>

      <FormField label="Action" error={state.fieldErrors?.action}>
        <select className={selectClass} name="action" required>
          <option value="">Select action</option>
          <option value="suspend">Suspend</option>
          <option value="activate">Activate</option>
          <option value="archive">Archive</option>
          <option value="force_logout">Force Logout</option>
        </select>
      </FormField>

      <FormField label="Type BULK to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="BULK" required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this bulk action being performed?" rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Execute Bulk Action" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function UserDetailView({ record }: { record: UserManagementRecord }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-2xl font-black">{record.user.full_name}</p>
            <EnterpriseStatusBadge status={record.user.status} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label="Email" value={record.user.email ?? "Not set"} />
            <DetailLine label="Phone" value={record.user.phone ?? "Not set"} />
            <DetailLine label="User ID" value={record.user.id} />
            <DetailLine label="Created" value={new Date(record.user.created_at).toLocaleString("en-IN")} />
            <DetailLine label="Updated" value={new Date(record.user.updated_at).toLocaleString("en-IN")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-black">Role Assignments</h3>
        </CardHeader>
        <CardContent>
          {record.roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {record.roles.map((role) => (
                <Badge key={role} variant={role === "super_admin" ? "premium" : "neutral"}>{formatEnterpriseLabel(role)}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">No role assignments found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-black">Organization Access</h3>
        </CardHeader>
        <CardContent>
          {record.organizations.length > 0 ? (
            <div className="space-y-2">
              {record.organizations.map((org) => (
                <div className="rounded-md border border-border bg-surface p-3" key={org.id}>
                  <p className="font-bold">{org.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{org.slug}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">No organization access assigned.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold break-all">{value}</p>
    </div>
  );
}

function FormField({ children, error, label }: { children: ReactNode; error: string[] | undefined; label: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold">{label}</label>
      {children}
      {error && <FieldError message={error.join(", ")} />}
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" variant="primary">
      {pending && <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />}
      {label}
    </Button>
  );
}

function buildPageUrl(filters: UserManagementData["filters"], page: number, pageSize: number, sort: string) {
  const nextPage = Math.max(1, page);
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.role !== "all") params.set("role", filters.role);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.organizationId !== "all") params.set("organizationId", filters.organizationId);
  params.set("sort", sort);
  params.set("page", String(nextPage));
  params.set("pageSize", String(pageSize));
  return `/super-admin/users?${params.toString()}`;
}
