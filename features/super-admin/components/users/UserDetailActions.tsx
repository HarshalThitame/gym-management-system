"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Edit3,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  X
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { roleNames } from "@/types/auth";
import {
  deleteUserAction,
  forceLogoutUserAction,
  resetUserPasswordAction,
  saveUserProfileAction,
  transferUserRoleAction,
  updateUserStatusAction
} from "../../actions/user-management-actions";
import type { UserManagementRecord } from "../../services/user-management-service";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

type ActionDrawerState =
  | { type: "closed" }
  | { type: "edit" }
  | { type: "reset_password" }
  | { type: "force_logout" }
  | { type: "status"; action: "activate" | "suspend" | "archive" }
  | { type: "transfer_role" }
  | { type: "delete" };

type UserDetailActionsData = {
  organizations: Array<{ id: string; name: string; slug: string; status?: string }>;
  allBranches: Array<{ id: string; name: string; branch_code: string; gym_id?: string; organization_id: string }>;
  allGyms: Array<{ id: string; name: string; slug?: string; organization_id: string }>;
};

export function UserDetailActions({
  record,
  criticalSuperAdminEmail,
  data,
  children
}: {
  record: UserManagementRecord;
  criticalSuperAdminEmail: string;
  data: UserDetailActionsData;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState<ActionDrawerState>({ type: "closed" });

  return (
    <div>
      <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border py-3 -mx-4 px-4">
        <ButtonLink href="/super-admin/users" variant="secondary" size="sm">
          <ArrowLeft className="size-4" /> Back to Users
        </ButtonLink>
        <div className="w-px h-6 bg-border" />
        <Button onClick={() => setDrawer({ type: "edit" })} variant="secondary" size="sm"><Edit3 className="size-4" /> Edit Profile</Button>
        <Button onClick={() => setDrawer({ type: "reset_password" })} variant="secondary" size="sm"><KeyRound className="size-4" /> Reset Password</Button>
        <Button onClick={() => setDrawer({ type: "force_logout" })} variant="secondary" size="sm"><LogOut className="size-4" /> Force Logout</Button>
        <Button onClick={() => setDrawer({ type: "status", action: record.user.status !== "active" ? "activate" : "suspend" })} variant="secondary" size="sm"><ShieldCheck className="size-4" /> Change Status</Button>
        <Button onClick={() => setDrawer({ type: "transfer_role" })} variant="secondary" size="sm"><UserRoundCog className="size-4" /> Transfer Role</Button>
        <div className="w-px h-6 bg-border" />
        <Button onClick={() => setDrawer({ type: "delete" })} variant="destructive" size="sm"><Trash2 className="size-4" /> Delete</Button>
      </div>

      {children}

      <ActionDrawerModal
        drawer={drawer}
        onClose={() => setDrawer({ type: "closed" })}
        record={record}
        criticalSuperAdminEmail={criticalSuperAdminEmail}
        data={data}
      />

      <ToastContainer />
    </div>
  );
}

function ActionDrawerModal({
  drawer,
  onClose,
  record,
  criticalSuperAdminEmail,
  data
}: {
  drawer: ActionDrawerState;
  onClose: () => void;
  record: UserManagementRecord;
  criticalSuperAdminEmail: string;
  data: UserDetailActionsData;
}) {
  if (drawer.type === "closed") return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex">
        <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-lg border border-border bg-surface shadow-2xl animate-slide-in-right">
          <div className="flex items-center justify-between px-5 py-4 bg-background/90 backdrop-blur border-b border-border">
            <h2 className="text-lg font-black">{drawerTitle(drawer, record)}</h2>
            <Button onClick={onClose} size="icon" variant="ghost"><X className="size-5" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {drawer.type === "edit" && (
              <EditProfileForm record={record} onClose={onClose} />
            )}
            {drawer.type === "reset_password" && (
              <ResetPasswordForm record={record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
            )}
            {drawer.type === "force_logout" && (
              <ForceLogoutForm record={record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
            )}
            {drawer.type === "status" && (
              <ChangeStatusForm record={record} action={drawer.action} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
            )}
            {drawer.type === "transfer_role" && (
              <TransferRoleForm record={record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} />
            )}
            {drawer.type === "delete" && (
              <DeleteUserForm record={record} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function drawerTitle(drawer: ActionDrawerState, record: UserManagementRecord): string {
  switch (drawer.type) {
    case "edit": return `Edit: ${record.user.full_name}`;
    case "reset_password": return `Reset Password: ${record.user.full_name}`;
    case "force_logout": return `Force Logout: ${record.user.full_name}`;
    case "status": return `${formatEnterpriseLabel(drawer.action)} User`;
    case "transfer_role": return `Transfer Role: ${record.user.full_name}`;
    case "delete": return `Delete User: ${record.user.full_name}`;
    default: return "";
  }
}

function EditProfileForm({ record, onClose }: { record: UserManagementRecord; onClose: () => void }) {
  const [state, formAction] = useActionState(saveUserProfileAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">{record.user.full_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">Email: {record.user.email ?? "No email on file"}</p>
        </CardContent>
      </Card>

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

function ResetPasswordForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
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

function ForceLogoutForm({ record, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
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

function ChangeStatusForm({ record, action, onClose, criticalSuperAdminEmail }: { record: UserManagementRecord; action: "activate" | "suspend" | "archive"; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(updateUserStatusAction, initialAuthActionState);
  const [selectedAction, setSelectedAction] = useState(action);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Action completed.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  const actionLabels: Record<string, string> = { activate: "Activate", suspend: "Suspend", archive: "Archive" };
  const currentStatus = record.user.status;
  const availableActions: Array<"activate" | "suspend" | "archive"> = [];
  if (currentStatus !== "active") availableActions.push("activate");
  if (currentStatus !== "suspended") availableActions.push("suspend");
  if (currentStatus !== "archived") availableActions.push("archive");

  return (
    <form action={formAction} className="space-y-5">
      <input name="userId" type="hidden" value={record.user.id} />
      <input name="action" type="hidden" value={selectedAction} />

      <InlineMfaStepUp compact />

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-black">{record.user.full_name}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-muted-foreground">Current status:</p>
            <EnterpriseStatusBadge status={currentStatus} />
          </div>
        </CardContent>
      </Card>

      <FormField label="New status" error={state.fieldErrors?.action}>
        <select className={selectClass} name="actionSelect" value={selectedAction} onChange={(e) => setSelectedAction(e.target.value as "activate" | "suspend" | "archive")}>
          {availableActions.map((a) => (
            <option key={a} value={a}>{formatEnterpriseLabel(actionLabels[a])}</option>
          ))}
        </select>
      </FormField>

      <FormField label={`Type ${actionLabels[selectedAction].toUpperCase()} to confirm`} error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder={actionLabels[selectedAction].toUpperCase()} required />
      </FormField>

      <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder={`Why is this user being ${actionLabels[selectedAction].toLowerCase()}d?`} rows={2} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label={actionLabels[selectedAction]} />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function TransferRoleForm({ record, onClose, criticalSuperAdminEmail, data }: { record: UserManagementRecord; onClose: () => void; criticalSuperAdminEmail: string; data: UserDetailActionsData }) {
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

      <InlineMfaStepUp compact />

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
