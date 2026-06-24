import { addDays, differenceInMinutes, formatISO, isAfter, isBefore, parseISO } from "date-fns";
import type { ClassEligibilityResult, ClassRow, ClassScheduleRow, ClassSessionRow } from "@/types/classes";
import type { MembershipRow } from "@/types/membership";

export function slugifyClassName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatClassLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function calculateClassDurationMinutes(startsAt: string, endsAt: string) {
  return Math.max(timeToMinutes(endsAt) - timeToMinutes(startsAt), 0);
}

export function getAvailableSeats(session: Pick<ClassSessionRow, "capacity" | "reserved_capacity" | "booked_count">) {
  return Math.max(session.capacity - session.reserved_capacity - session.booked_count, 0);
}

export function isSessionBookable(session: ClassSessionRow, classRow: Pick<ClassRow, "booking_window_days">, now = new Date()) {
  if (session.status !== "scheduled") {
    return false;
  }

  const sessionStartsAt = parseISO(`${session.session_date}T${session.starts_at}`);
  const bookingOpensAt = addDays(sessionStartsAt, -classRow.booking_window_days);
  return !isBefore(now, bookingOpensAt) && isAfter(sessionStartsAt, now);
}

export function canCancelClassBooking(session: Pick<ClassSessionRow, "session_date" | "starts_at">, classRow: Pick<ClassRow, "cancellation_window_hours">, now = new Date()) {
  const sessionStartsAt = parseISO(`${session.session_date}T${session.starts_at}`);
  const minutesUntilClass = differenceInMinutes(sessionStartsAt, now);
  return minutesUntilClass >= classRow.cancellation_window_hours * 60;
}

export function validateClassEligibility(classRow: Pick<ClassRow, "membership_access" | "requires_approval">, membership: MembershipRow | null): ClassEligibilityResult {
  if (classRow.membership_access === "public_event") {
    return { allowed: true, reasonCode: "public_event", message: "Public event access allowed.", membership };
  }

  if (!membership) {
    return { allowed: false, reasonCode: "no_active_membership", message: "An active membership is required before booking this class.", membership: null };
  }

  if (membership.status !== "active") {
    return { allowed: false, reasonCode: "membership_not_active", message: "Membership must be active before booking this class.", membership };
  }

  if (membership.payment_status === "pending") {
    return { allowed: false, reasonCode: "payment_pending", message: "Membership payment is pending. Booking is unavailable.", membership };
  }

  if (isBefore(parseISO(membership.end_date), startOfDay(new Date()))) {
    return { allowed: false, reasonCode: "membership_expired", message: "Membership has expired. Renew before booking.", membership };
  }

  if (classRow.membership_access === "staff_approval" || classRow.requires_approval) {
    return { allowed: false, reasonCode: "staff_approval_required", message: "This class requires staff approval before booking.", membership };
  }

  return { allowed: true, reasonCode: "eligible", message: "Member is eligible to book this class.", membership };
}

export function buildScheduleDates(schedule: Pick<ClassScheduleRow, "recurrence" | "start_date" | "end_date" | "day_of_week" | "day_of_month">, limit = 32, now = new Date()) {
  const dates: string[] = [];
  const start = parseISO(schedule.start_date);
  const end = schedule.end_date ? parseISO(schedule.end_date) : addDays(start, 60);
  let cursor = isBefore(start, startOfDay(now)) ? startOfDay(now) : start;

  while (!isAfter(cursor, end) && dates.length < limit) {
    if (matchesRecurrence(cursor, schedule, start)) {
      dates.push(formatISO(cursor, { representation: "date" }));
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function hasScheduleConflict(
  candidate: { trainerId: string | null; sessionDate: string; startsAt: string; endsAt: string },
  existing: Array<{ primary_trainer_id: string | null; substitute_trainer_id: string | null; gym_id?: string | null; session_date: string; starts_at: string; ends_at: string; status: string }>,
  trainerAssignedGyms?: string[] | null
) {
  if (!candidate.trainerId) {
    return false;
  }

  const start = timeToMinutes(candidate.startsAt);
  const end = timeToMinutes(candidate.endsAt);
  return existing.some((session) => {
    const sessionTrainerId = session.substitute_trainer_id ?? session.primary_trainer_id;
    if (sessionTrainerId !== candidate.trainerId || session.session_date !== candidate.sessionDate || session.status === "cancelled") {
      return false;
    }
    // If trainerAssignedGyms provided, only check conflicts within trainer's assigned gyms
    if (trainerAssignedGyms && trainerAssignedGyms.length > 0 && session.gym_id && !trainerAssignedGyms.includes(session.gym_id)) {
      return false;
    }
    const otherStart = timeToMinutes(session.starts_at);
    const otherEnd = timeToMinutes(session.ends_at);
    return start < otherEnd && end > otherStart;
  });
}

function matchesRecurrence(cursor: Date, schedule: Pick<ClassScheduleRow, "recurrence" | "day_of_week" | "day_of_month">, start: Date) {
  if (schedule.recurrence === "one_time") {
    return formatISO(cursor, { representation: "date" }) === formatISO(start, { representation: "date" });
  }
  if (schedule.recurrence === "daily") {
    return true;
  }
  if (schedule.recurrence === "weekly") {
    return cursor.getDay() === (schedule.day_of_week ?? start.getDay());
  }
  if (schedule.recurrence === "monthly") {
    return cursor.getDate() === (schedule.day_of_month ?? start.getDate());
  }
  return cursor.getDay() === (schedule.day_of_week ?? start.getDay());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
