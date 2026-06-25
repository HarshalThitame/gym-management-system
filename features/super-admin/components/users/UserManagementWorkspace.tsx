"use client";

import React, { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Building2,
  ChevronDown,
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
import { showToast, ToastContainer } from "@/components/ui/toast";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { roleNames } from "@/types/auth";
import {
  addAccountNoteAction,
  bulkUserActionAction,
  deleteUserAction,
  forceLogoutUserAction,
  inviteUserAction,
  resendInviteAction,
  resetUserPasswordAction,
  revokeInviteAction,
  saveUserProfileAction,
  transferUserRoleAction,
  updateUserStatusAction
} from "../../actions/user-management-actions";
import type { UserManagementData, UserManagementRecord } from "../../services/user-management-service";
import { UserTableSkeleton } from "./UserTableSkeleton";
import { OrgOwnerCreationWizard } from "./OrgOwnerCreationWizard";

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
  | { type: "bulk"; selectedIds: string[] }
  | { type: "delete"; record: UserManagementRecord }
  | { type: "resend_invite"; record: UserManagementRecord }
  | { type: "revoke_invite"; record: UserManagementRecord }
  | { type: "notes"; record: UserManagementRecord };

type SortOption = "created_desc" | "name_asc" | "email_asc" | "role_asc" | "org_asc" | "last_login_desc";

export function UserManagementWorkspace({ criticalSuperAdminEmail, data, pendingInvites, loading }: { criticalSuperAdminEmail: string; data: UserManagementData; loading?: boolean; pendingInvites: Array<{ id: string; full_name: string; email: string | null; phone: string | null; status: string; created_at: string }> }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerState>({ type: "closed" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>(data.filters.sort);
  const [showOrgOwnerWizard, setShowOrgOwnerWizard] = useState(false);

  useEffect(() => {
    if (drawer.type === "closed") {
      setSelectedIds(new Set());
    }
  }, [drawer.type]);

  if (loading) {
    return (
      <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-4 px-6 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Global User Management</h1>
          </div>
        </section>
        <UserTableSkeleton rows={data.pagination.pageSize ?? 25} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-4 px-6 pb-4">
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
          <Button onClick={() => setShowOrgOwnerWizard(true)} variant="secondary">
            <Building2 aria-hidden="true" className="size-4" />
            Create Org Owner
          </Button>
          <Button onClick={() => setDrawer({ type: "invite" })} variant="primary">
            <Plus aria-hidden="true" className="size-4" />
            Invite User
          </Button>
        </div>
      </section>

      {showOrgOwnerWizard && (
        <OrgOwnerCreationWizard
          criticalSuperAdminEmail={criticalSuperAdminEmail}
          onClose={() => setShowOrgOwnerWizard(false)}
        />
      )}

      {/* KPI Row 1 — Core Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard delay={0} icon={<UsersRound className="size-5" />} label="Total Users" value={formatCompactNumber(data.summary.totalUsers)} />
        <KpiCard delay={0.05} icon={<UserCheck className="size-5 text-green-600" />} label="Active" value={formatCompactNumber(data.summary.activeUsers)} />
        <KpiCard delay={0.1} icon={<Mail className="size-5 text-amber-600" />} label="Invited / Pending" value={formatCompactNumber(data.summary.invitedUsers)} />
        <KpiCard delay={0.15} icon={<Ban className="size-5 text-red-600" />} label="Suspended" value={formatCompactNumber(data.summary.suspendedUsers)} />
        <KpiCard delay={0.2} icon={<ShieldCheck className="size-5 text-indigo-600" />} label="Super Admins" value={formatCompactNumber(data.summary.superAdmins)} />
        <KpiCard delay={0.25} icon={<Building2 className="size-5 text-blue-600" />} label="Org Owners" value={formatCompactNumber(data.summary.orgOwners)} />
      </section>

      {/* KPI Row 2 — Role Breakdown */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard delay={0.3} icon={<UserCog className="size-5 text-cyan-600" />} label="Branch Managers" value={formatCompactNumber(data.summary.gymAdmins)} />
        <KpiCard delay={0.35} icon={<UserCog className="size-5 text-purple-600" />} label="Reception Staff" value={formatCompactNumber(data.summary.receptionStaff)} />
        <KpiCard delay={0.4} icon={<UserCog className="size-5 text-orange-600" />} label="Trainers" value={formatCompactNumber(data.summary.trainers)} />
        <KpiCard delay={0.45} icon={<UsersRound className="size-5 text-teal-600" />} label="Members" value={formatCompactNumber(data.summary.members)} />
      </section>

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-amber-600" />
              <h2 className="text-lg font-black">Pending Invites ({pendingInvites.length})</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{invite.full_name}</p>
                  <p className="truncate text-sm font-semibold text-muted-foreground">{invite.email ?? "No email"} · Invited {new Date(invite.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button onClick={() => setDrawer({ type: "resend_invite", record: data.records.find((r) => r.user.id === invite.id) ?? buildMinimalRecord(invite) })} size="sm" variant="ghost" title="Resend invite"><Mail className="size-4" /></Button>
                  <Button onClick={() => setDrawer({ type: "revoke_invite", record: data.records.find((r) => r.user.id === invite.id) ?? buildMinimalRecord(invite) })} size="sm" variant="ghost" title="Revoke invite"><XCircle className="size-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="sticky top-[73px] z-[9]">
        <CardHeader>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_200px_140px_auto]">
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
              <option value="org_asc">Organization</option>
              <option value="created_desc">Newest First</option>
              <option value="name_asc">Name A-Z</option>
              <option value="email_asc">Email A-Z</option>
              <option value="role_asc">Role A-Z</option>
              <option value="last_login_desc">Last Login</option>
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
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right">
                <span className="text-sm font-black">{selectedIds.size} selected</span>
                <div className="w-px h-5 bg-border" />
                <Button size="sm" variant="ghost" onClick={() => setDrawer({ type: "bulk", selectedIds: Array.from(selectedIds) })}>
                  <UserCog className="size-4" /> Bulk Actions
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  <XCircle className="size-4" /> Clear
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {data.organizationGroups.length > 0 ? data.organizationGroups.map((group) => (
              <OrgGroupSection
                key={group.organization?.id ?? "__unassigned__"}
                group={group}
                selectedIds={selectedIds}
                onToggle={(userId) => {
                  const next = new Set(selectedIds);
                  if (next.has(userId)) next.delete(userId);
                  else next.add(userId);
                  setSelectedIds(next);
                }}
                onView={(record) => setDrawer({ type: "detail", record })}
                onEdit={(record) => setDrawer({ type: "edit", record })}
                onStatus={(record, action) => setDrawer({ type: "status", record, action })}
                onForceLogout={(record) => setDrawer({ type: "force_logout", record })}
                onResetPassword={(record) => setDrawer({ type: "reset_password", record })}
                onTransferRole={(record) => setDrawer({ type: "transfer_role", record })}
                onNotes={(record) => setDrawer({ type: "notes", record })}
              />
            )) : data.records.length === 0 && data.filters.query === "" && data.filters.status === "all" && data.filters.role === "all" && data.filters.organizationId === "all" ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-12 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted">
                  <UsersRound className="size-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-black">No users yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Invite your first user or create an organization owner to get started.</p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button onClick={() => setDrawer({ type: "invite" })} variant="primary">
                    <Plus className="size-4" /> Invite User
                  </Button>
                  <Button onClick={() => setShowOrgOwnerWizard(true)} variant="secondary">
                    <Building2 className="size-4" /> Create Org Owner
                  </Button>
                </div>
              </div>
            ) : data.records.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted">
                  <Search className="size-6 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-base font-black">No users match your filters</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                <Button className="mt-4" onClick={() => router.push("/super-admin/users")} variant="secondary" size="sm">
                  Clear Filters
                </Button>
              </div>
            ) : (
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

      <DrawerModal drawer={drawer} onClose={() => setDrawer({ type: "closed" })} onDelete={(rec) => setDrawer({ type: "delete", record: rec })} criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} />
      <ToastContainer />
    </div>
  );
}

function KpiCard({ icon, label, value, delay = 0 }: { icon: ReactNode; label: string; value: string; delay?: number }) {
  return (
    <div className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong" style={{ "--reveal-delay": `${delay}s` } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-3xl font-black text-foreground">{value}</p>
    </div>
  );
}

function OrgGroupSection({
  group,
  selectedIds,
  onToggle,
  onView,
  onEdit,
  onStatus,
  onForceLogout,
  onResetPassword,
  onTransferRole,
  onNotes
}: {
  group: import("../../services/user-management-service").OrganizationUserGroup;
  selectedIds: Set<string>;
  onToggle: (userId: string) => void;
  onView: (record: UserManagementRecord) => void;
  onEdit: (record: UserManagementRecord) => void;
  onStatus: (record: UserManagementRecord, action: "activate" | "suspend" | "archive") => void;
  onForceLogout: (record: UserManagementRecord) => void;
  onResetPassword: (record: UserManagementRecord) => void;
  onTransferRole: (record: UserManagementRecord) => void;
  onNotes: (record: UserManagementRecord) => void;
}) {
  const [open, setOpen] = useState(true);
  const isUnassigned = group.organization === null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <button
        className="flex w-full items-center gap-3 bg-background px-5 py-3 text-left transition hover:bg-surface-muted"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {isUnassigned ? (
          <UsersRound className="size-5 shrink-0 text-muted-foreground" />
        ) : (
          <Building2 className="size-5 shrink-0 text-indigo-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-black truncate">{isUnassigned ? "Unassigned Users" : group.organization!.name}</p>
          <p className="text-xs font-semibold text-muted-foreground">
            {group.total} user{group.total !== 1 ? "s" : ""}
            {!isUnassigned && ` · ${group.organization!.slug}`}
            {!isUnassigned && <EnterpriseStatusBadge status={group.organization!.status as "active" | "suspended" | "archived"} />}
          </p>
        </div>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="divide-y divide-border">
          {group.records.length > 0 ? group.records.map((record) => (
            <UserRow
              key={record.user.id}
              record={record}
              isSelected={selectedIds.has(record.user.id)}
              onToggle={() => onToggle(record.user.id)}
              onView={() => onView(record)}
              onEdit={() => onEdit(record)}
              onStatus={(action) => onStatus(record, action)}
              onForceLogout={() => onForceLogout(record)}
              onResetPassword={() => onResetPassword(record)}
              onTransferRole={() => onTransferRole(record)}
              onNotes={() => onNotes(record)}
            />
          )) : (
            <div className="px-5 py-4 text-sm font-semibold text-muted-foreground">No users in this organization.</div>
          )}
        </div>
      )}
    </div>
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
  onTransferRole,
  onNotes
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
  onNotes: () => void;
}) {
  return (
    <div className={`flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between transition-colors hover:bg-surface-muted ${isSelected ? "border-accent bg-accent/5 ring-1 ring-accent/20" : ""}`}>
      <div className="flex items-start gap-3 lg:items-center">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center lg:size-auto">
          <input
            aria-label={`Select ${record.user.full_name}`}
            checked={isSelected}
            className="size-4 accent-primary"
            onChange={onToggle}
            type="checkbox"
          />
        </label>
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
          </p>
          {(record.branches.length > 0 || record.gyms.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {record.gyms.map((gym) => (
                <Badge key={gym.id} variant="neutral">{gym.name}</Badge>
              ))}
              {record.branches.map((branch) => (
                <span key={branch.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {branch.name}
                </span>
              ))}
            </div>
          )}
            {record.lastLoginAt ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <span className={`inline-block size-1.5 rounded-full ${record.lastLoginSuccess ? "bg-emerald-500" : "bg-amber-500"}`} />
                Last login: {formatTimeAgo(record.lastLoginAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-muted-foreground/40" />
                Never logged in
              </span>
            )}
            {record.loginCount > 0 && (
              <span className="text-[11px] font-semibold text-muted-foreground">· {record.loginCount} login{record.loginCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      <div className="flex gap-1.5 overflow-x-auto">
        <Button onClick={onView} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="View details"><Eye className="size-4" /></Button>
        <Button onClick={onEdit} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Edit profile"><Edit3 className="size-4" /></Button>
        {record.user.status !== "active" ? (
          <Button onClick={() => onStatus("activate")} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Activate"><RotateCcw className="size-4 text-emerald-600" /></Button>
        ) : (
          <>
            <Button onClick={() => onStatus("suspend")} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Suspend"><Ban className="size-4 text-amber-600" /></Button>
            <Button onClick={() => onStatus("archive")} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Archive"><XCircle className="size-4 text-red-600" /></Button>
          </>
        )}
        <Button onClick={onForceLogout} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Force logout"><LogOut className="size-4 text-red-600" /></Button>
        <Button onClick={onResetPassword} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Reset password"><KeyRound className="size-4" /></Button>
        <Button onClick={onTransferRole} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Transfer role"><UserRoundCog className="size-4" /></Button>
        <Button onClick={onNotes} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all" title="Account Notes"><Edit3 className="size-4" /></Button>
      </div>
    </div>
  );
}

function DrawerModal({
  drawer,
  onClose,
  onDelete,
  criticalSuperAdminEmail,
  data
}: {
  drawer: DrawerState;
  onClose: () => void;
  onDelete: (record: UserManagementRecord) => void;
  criticalSuperAdminEmail: string;
  data: UserManagementData;
}) {
  if (drawer.type === "closed") return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex">
        <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-lg border border-border bg-surface shadow-2xl animate-slide-in-right">
          <div className="flex items-center justify-between px-5 py-4 bg-background/90 backdrop-blur border-b border-border">
            <h2 className="text-lg font-black">{drawerTitle(drawer)}</h2>
            <Button onClick={onClose} size="icon" variant="ghost" className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted"><XCircle className="size-5" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {drawer.type === "invite" && (
          <InviteUserForm onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} />
        )}
        {drawer.type === "detail" && (
          <UserDetailView record={drawer.record} onDelete={onDelete} />
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
          <UserTransferRoleForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} />
        )}
        {drawer.type === "bulk" && (
          <BulkUserActionForm selectedIds={drawer.selectedIds} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "delete" && (
          <DeleteUserForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "resend_invite" && (
          <ResendInviteForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "revoke_invite" && (
          <RevokeInviteForm record={drawer.record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "notes" && (
          <AccountNotesForm record={drawer.record} onClose={onClose} />
        )}
          </div>
        </div>
      </div>
    </>
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
    case "delete": return `Delete User: ${drawer.record.user.full_name}`;
    case "resend_invite": return `Resend Invitation`;
    case "revoke_invite": return `Revoke Invitation`;
    case "notes": return `Notes: ${drawer.record.user.full_name}`;
    default: return "";
  }
}

function InviteUserForm({ onClose, criticalSuperAdminEmail, data }: { onClose: () => void; criticalSuperAdminEmail: string; data: UserManagementData }) {
  const [state, formAction] = useActionState(inviteUserAction, initialAuthActionState);
  const [selectedOrgId, setSelectedOrgId] = useState("");

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "User invited.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  const filteredGyms = data.allGyms.filter((g) => !selectedOrgId || g.organization_id === selectedOrgId);
  const filteredBranches = data.allBranches.filter((b) => !selectedOrgId || b.organization_id === selectedOrgId);

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Create a new user account with role-based access. The user will receive an email with login instructions.
      </p>

      <InlineMfaStepUp compact />

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
        <select className={selectClass} name="organizationId" required value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
          <option value="">Select an organization</option>
          {data.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </FormField>

      <FormField label="Gym (optional)" error={state.fieldErrors?.gymId}>
        <select className={selectClass} name="gymId" defaultValue="">
          <option value="">No gym (platform-wide)</option>
          {filteredGyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          {filteredGyms.length === 0 && selectedOrgId && <option value="" disabled>No gyms for this org</option>}
        </select>
      </FormField>

      <FormField label="Branch (optional)" error={state.fieldErrors?.branchId}>
        <select className={selectClass} name="branchId" defaultValue="">
          <option value="">No branch (all branches)</option>
          {filteredBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.branch_code})</option>)}
          {filteredBranches.length === 0 && selectedOrgId && <option value="" disabled>No branches for this org</option>}
        </select>
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
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

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
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  const actionLabels = { activate: "Activate", suspend: "Suspend", archive: "Archive" };
  const currentStatus = record.user.status;

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="action" type="hidden" value={action} />

      <InlineMfaStepUp compact />

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
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <InlineMfaStepUp compact />

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
  const [mode, setMode] = useState<"email" | "temporary">("email");

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="email" type="hidden" value={record.user.email ?? ""} />
      <input name="isTemporary" type="hidden" value={String(mode === "temporary")} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">{record.user.full_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">Email: {record.user.email ?? "No email on file"}</p>
          <div className="flex gap-3">
            <label className={`flex-1 rounded-md border p-3 cursor-pointer transition-colors ${mode === "email" ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-surface hover:bg-surface-muted"}`}>
              <input className="sr-only" name="resetMode" onChange={() => setMode("email")} checked={mode === "email"} type="radio" />
              <p className="text-sm font-black">Send Reset Email</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">User receives a password reset link by email.</p>
            </label>
            <label className={`flex-1 rounded-md border p-3 cursor-pointer transition-colors ${mode === "temporary" ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-surface hover:bg-surface-muted"}`}>
              <input className="sr-only" name="resetMode" onChange={() => setMode("temporary")} checked={mode === "temporary"} type="radio" />
              <p className="text-sm font-black">Set Temporary Password</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Set a password now. User must change it on next login.</p>
            </label>
          </div>
        </CardContent>
      </Card>

      {mode === "temporary" && (
        <>
          <FormField label="Temporary password (min 8 chars)" error={state.fieldErrors?.temporaryPassword}>
            <Input name="temporaryPassword" placeholder="Enter a temporary password" required />
          </FormField>
          <p className="text-xs font-semibold text-amber-600">
            The user will be forced to change this password on their next login.
          </p>
        </>
      )}

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
        <SubmitButton label={mode === "temporary" ? "Set Temporary Password" : "Send Reset Email"} />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function UserTransferRoleForm({ record, onClose, criticalSuperAdminEmail, data }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string; data: UserManagementData }) {
  const [state, formAction] = useActionState(transferUserRoleAction, initialAuthActionState);
  const [targetOrgId, setTargetOrgId] = useState("");

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  const filteredBranches = data.allBranches.filter((b) => !targetOrgId || b.organization_id === targetOrgId);
  const filteredGyms = data.allGyms.filter((g) => !targetOrgId || g.organization_id === targetOrgId);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <InlineMfaStepUp compact />

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
        <select className={selectClass} name="targetOrganizationId" required value={targetOrgId} onChange={(e) => setTargetOrgId(e.target.value)}>
          <option value="">Select organization</option>
          {data.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </FormField>

      <FormField label="Target branch" error={state.fieldErrors?.targetBranchId}>
        <select className={selectClass} name="targetBranchId" defaultValue="" required>
          <option value="">Select target branch</option>
          {filteredBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.branch_code})</option>)}
          {filteredBranches.length === 0 && targetOrgId && <option value="" disabled>No branches for this org</option>}
        </select>
      </FormField>

      <FormField label="Target gym (optional)" error={state.fieldErrors?.targetGymId}>
        <select className={selectClass} name="targetGymId" defaultValue="">
          <option value="">No specific gym</option>
          {filteredGyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          {filteredGyms.length === 0 && targetOrgId && <option value="" disabled>No gyms for this org</option>}
        </select>
      </FormField>

      <FormField label="Type TRANSFER_ROLE to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="TRANSFER_ROLE" required />
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
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

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

function ResendInviteForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(resendInviteAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Invitation resent.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="email" type="hidden" value={record.user.email ?? ""} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">Resend invitation to {record.user.full_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">Email: {record.user.email ?? "No email on file"}</p>
        </CardContent>
      </Card>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this invitation being resent?" rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Resend Invitation" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function RevokeInviteForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(revokeInviteAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Invitation revoked.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <Card className="border-red-200 bg-red-50">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-600" />
            <p className="font-black text-red-800">Revoke Invitation</p>
          </div>
          <p className="text-sm leading-6 text-red-700">
            This will invalidate the invite for <strong>{record.user.full_name}</strong> ({record.user.email}) and archive the account.
          </p>
        </CardContent>
      </Card>

      <FormField label="Type REVOKE to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="REVOKE" required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this invitation being revoked?" rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Revoke Invitation" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function DeleteUserForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(deleteUserAction, initialAuthActionState);
  const [kind, setKind] = useState<"soft_delete" | "permanent_purge">("soft_delete");

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "User deleted.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  const isPermanent = kind === "permanent_purge";

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="kind" type="hidden" value={kind} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">Delete {record.user.full_name}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Choose how to delete this user. Soft-delete preserves data for recovery.
          </p>
          <div className="flex gap-3">
            <label className={`flex-1 rounded-md border p-4 cursor-pointer transition-colors ${kind === "soft_delete" ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-surface hover:bg-surface-muted"}`}>
              <input className="sr-only" name="kindChoice" onChange={() => setKind("soft_delete")} checked={kind === "soft_delete"} type="radio" value="soft_delete" />
              <p className="font-black">Soft Delete</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Archive profile, sign out sessions. Recoverable.</p>
            </label>
            <label className={`flex-1 rounded-md border p-4 cursor-pointer transition-colors ${kind === "permanent_purge" ? "border-red-300 bg-red-50 ring-1 ring-red-200" : "border-border bg-surface hover:bg-surface-muted"}`}>
              <input className="sr-only" name="kindChoice" onChange={() => setKind("permanent_purge")} checked={kind === "permanent_purge"} type="radio" value="permanent_purge" />
              <p className="font-black text-red-800">Permanent Purge</p>
              <p className="mt-1 text-xs font-semibold text-red-700">Full data erasure. GDPR compliant. Irreversible.</p>
            </label>
          </div>
        </CardContent>
      </Card>

      {isPermanent && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600" />
              <p className="font-black text-red-800">Permanent Data Erasure</p>
            </div>
            <p className="text-sm leading-6 text-red-700">
              This will permanently delete <strong>{record.user.full_name}</strong> ({record.user.email}) and cascade through all associated data. <strong>This cannot be undone.</strong>
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">GDPR compliance: Full data erasure will be performed.</p>
          </CardContent>
        </Card>
      )}

      <FormField label={`Type ${isPermanent ? "PERMANENT_PURGE" : "DELETE"} to confirm`} error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder={isPermanent ? "PERMANENT_PURGE" : "DELETE"} required />
      </FormField>

      <FormField label="Reason (required for permanent purge)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder={isPermanent ? "Why is this user being permanently purged?" : "Why is this user being deleted?"} rows={2} required={isPermanent} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label={isPermanent ? "Permanently Purge" : "Soft Delete"} />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function buildMinimalRecord(invite: { id: string; full_name: string; email: string | null; status: string; created_at: string }): UserManagementRecord {
  return {
    user: { id: invite.id, gym_id: null, full_name: invite.full_name, email: invite.email, phone: null, avatar_url: null, status: invite.status as "active" | "invited" | "suspended" | "archived", created_at: invite.created_at, updated_at: invite.created_at },
    roles: [],
    primaryRole: null,
    primaryOrganization: null,
    organizations: [],
    gyms: [],
    branches: [],
    loginCount: 0,
    lastLoginAt: null,
    lastLoginSuccess: null,
    lastActivityAt: null,
    activeAssignments: 0,
    pendingApprovals: 0
  };
}

function UserDetailView({ record, onDelete }: { record: UserManagementRecord; onDelete: (record: UserManagementRecord) => void }) {
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
            <DetailLine label="Primary Org" value={record.primaryOrganization?.name ?? "None"} />
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

      {record.organizations.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Organization Access</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {record.organizations.map((org) => (
                <div className="rounded-md border border-border bg-surface p-3" key={org.id}>
                  <p className="font-bold">{org.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{org.slug}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {record.gyms.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Gym Access</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {record.gyms.map((gym) => (
                <Badge key={gym.id} variant="neutral">{gym.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {record.branches.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Branch Access</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {record.branches.map((branch) => (
                <div className="rounded-md border border-border bg-surface p-3" key={branch.id}>
                  <p className="font-bold">{branch.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">Code: {branch.branchCode}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h3 className="text-lg font-black">Sessions</h3>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label="Active Assignments" value={String(record.activeAssignments)} />
            <DetailLine label="Last Activity" value={record.lastActivityAt ? new Date(record.lastActivityAt).toLocaleString("en-IN") : "No activity"} />
            <DetailLine label="Last Login" value={record.lastLoginAt ? new Date(record.lastLoginAt).toLocaleString("en-IN") : "N/A"} />
            <DetailLine label="Login Count" value={String(record.loginCount)} />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-red-600" />
          <p className="font-black text-red-800">Danger Zone</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-red-700">
          Soft-delete this user (recoverable) or permanently purge all data (GDPR compliant, irreversible).
        </p>
        <Button className="mt-3" onClick={() => onDelete(record)} variant="secondary">
          <XCircle className="mr-2 size-4" />
          Delete / Purge
        </Button>
      </div>
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

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function AccountNotesForm({ record, onClose }: { record: UserManagementRecord; onClose: () => void }) {
  const [state, formAction] = useActionState(addAccountNoteAction, initialAuthActionState);
  const [, setNoteKey] = useState(0);
  const notes = record.accountNotes;

  useEffect(() => {
    if (state.status === "success") {
      showToast(state.message ?? "Note added.", "success");
      setNoteKey((k) => k + 1);
    }
  }, [state.status, state.message]);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <input name="userId" type="hidden" value={record.user.id} />
        <FormField label="Add a note" error={state.fieldErrors?.content}>
          <Textarea name="content" placeholder="Enter account note..." rows={3} required />
        </FormField>
        <FormMessage state={state} />
        <div className="flex gap-3">
          <SubmitButton label="Add Note" />
          <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
        </div>
      </form>

      <div className="space-y-3">
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground">Note History</h4>
        {notes.length > 0 ? (
          [...notes].reverse().map((note) => (
            <div key={note.id} className="rounded-md border border-border bg-background p-3">
              <p className="text-sm">{note.content}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {note.authorName} · {formatTimeAgo(note.createdAt)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">No notes yet.</p>
        )}
      </div>
    </div>
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
