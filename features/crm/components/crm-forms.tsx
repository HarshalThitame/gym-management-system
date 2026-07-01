"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { LeadWithRelations } from "../services/crm-service";
import type { Database } from "@/types/database";
import {
  saveLeadAction,
  saveLeadStatusAction,
  saveLeadSourceAction,
  updateLeadStatusAction,
  saveFollowupAction,
  convertLeadAction,
  markLeadLostAction
} from "../actions/crm-actions";

type CrmLeadStatusRow = Database["public"]["Tables"]["crm_lead_statuses"]["Row"];
type CrmLeadSourceRow = Database["public"]["Tables"]["crm_lead_sources"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

export function LeadForm({ lead, statuses, sources }: { lead?: LeadWithRelations | null; statuses: CrmLeadStatusRow[]; sources: CrmLeadSourceRow[] }) {
  const [state, formAction] = useActionState(saveLeadAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="leadId" value={lead?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="firstName" label="First Name" state={state}>
          <Input id="firstName" name="firstName" defaultValue={lead?.first_name ?? ""} required />
        </Field>
        <Field name="lastName" label="Last Name" state={state}>
          <Input id="lastName" name="lastName" defaultValue={lead?.last_name ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="email" label="Email" state={state}>
          <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
        </Field>
        <Field name="phone" label="Phone" state={state}>
          <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="dateOfBirth" label="Date of Birth" state={state}>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={lead?.date_of_birth ?? ""} />
        </Field>
        <Field name="gender" label="Gender" state={state}>
          <select id="gender" name="gender" className={selectClass} defaultValue={lead?.gender ?? ""}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="referralSource" label="Referral Source" state={state}>
          <select id="referralSource" name="referralSource" className={selectClass} defaultValue={lead?.source_id ?? ""}>
            <option value="">Select</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>{source.name}</option>
            ))}
          </select>
        </Field>
        <Field name="budgetRange" label="Budget Range" state={state}>
          <Input id="budgetRange" name="budgetRange" defaultValue={lead?.budget_range ?? ""} placeholder="e.g., 5000-10000" />
        </Field>
      </div>
      <Field name="interestedIn" label="Interested In" state={state}>
        <Input id="interestedIn" name="interestedIn" defaultValue={lead?.interested_in?.join(", ") ?? ""} placeholder="e.g., Yoga, Personal Training" />
      </Field>
      <Field name="notes" label="Notes" state={state}>
        <Textarea id="notes" name="notes" defaultValue={lead?.notes ?? ""} rows={3} />
      </Field>
      <Field name="followUpDate" label="Follow-up Date" state={state}>
        <Input id="followUpDate" name="followUpDate" type="date" defaultValue={lead?.follow_up_date ?? ""} />
      </Field>
      <AuthSubmitButton>{lead ? "Update Lead" : "Create Lead"}</AuthSubmitButton>
    </form>
  );
}

export function LeadStatusForm({ status }: { status?: CrmLeadStatusRow | null }) {
  const [state, formAction] = useActionState(saveLeadStatusAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="statusId" value={status?.id ?? ""} />
      <Field name="name" label="Status Name" state={state}>
        <Input id="name" name="name" defaultValue={status?.name ?? ""} required />
      </Field>
      <Field name="code" label="Status Code" state={state}>
        <Input id="code" name="code" defaultValue={status?.code ?? ""} required placeholder="e.g., new, contacted, qualified" />
      </Field>
      <Field name="sortOrder" label="Sort Order" state={state}>
        <Input id="sortOrder" name="sortOrder" type="number" defaultValue={String(status?.sort_order ?? 0)} min="0" max="100" />
      </Field>
      <AuthSubmitButton>{status ? "Update Status" : "Create Status"}</AuthSubmitButton>
    </form>
  );
}

export function LeadSourceForm({ source }: { source?: CrmLeadSourceRow | null }) {
  const [state, formAction] = useActionState(saveLeadSourceAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="sourceId" value={source?.id ?? ""} />
      <Field name="name" label="Source Name" state={state}>
        <Input id="name" name="name" defaultValue={source?.name ?? ""} required />
      </Field>
      <AuthSubmitButton>{source ? "Update Source" : "Create Source"}</AuthSubmitButton>
    </form>
  );
}

export function LeadStatusUpdateForm({ leadId, currentStatusId, statuses }: { leadId: string; currentStatusId: string | null; statuses: CrmLeadStatusRow[] }) {
  const [state, formAction] = useActionState(updateLeadStatusAction, initialAuthActionState);

  return (
    <form action={formAction} className="flex gap-2">
      <HiddenInput name="leadId" value={leadId} />
      <select name="statusId" className={selectClass} defaultValue={currentStatusId ?? ""} required>
        <option value="">Select status</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>{status.name}</option>
        ))}
      </select>
      <AuthSubmitButton>Update</AuthSubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function FollowupForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useActionState(saveFollowupAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="leadId" value={leadId} />
      <Field name="notes" label="Follow-up Notes" state={state}>
        <Textarea id="notes" name="notes" required rows={3} placeholder="Add follow-up notes..." />
      </Field>
      <Field name="followUpDate" label="Next Follow-up Date" state={state}>
        <Input id="followUpDate" name="followUpDate" type="date" />
      </Field>
      <AuthSubmitButton>Add Follow-up</AuthSubmitButton>
    </form>
  );
}

export function ConvertLeadForm({ leadId, plans }: { leadId: string; plans: MembershipPlanRow[] }) {
  const [state, formAction] = useActionState(convertLeadAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="leadId" value={leadId} />
      <Field name="planId" label="Assign Plan" state={state}>
        <select id="planId" name="planId" className={selectClass} required>
          <option value="">Select a plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name} - {plan.plan_type}</option>
          ))}
        </select>
      </Field>
      <AuthSubmitButton>Convert to Member</AuthSubmitButton>
    </form>
  );
}

export function MarkLeadLostForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useActionState(markLeadLostAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="leadId" value={leadId} />
      <Field name="reason" label="Reason" state={state}>
        <Textarea id="reason" name="reason" rows={2} placeholder="Why was this lead lost?" />
      </Field>
      <AuthSubmitButton>Mark as Lost</AuthSubmitButton>
    </form>
  );
}
