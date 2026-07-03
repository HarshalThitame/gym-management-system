"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FormMessage } from "@/features/auth/components/form-message";
import { Badge } from "@/components/ui/badge";
import {
  saveAppointmentAction,
  cancelAppointmentAction,
  completeAppointmentAction,
  markNoShowAction
} from "../actions/appointment-actions";
import type { AppointmentWithDetails } from "@/types/appointments";
import type { MemberDirectoryItem } from "@/types/membership";
import type { TrainerRow } from "@/types/training";

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

export function AppointmentForm({
  members,
  trainers,
  appointment
}: {
  members: MemberDirectoryItem[];
  trainers: TrainerRow[];
  appointment?: AppointmentWithDetails;
}) {
  const [state, formAction] = useActionState(saveAppointmentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {appointment?.id ? <input name="appointmentId" type="hidden" value={appointment.id} /> : null}

      <Field id="appointment-title" label="Title">
        <Input
          id="appointment-title"
          name="title"
          placeholder="e.g. Initial Consultation"
          defaultValue={appointment?.title ?? ""}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="appointment-type" label="Type">
          <select className={selectField} name="type" defaultValue={appointment?.type ?? "general"}>
            <option value="consultation">Consultation</option>
            <option value="pt_session">PT Session</option>
            <option value="trial_session">Trial Session</option>
            <option value="trainer_meeting">Trainer Meeting</option>
            <option value="follow_up">Follow-Up</option>
            <option value="general">General</option>
          </select>
        </Field>

        <Field id="appointment-member" label="Member">
          <select className={selectField} name="memberId" defaultValue={appointment?.member_id ?? ""}>
            <option value="">Select member...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.member_code})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="appointment-trainer" label="Trainer (optional)">
          <select className={selectField} name="trainerId" defaultValue={appointment?.trainer_id ?? ""}>
            <option value="">No trainer</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="appointment-location" label="Location (optional)">
          <Input
            id="appointment-location"
            name="location"
            placeholder="e.g. Consultation room"
            defaultValue={appointment?.location ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="appointment-starts-at" label="Start date & time">
          <Input
            id="appointment-starts-at"
            name="startsAt"
            type="datetime-local"
            defaultValue={appointment?.starts_at ? appointment.starts_at.slice(0, 16) : ""}
          />
        </Field>

        <Field id="appointment-ends-at" label="End date & time">
          <Input
            id="appointment-ends-at"
            name="endsAt"
            type="datetime-local"
            defaultValue={appointment?.ends_at ? appointment.ends_at.slice(0, 16) : ""}
          />
        </Field>
      </div>

      <Field id="appointment-notes" label="Notes (optional)">
        <Textarea
          id="appointment-notes"
          name="notes"
          placeholder="Any additional notes..."
          defaultValue={appointment?.notes ?? ""}
        />
      </Field>

      <AuthSubmitButton>
        {appointment?.id ? "Update Appointment" : "Schedule Appointment"}
      </AuthSubmitButton>
    </form>
  );
}

export function CancelAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const [state, formAction] = useActionState(cancelAppointmentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <input name="appointmentId" type="hidden" value={appointmentId} />
      <Field id="cancel-reason" label="Cancellation reason">
        <Input id="cancel-reason" name="reason" placeholder="Reason for cancellation" />
      </Field>
      <Button className="w-full" type="submit" variant="destructive">
        Cancel Appointment
      </Button>
    </form>
  );
}

export function QuickStatusActions({ appointment }: { appointment: AppointmentWithDetails }) {
  const [completeState, completeAction] = useActionState(completeAppointmentAction, initialAuthActionState);
  const [noShowState, noShowAction] = useActionState(markNoShowAction, initialAuthActionState);

  if (appointment.status !== "scheduled" && appointment.status !== "confirmed") {
    return null;
  }

  return (
    <div className="flex gap-2">
      <form action={completeAction}>
        <input name="appointmentId" type="hidden" value={appointment.id} />
        <Button size="sm" type="submit" variant="success">
          Complete
        </Button>
      </form>
      <form action={noShowAction}>
        <input name="appointmentId" type="hidden" value={appointment.id} />
        <Button size="sm" type="submit" variant="warning">
          No-Show
        </Button>
      </form>
    </div>
  );
}

export function AppointmentStatusBadge({ status }: { status: string }) {
  if (status === "scheduled") return <Badge variant="default">Scheduled</Badge>;
  if (status === "confirmed") return <Badge variant="success">Confirmed</Badge>;
  if (status === "completed") return <Badge variant="success-glow">Completed</Badge>;
  if (status === "cancelled") return <Badge variant="danger-glow">Cancelled</Badge>;
  if (status === "no_show") return <Badge variant="warning-glow">No Show</Badge>;
  return <Badge variant="default">{status}</Badge>;
}

export function AppointmentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    consultation: "Consultation",
    pt_session: "PT Session",
    trial_session: "Trial Session",
    trainer_meeting: "Trainer Meeting",
    follow_up: "Follow-Up",
    general: "General"
  };
  return <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{labels[type] ?? type}</span>;
}
