import crypto from "node:crypto";
import { differenceInCalendarDays, differenceInMinutes, formatISO, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";
import type { MembershipRow } from "@/types/membership";

export function generateQrTokenValue() {
  return `att_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashQrToken(tokenValue: string) {
  return crypto.createHash("sha256").update(tokenValue).digest("hex");
}

export function buildQrPayload(tokenValue: string, origin?: string) {
  const baseUrl = origin?.replace(/\/$/, "") || process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://apex.local";
  return `${baseUrl}/admin/attendance?token=${encodeURIComponent(tokenValue)}`;
}

export function calculateVisitDurationMinutes(checkInAt: string, checkOutAt = new Date().toISOString()) {
  return Math.max(differenceInMinutes(parseISO(checkOutAt), parseISO(checkInAt)), 0);
}

export function validateMembershipForAccess(membership: MembershipRow | null, now = new Date()) {
  if (!membership) {
    return {
      allowed: false,
      reasonCode: "no_membership",
      message: "No membership is connected to this member."
    };
  }

  if (membership.status === "suspended") {
    return {
      allowed: false,
      reasonCode: "membership_suspended",
      message: "Membership is suspended. Entry is denied."
    };
  }

  if (membership.status === "frozen") {
    return {
      allowed: false,
      reasonCode: "membership_frozen",
      message: "Membership is frozen. Entry is denied."
    };
  }

  if (membership.status === "cancelled") {
    return {
      allowed: false,
      reasonCode: "membership_cancelled",
      message: "Membership is cancelled. Entry is denied."
    };
  }

  if (membership.status === "expired" || isBefore(parseISO(membership.end_date), startOfDay(now))) {
    return {
      allowed: false,
      reasonCode: "membership_expired",
      message: "Membership has expired. Entry is denied."
    };
  }

  if (membership.status !== "active") {
    return {
      allowed: false,
      reasonCode: "membership_not_active",
      message: "Membership is not active yet. Entry is denied."
    };
  }

  if (membership.payment_status === "pending") {
    return {
      allowed: false,
      reasonCode: "payment_pending",
      message: "Membership payment is pending. Entry requires staff approval."
    };
  }

  return {
    allowed: true,
    reasonCode: "access_granted",
    message: "Membership validated. Entry granted."
  };
}

export function getInactiveBucket(lastVisitAt: string | null, now = new Date()) {
  if (!lastVisitAt) {
    return "inactive_30_days" as const;
  }

  const inactiveDays = differenceInCalendarDays(now, parseISO(lastVisitAt));
  if (inactiveDays >= 30) {
    return "inactive_30_days" as const;
  }
  if (inactiveDays >= 15) {
    return "inactive_15_days" as const;
  }
  if (inactiveDays >= 7) {
    return "inactive_7_days" as const;
  }
  return null;
}

export function calculateCurrentStreak(visitDates: string[], now = new Date()) {
  const uniqueDates = Array.from(new Set(visitDates.map((value) => formatISO(parseISO(value), { representation: "date" })))).sort().reverse();
  let expected = formatISO(now, { representation: "date" });
  let streak = 0;

  for (const visitDate of uniqueDates) {
    if (visitDate === expected) {
      streak += 1;
      expected = formatISO(parseISO(expected), { representation: "date" });
      expected = formatISO(new Date(parseISO(expected).getTime() - 24 * 60 * 60 * 1000), { representation: "date" });
      continue;
    }

    const yesterday = formatISO(new Date(now.getTime() - 24 * 60 * 60 * 1000), { representation: "date" });
    if (streak === 0 && visitDate === yesterday) {
      streak = 1;
      expected = formatISO(new Date(parseISO(yesterday).getTime() - 24 * 60 * 60 * 1000), { representation: "date" });
      continue;
    }

    break;
  }

  return streak;
}

export function isVisitInCurrentMonth(checkInAt: string, now = new Date()) {
  const value = parseISO(checkInAt);
  return !isBefore(value, startOfMonth(now)) && !isAfter(value, now);
}

export function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
