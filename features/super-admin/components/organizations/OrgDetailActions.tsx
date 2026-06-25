"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Edit3,
  Loader2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Trash2,
  UserRoundCog,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { organizationStatuses } from "@/types/enterprise";
import {
  organizationLifecycleAction,
  saveSuperAdminOrganizationAction,
  transferOrganizationOwnerAction
} from "../../actions/organization-actions";
import type { OrganizationDetailData, OrganizationManagementRecord, OrganizationOwnerCandidate } from "../../services/organization-management-service";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";
type LifecycleAction = "suspend" | "activate" | "delete" | "restore" | "purge";

type DrawerState =
  | { type: "closed" }
  | { type: "edit"; record: OrganizationManagementRecord }
  | { type: "transfer"; record: OrganizationManagementRecord }
  | { type: "lifecycle"; record: OrganizationManagementRecord; action: LifecycleAction };

export function OrgDetailActions({ children, criticalSuperAdminEmail, data }: { children: ReactNode; criticalSuperAdminEmail: string; data: OrganizationDetailData }) {
  const [drawer, setDrawer] = useState<DrawerState>({ type: "closed" });
  const record = data.record;
  const organization = record.organization;
  const canActivate = organization.status === "suspended" || organization.status === "deactivated";
  const canSuspend = organization.status === "active" || organization.status === "trial";
  const canRestore = organization.status === "archived" && record.softDelete.restoreAvailable;
  const canPurge = organization.status === "archived" && record.purgeEligibility.eligible;
  const canDelete = organization.status !== "archived";

  return (
    <>
      <div className="sticky top-0 z-10 -mx-6 mb-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md px-5 py-3 shadow-[0_18px_60px_rgb(17_18_20/0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-muted-foreground">Actions:</span>
            <button
              onClick={() => setDrawer({ type: "edit", record })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted hover:border-border-strong transition-all"
            >
              <Edit3 className="size-4" /> Edit Profile
            </button>
            <button
              onClick={() => setDrawer({ type: "transfer", record })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted hover:border-border-strong transition-all"
            >
              <UserRoundCog className="size-4" /> Transfer Owner
            </button>
            {canSuspend && (
              <button
                onClick={() => setDrawer({ type: "lifecycle", record, action: "suspend" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all"
              >
                <PauseCircle className="size-4" /> Suspend
              </button>
            )}
            {canActivate && (
              <button
                onClick={() => setDrawer({ type: "lifecycle", record, action: "activate" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all"
              >
                <PlayCircle className="size-4" /> Activate
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDrawer({ type: "lifecycle", record, action: "delete" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all"
              >
                <Trash2 className="size-4" /> Delete Org
              </button>
            )}
            {canRestore && (
              <button
                onClick={() => setDrawer({ type: "lifecycle", record, action: "restore" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
              >
                <RotateCcw className="size-4" /> Restore
              </button>
            )}
            {canPurge && (
              <button
                onClick={() => setDrawer({ type: "lifecycle", record, action: "purge" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-red-50 hover:text-red-800 hover:border-red-200 transition-all"
              >
                <XCircle className="size-4" /> Purge
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-green-500" />
            All actions require MFA
          </div>
        </div>
      </div>

      {children}

      <DetailDrawer criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} drawer={drawer} onClose={() => setDrawer({ type: "closed" })} />
    </>
  );
}

function DetailDrawer({ criticalSuperAdminEmail, data, drawer, onClose }: { criticalSuperAdminEmail: string; data: OrganizationDetailData; drawer: DrawerState; onClose: () => void }) {
  if (drawer.type === "closed") {
    return null;
  }

  if (drawer.type === "edit") {
    return <DetailEditDrawer data={data} onClose={onClose} record={drawer.record} />;
  }

  if (drawer.type === "transfer") {
    return <DetailTransferDrawer candidates={data.ownerCandidates} criticalSuperAdminEmail={criticalSuperAdminEmail} onClose={onClose} record={drawer.record} />;
  }

  return <DetailLifecycleDrawer action={drawer.action} criticalSuperAdminEmail={criticalSuperAdminEmail} onClose={onClose} record={drawer.record} />;
}

function DetailEditDrawer({ data, onClose, record }: { data: OrganizationDetailData; onClose: () => void; record: OrganizationManagementRecord }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveSuperAdminOrganizationAction, initialAuthActionState);
  const profile = businessProfile(record.organization.settings);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.status]);

  return (
    <DrawerShell onClose={onClose} title="Edit Organization">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />
        <input name="organizationId" suppressHydrationWarning type="hidden" value={record.organization.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.name?.[0]} label="Organization name">
            <Input name="name" placeholder="Apex Fitness Group" required defaultValue={record.organization.name} />
          </Field>
          <Field error={state.fieldErrors?.slug?.[0]} label="Slug">
            <Input name="slug" placeholder="apex-fitness-group" defaultValue={record.organization.slug} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField defaultValue={record.organization.status} label="Status" name="status" options={organizationStatuses} />
          <Field error={state.fieldErrors?.billingEmail?.[0]} label="Billing email">
            <Input name="billingEmail" placeholder="billing@apexfit.com" type="email" defaultValue={record.organization.billing_email ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field error={state.fieldErrors?.primaryDomain?.[0]} label="Primary domain">
            <Input name="primaryDomain" placeholder="apexfit.com" defaultValue={record.organization.primary_domain ?? ""} />
          </Field>
          <SelectOwner candidates={data.ownerCandidates} defaultValue={record.organization.owner_user_id ?? ""} error={state.fieldErrors?.ownerUserId?.[0]} />
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
          <SubmitButton>Save Changes</SubmitButton>
        </div>
      </form>
    </DrawerShell>
  );
}

function DetailTransferDrawer({ candidates, onClose, record }: { candidates: OrganizationOwnerCandidate[]; criticalSuperAdminEmail?: string; onClose: () => void; record: OrganizationManagementRecord }) {
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

function DetailLifecycleDrawer({ action, onClose, record }: { action: LifecycleAction; criticalSuperAdminEmail?: string; onClose: () => void; record: OrganizationManagementRecord }) {
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
          <SubmitButton variant={action === "suspend" || action === "delete" || action === "purge" ? "destructive" : "primary"}>
            {isDelete && forceDelete ? "Force Delete Immediately" : isDelete ? "Request Soft Delete" : isPurge ? "Request Purge" : action === "suspend" ? "Request Suspension" : isRestore ? "Restore Organization" : "Activate Organization"}
          </SubmitButton>
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

function businessProfile(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { legalName: "", gstNumber: "", phone: "", address: "", supportNotes: "" };
  }
  const root = settings as Record<string, unknown>;
  const profile = root.businessProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return { legalName: "", gstNumber: "", phone: "", address: "", supportNotes: "" };
  }
  const value = profile as Record<string, unknown>;
  return {
    legalName: typeof value.legalName === "string" ? value.legalName : "",
    gstNumber: typeof value.gstNumber === "string" ? value.gstNumber : "",
    phone: typeof value.phone === "string" ? value.phone : "",
    address: typeof value.address === "string" ? value.address : "",
    supportNotes: typeof value.supportNotes === "string" ? value.supportNotes : "",
  };
}