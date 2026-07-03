"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FormMessage } from "@/features/auth/components/form-message";
import { saveLeadAction, updateLeadStatusAction } from "../actions/lead-actions";
import type { LeadRow } from "@/types/lead";

const selectField = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function LeadForm({ lead }: { lead?: LeadRow }) {
  const [state, formAction] = useActionState(saveLeadAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {lead?.id ? <input name="leadId" type="hidden" value={lead.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="lead-name" label="Full name">
          <Input id="lead-name" name="name" placeholder="Full name" defaultValue={lead?.name ?? ""} />
        </Field>
        <Field id="lead-phone" label="Phone">
          <Input id="lead-phone" name="phone" placeholder="Phone number" defaultValue={lead?.phone ?? ""} type="tel" />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="lead-email" label="Email (optional)">
          <Input id="lead-email" name="email" placeholder="Email address" defaultValue={lead?.email ?? ""} type="email" />
        </Field>
        <Field id="lead-source" label="Source">
          <select className={selectField} name="source" defaultValue={lead?.source ?? "walk_in"}>
            <option value="walk_in">Walk-in</option>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="referral">Referral</option>
            <option value="social_media">Social Media</option>
            <option value="event">Event</option>
            <option value="advertisement">Advertisement</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>

      <Field id="lead-interest" label="Interest (optional)">
        <Input id="lead-interest" name="interest" placeholder="e.g. Weight loss, Muscle building" defaultValue={lead?.interest ?? ""} />
      </Field>

      <Field id="lead-message" label="Message">
        <Textarea id="lead-message" name="message" placeholder="Lead enquiry details..." defaultValue={lead?.message ?? ""} />
      </Field>

      <Field id="lead-notes" label="Internal notes (optional)">
        <Textarea id="lead-notes" name="notes" placeholder="Staff notes..." defaultValue={lead?.notes ?? ""} />
      </Field>

      <Field id="lead-preferred-trial" label="Preferred trial date (optional)">
        <Input id="lead-preferred-trial" name="preferredTrialAt" type="datetime-local" defaultValue={lead?.preferred_trial_at ? lead.preferred_trial_at.slice(0, 16) : ""} />
      </Field>

      <div className="flex items-center gap-2">
        <input className="size-4 accent-accent" defaultChecked={lead?.consent_marketing ?? false} id="lead-consent" name="consentMarketing" type="checkbox" />
        <label className="text-sm font-semibold text-muted-foreground" htmlFor="lead-consent">
          Marketing consent given
        </label>
      </div>

      <AuthSubmitButton>
        {lead?.id ? "Update Lead" : "Create Lead"}
      </AuthSubmitButton>
    </form>
  );
}

export function LeadStatusForm({ lead }: { lead: LeadRow }) {
  const [state, formAction] = useActionState(updateLeadStatusAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <input name="leadId" type="hidden" value={lead.id} />
      <select className={selectField} defaultValue={lead.status} name="status">
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="visit_scheduled">Visit Scheduled</option>
        <option value="trial_active">Trial Active</option>
        <option value="not_interested">Not Interested</option>
        <option value="lost">Lost</option>
      </select>
      <Input name="notes" placeholder="Add a note with this update..." />
      <Button className="w-full" type="submit" variant="secondary">
        Update Status
      </Button>
    </form>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  if (status === "new") return <Badge variant="default">New</Badge>;
  if (status === "contacted") return <Badge variant="gradient">Contacted</Badge>;
  if (status === "visit_scheduled") return <Badge variant="pulse">Visit Scheduled</Badge>;
  if (status === "trial_active") return <Badge variant="success-glow">Trial Active</Badge>;
  if (status === "converted") return <Badge variant="success">Converted</Badge>;
  if (status === "not_interested") return <Badge variant="warning-glow">Not Interested</Badge>;
  if (status === "lost") return <Badge variant="danger-glow">Lost</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}
