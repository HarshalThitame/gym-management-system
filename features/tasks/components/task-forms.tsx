"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FormMessage } from "@/features/auth/components/form-message";
import { saveTaskAction, completeTaskAction, startTaskAction } from "../actions/task-actions";
import type { TaskRow } from "@/types/tasks";

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

export function TaskForm({ task }: { task?: TaskRow }) {
  const [state, formAction] = useActionState(saveTaskAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {task?.id ? <input name="taskId" type="hidden" value={task.id} /> : null}

      <Field id="task-title" label="Title">
        <Input id="task-title" name="title" placeholder="Task title" defaultValue={task?.title ?? ""} />
      </Field>

      <Field id="task-description" label="Description (optional)">
        <Textarea id="task-description" name="description" placeholder="Task details..." defaultValue={task?.description ?? ""} />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field id="task-type" label="Type">
          <select className={selectField} name="type" defaultValue={task?.type ?? "general"}>
            <option value="follow_up">Follow-Up</option>
            <option value="renewal">Renewal</option>
            <option value="payment">Payment</option>
            <option value="appointment">Appointment</option>
            <option value="general">General</option>
          </select>
        </Field>

        <Field id="task-priority" label="Priority">
          <select className={selectField} name="priority" defaultValue={task?.priority ?? "medium"}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>

        <Field id="task-due-date" label="Due date (optional)">
          <Input id="task-due-date" name="dueDate" type="datetime-local" defaultValue={task?.due_date ? task.due_date.slice(0, 16) : ""} />
        </Field>
      </div>

      <Field id="task-notes" label="Notes (optional)">
        <Textarea id="task-notes" name="notes" placeholder="Staff notes..." defaultValue={task?.notes ?? ""} />
      </Field>

      <AuthSubmitButton>
        {task?.id ? "Update Task" : "Create Task"}
      </AuthSubmitButton>
    </form>
  );
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  if (priority === "urgent") return <Badge variant="danger-glow">Urgent</Badge>;
  if (priority === "high") return <Badge variant="warning-glow">High</Badge>;
  if (priority === "medium") return <Badge variant="gradient">Medium</Badge>;
  if (priority === "low") return <Badge variant="neutral">Low</Badge>;
  return <Badge variant="neutral">{priority}</Badge>;
}

export function TaskStatusBadge({ status }: { status: string }) {
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  if (status === "in_progress") return <Badge variant="pulse">In Progress</Badge>;
  if (status === "completed") return <Badge variant="success-glow">Completed</Badge>;
  if (status === "cancelled") return <Badge variant="danger-glow">Cancelled</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

export function TaskTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    follow_up: "Follow-Up",
    renewal: "Renewal",
    payment: "Payment",
    appointment: "Appointment",
    general: "General"
  };
  return (
    <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
      {labels[type] ?? type}
    </span>
  );
}
