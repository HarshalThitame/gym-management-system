import { addDays, differenceInCalendarDays, endOfMonth, formatISO, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";
import type { MembershipPlanRow, MembershipRow, MembershipStatus } from "@/types/membership";

export const planTypeDefaultDurations = {
  monthly: 30,
  quarterly: 90,
  half_yearly: 182,
  annual: 365,
  custom: 30
} as const;

export function slugifyPlanName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDateInput(date: Date) {
  return formatISO(date, { representation: "date" });
}

export function calculateEndDate(startDate: string, durationDays: number) {
  return formatDateInput(addDays(parseISO(startDate), durationDays - 1));
}

export function getRemainingDays(endDate: string) {
  return Math.max(differenceInCalendarDays(parseISO(endDate), new Date()) + 1, 0);
}

export function getExpiryBucket(endDate: string, status: MembershipStatus) {
  if (status !== "active") {
    return status === "expired" ? "expired" : "not_active";
  }

  const today = new Date();
  const expiryDate = parseISO(endDate);
  const days = differenceInCalendarDays(expiryDate, today);

  if (days < 0) {
    return "expired";
  }
  if (days === 0) {
    return "today";
  }
  if (days <= 7) {
    return "this_week";
  }
  if (days <= 30) {
    return "this_month";
  }
  return "future";
}

export function validateMembershipDates(startDate: string, endDate: string) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Membership dates are invalid.";
  }

  if (isBefore(end, start)) {
    return "Expiry date must be after the start date.";
  }

  return null;
}

export function validateRenewalSource(membership: MembershipRow) {
  if (membership.status === "cancelled") {
    return "Cancelled memberships cannot be renewed directly. Reactivate or create a new enrollment.";
  }

  if (membership.status === "suspended") {
    return "Suspended memberships require reactivation before renewal.";
  }

  return null;
}

export function validateStatusTransition(currentStatus: MembershipStatus, nextStatus: MembershipStatus) {
  if (currentStatus === nextStatus) {
    return "Choose a different status.";
  }

  if (currentStatus === "cancelled") {
    return "Cancelled memberships are final. Create a new membership instead.";
  }

  const allowed: Record<MembershipStatus, MembershipStatus[]> = {
    pending: ["active", "cancelled"],
    active: ["frozen", "suspended", "cancelled", "expired"],
    frozen: ["active", "cancelled", "expired"],
    suspended: ["active", "cancelled"],
    expired: ["active"],
    cancelled: []
  };

  return allowed[currentStatus].includes(nextStatus) ? null : `Cannot move a ${currentStatus} membership to ${nextStatus}.`;
}

export function classifyPlanChange(currentPlan: MembershipPlanRow, nextPlan: MembershipPlanRow) {
  if (nextPlan.price_amount > currentPlan.price_amount) {
    return "upgraded" as const;
  }

  if (nextPlan.price_amount < currentPlan.price_amount) {
    return "downgraded" as const;
  }

  return "plan_changed" as const;
}

export function isCurrentMonth(dateValue: string) {
  const value = parseISO(dateValue);
  const today = new Date();
  return !isBefore(value, startOfMonth(today)) && !isAfter(value, endOfMonth(today));
}

export function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount / 100);
}

export function membershipStatusTone(status: MembershipStatus) {
  switch (status) {
    case "active":
      return "text-success bg-success/10 border-success/20";
    case "pending":
    case "frozen":
      return "text-warning bg-warning/10 border-warning/20";
    case "expired":
    case "cancelled":
    case "suspended":
      return "text-destructive bg-destructive/10 border-destructive/20";
    default:
      return "text-muted-foreground bg-surface-muted border-border";
  }
}
