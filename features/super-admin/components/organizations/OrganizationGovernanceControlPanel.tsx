"use client";

import { useActionState, useEffect } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Gavel, Loader2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { organizationLegalHoldAction, organizationLifecycleAction } from "../../actions/organization-actions";
import type { OrganizationManagementRecord } from "../../services/organization-management-service";

type OrganizationGovernanceControlPanelProps = {
  criticalSuperAdminEmail: string;
  record: OrganizationManagementRecord;
};

export function OrganizationGovernanceControlPanel({ criticalSuperAdminEmail, record }: OrganizationGovernanceControlPanelProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <LegalHoldCard criticalSuperAdminEmail={criticalSuperAdminEmail} record={record} />
      <PermanentPurgeCard criticalSuperAdminEmail={criticalSuperAdminEmail} record={record} />
    </section>
  );
}

function LegalHoldCard({ criticalSuperAdminEmail, record }: OrganizationGovernanceControlPanelProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(organizationLegalHoldAction, initialAuthActionState);
  const legalHoldActive = record.legalHold.active;

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gavel aria-hidden="true" className="size-5 text-secondary" />
              <h3 className="text-2xl font-black">Legal Hold</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Apply a litigation or compliance hold to block permanent purge until explicitly released.
            </p>
          </div>
          <Badge variant={legalHoldActive ? "error" : "success"}>{legalHoldActive ? "Hold Active" : "No Hold"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormMessage state={state} />
        <div className="rounded-md border border-border bg-background p-4">
          <Line label="Current state" value={legalHoldActive ? "Active" : "Inactive"} />
          <Line label="Reason" value={record.legalHold.reason ?? "Not recorded"} />
          <Line label="Updated" value={record.legalHold.updatedAt ? <HydrationSafeDate date={record.legalHold.updatedAt} format="datetime" /> : "Not recorded"} />
        </div>
        <form action={formAction} className="grid gap-4">
          <input name="organizationId" type="hidden" value={record.organization.id} />
          <input name="action" type="hidden" value={legalHoldActive ? "release" : "hold"} />
          <Field error={state.fieldErrors?.reason?.[0]} label={legalHoldActive ? "Release reason" : "Legal hold reason"}>
            <Textarea className="min-h-24" name="reason" placeholder={legalHoldActive ? "Why is the hold being released?" : "Legal case, compliance investigation, or executive hold reason."} />
          </Field>
          <Field error={state.fieldErrors?.confirmation?.[0]} label="Confirmation">
            <Input name="confirmation" placeholder={legalHoldActive ? "Type RELEASE" : "Type HOLD"} />
          </Field>
          <Field error={state.fieldErrors?.stepUpEmail?.[0]} label="Step-up identity check">
            <Input autoComplete="email" name="stepUpEmail" placeholder={`Type ${criticalSuperAdminEmail}`} type="email" />
          </Field>
          <CriticalNotice criticalSuperAdminEmail={criticalSuperAdminEmail} />
          <SubmitButton variant={legalHoldActive ? "primary" : "destructive"}>
            {legalHoldActive ? "Release Legal Hold" : "Apply Legal Hold"}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function PermanentPurgeCard({ criticalSuperAdminEmail, record }: OrganizationGovernanceControlPanelProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(organizationLifecycleAction, initialAuthActionState);
  const eligible = record.purgeEligibility.eligible;
  const confirmation = `PURGE:${record.organization.slug}`;

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Trash2 aria-hidden="true" className="size-5 text-red-600" />
              <h3 className="text-2xl font-black">Permanent Purge</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Purge customer-identifying tenant data only after soft delete, restore-window closure, legal hold release, and MFA-protected approval.
            </p>
          </div>
          <Badge variant={eligible ? "warning" : "neutral"}>{eligible ? "Requestable" : "Blocked"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormMessage state={state} />
        <div className="rounded-md border border-border bg-background p-4">
          <Line label="Tenant status" value={formatEnterpriseLabel(record.organization.status)} />
          <Line label="Restore until" value={record.softDelete.restoreUntil ? <HydrationSafeDate date={record.softDelete.restoreUntil} format="datetime" /> : "No restore window"} />
          <Line label="Legal hold" value={record.legalHold.active ? "Active" : "Inactive"} />
        </div>
        <div className={eligible ? "rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900" : "rounded-md border border-border bg-background p-4 text-sm font-semibold leading-6 text-muted-foreground"}>
          <div className="flex items-center gap-2 font-black">
            {eligible ? <AlertTriangle aria-hidden="true" className="size-4" /> : <Lock aria-hidden="true" className="size-4" />}
            {eligible ? "Purge can be requested" : "Purge blockers"}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {record.purgeEligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
        <form action={formAction} className="grid gap-4">
          <input name="organizationId" type="hidden" value={record.organization.id} />
          <input name="action" type="hidden" value="purge" />
          <Field error={state.fieldErrors?.reason?.[0]} label="Purge reason">
            <Textarea className="min-h-24" disabled={!eligible} name="reason" placeholder="Customer closure, retention period complete, or governance reason." />
          </Field>
          <Field error={state.fieldErrors?.confirmation?.[0]} label="Confirmation">
            <Input disabled={!eligible} name="confirmation" placeholder={`Type ${confirmation}`} />
          </Field>
          <Field error={state.fieldErrors?.stepUpEmail?.[0]} label="Step-up identity check">
            <Input autoComplete="email" disabled={!eligible} name="stepUpEmail" placeholder={`Type ${criticalSuperAdminEmail}`} type="email" />
          </Field>
          <CriticalNotice criticalSuperAdminEmail={criticalSuperAdminEmail} />
          <SubmitButton disabled={!eligible} variant="destructive">Request Permanent Purge</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function CriticalNotice({ criticalSuperAdminEmail }: { criticalSuperAdminEmail: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900 md:flex-row md:items-center md:justify-between">
      <span>Critical governance actions require {criticalSuperAdminEmail} plus a fresh MFA verification within 10 minutes.</span>
      <ButtonLink href="/super-admin/security/mfa" rel="noreferrer" size="sm" target="_blank" variant="secondary">
        <ShieldCheck aria-hidden="true" className="size-4" />
        Open MFA
      </ButtonLink>
    </div>
  );
}

function Field({ children, error, label }: { children: ReactNode; error: string | undefined; label: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-bold">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function SubmitButton({ children, disabled = false, variant }: { children: string; disabled?: boolean; variant: "primary" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending || disabled} type="submit" variant={variant}>
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? "Processing" : children}
    </Button>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-black">{value}</span>
    </div>
  );
}

export default OrganizationGovernanceControlPanel;
