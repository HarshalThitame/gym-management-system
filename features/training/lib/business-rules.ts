import { addDays, differenceInMinutes, formatISO, parse, parseISO } from "date-fns";
import type { SessionStatus } from "@/types/training";

export function slugifyTrainingName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDateInput(date: Date) {
  return formatISO(date, { representation: "date" });
}

export function calculatePackageExpiry(startsOn: string, validityDays: number) {
  return formatDateInput(addDays(parseISO(startsOn), validityDays - 1));
}

export function minutesBetweenTimes(dateValue: string, startsAt: string, endsAt: string) {
  const start = parse(`${dateValue} ${startsAt}`, "yyyy-MM-dd HH:mm", new Date());
  const end = parse(`${dateValue} ${endsAt}`, "yyyy-MM-dd HH:mm", new Date());
  return differenceInMinutes(end, start);
}

export function validateSessionWindow(dateValue: string, startsAt: string, endsAt: string) {
  const duration = minutesBetweenTimes(dateValue, startsAt, endsAt);

  if (Number.isNaN(duration)) {
    return "Session time is invalid.";
  }

  if (duration < 15) {
    return "Training sessions must be at least 15 minutes.";
  }

  if (duration > 240) {
    return "Training sessions cannot exceed 4 hours.";
  }

  return null;
}

export function validateSessionStatusChange(currentStatus: SessionStatus, nextStatus: SessionStatus) {
  if (currentStatus === nextStatus) {
    return "Choose a different session status.";
  }

  const allowed: Record<SessionStatus, SessionStatus[]> = {
    scheduled: ["completed", "missed", "cancelled", "rescheduled"],
    rescheduled: ["completed", "missed", "cancelled", "scheduled"],
    completed: [],
    missed: ["rescheduled"],
    cancelled: ["rescheduled"]
  };

  return allowed[currentStatus].includes(nextStatus) ? null : `Cannot move a ${currentStatus} session to ${nextStatus}.`;
}

export function formatTrainingLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function ptPackageStatusTone(status: string) {
  switch (status) {
    case "active":
      return "border-success/20 bg-success/10 text-success";
    case "pending_payment":
      return "border-warning/20 bg-warning/10 text-warning";
    case "completed":
      return "border-primary/20 bg-primary/10 text-foreground";
    case "expired":
    case "cancelled":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-surface-muted text-muted-foreground";
  }
}
