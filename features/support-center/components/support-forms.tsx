"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { TicketWithMessages } from "../services/support-service";
import {
  createTicketAction,
  updateTicketStatusAction,
  addTicketMessageAction,
  assignTicketAction
} from "../actions/support-actions";

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

export function CreateTicketForm() {
  const [state, formAction] = useActionState(createTicketAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <Field name="subject" label="Subject" state={state}>
        <Input id="subject" name="subject" required placeholder="Brief description of the issue" />
      </Field>
      <Field name="description" label="Description" state={state}>
        <Textarea id="description" name="description" required rows={4} placeholder="Detailed description of the issue..." />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="customerName" label="Customer Name" state={state}>
          <Input id="customerName" name="customerName" required />
        </Field>
        <Field name="customerEmail" label="Customer Email" state={state}>
          <Input id="customerEmail" name="customerEmail" type="email" />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="customerPhone" label="Customer Phone" state={state}>
          <Input id="customerPhone" name="customerPhone" type="tel" />
        </Field>
        <Field name="customerType" label="Customer Type" state={state}>
          <select id="customerType" name="customerType" className={selectClass} defaultValue="member">
            <option value="member">Member</option>
            <option value="prospect">Prospect</option>
            <option value="staff">Staff</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="priority" label="Priority" state={state}>
          <select id="priority" name="priority" className={selectClass} defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field name="assignedTeam" label="Assigned Team" state={state}>
          <Input id="assignedTeam" name="assignedTeam" placeholder="e.g., Technical Support" />
        </Field>
      </div>
      <AuthSubmitButton>Create Ticket</AuthSubmitButton>
    </form>
  );
}

export function TicketStatusForm({ ticketId, currentStatus }: { ticketId: string; currentStatus: string }) {
  const [state, formAction] = useActionState(updateTicketStatusAction, initialAuthActionState);

  return (
    <form action={formAction} className="flex gap-2">
      <HiddenInput name="ticketId" value={ticketId} />
      <select name="status" className={selectClass} defaultValue={currentStatus} required>
        <option value="open">Open</option>
        <option value="pending">Pending</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
      <AuthSubmitButton>Update</AuthSubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function TicketMessageForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState(addTicketMessageAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="ticketId" value={ticketId} />
      <Field name="message" label="Add Message" state={state}>
        <Textarea id="message" name="message" required rows={3} placeholder="Type your response..." />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isInternal" className="size-4 rounded border-border" />
        <span>Internal note (not visible to customer)</span>
      </label>
      <AuthSubmitButton>Send Message</AuthSubmitButton>
    </form>
  );
}

export function AssignTicketForm({ ticketId, currentAssignee }: { ticketId: string; currentAssignee: string | null }) {
  const [state, formAction] = useActionState(assignTicketAction, initialAuthActionState);

  return (
    <form action={formAction} className="flex gap-2">
      <HiddenInput name="ticketId" value={ticketId} />
      <Input
        name="assignedTo"
        placeholder="Assign to user ID"
        defaultValue={currentAssignee ?? ""}
      />
      <AuthSubmitButton>Assign</AuthSubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
