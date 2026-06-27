import { describe, expect, it } from "vitest";
import { classRowsToCsv } from "@/features/classes/lib/csv";
import { classRowsToExcel, classRowsToPdf } from "@/features/classes/lib/report-export";
import {
  buildScheduleDates,
  calculateClassDurationMinutes,
  canCancelClassBooking,
  getAvailableSeats,
  hasScheduleConflict,
  slugifyClassName,
  validateClassEligibility
} from "@/features/classes/lib/business-rules";
import type { ClassBookingRow, ClassRow, ClassScheduleRow, ClassSessionRow } from "@/types/classes";
import type { MembershipRow } from "@/types/membership";

const activeMembership: MembershipRow = {
  id: "membership-1",
  gym_id: "gym-1",
  member_id: "member-1",
  branch_id: null,
  membership_plan_id: "plan-1",
  status: "active",
  start_date: "2026-06-01",
  end_date: "2026-12-31",
  activated_at: null,
  cancelled_at: null,
  frozen_at: null,
  suspended_at: null,
  renewal_of_membership_id: null,
  source: "manual",
  price_amount: 500000,
  joining_fee_amount: 0,
  discount_amount: 0,
  total_amount: 500000,
  invoice_number: null,
  payment_status: "paid",
  notes: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z"
};

describe("class scheduling rules", () => {
  it("slugifies class names and calculates time windows", () => {
    expect(slugifyClassName("Signature Strength Club!")).toBe("signature-strength-club");
    expect(calculateClassDurationMinutes("07:15", "08:30")).toBe(75);
  });

  it("generates weekly schedule dates", () => {
    const schedule = buildScheduleRow({ recurrence: "weekly", start_date: "2026-06-01", end_date: "2026-06-30", day_of_week: 1 });

    expect(buildScheduleDates(schedule, 10, new Date("2026-06-01T00:00:00.000Z"))).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
      "2026-06-29"
    ]);
  });

  it("detects trainer overlap conflicts", () => {
    expect(hasScheduleConflict(
      { trainerId: "trainer-1", sessionDate: "2026-06-10", startsAt: "07:30", endsAt: "08:30" },
      [{ primary_trainer_id: "trainer-1", substitute_trainer_id: null, session_date: "2026-06-10", starts_at: "07:00", ends_at: "08:00", status: "scheduled" }]
    )).toBe(true);
  });
});

describe("class booking rules", () => {
  it("calculates available class seats", () => {
    expect(getAvailableSeats({ capacity: 20, reserved_capacity: 2, booked_count: 15 })).toBe(3);
  });

  it("validates active member access", () => {
    expect(validateClassEligibility(buildClassRow(), activeMembership).allowed).toBe(true);
    expect(validateClassEligibility(buildClassRow({ membership_access: "staff_approval" }), activeMembership).reasonCode).toBe("staff_approval_required");
    expect(validateClassEligibility(buildClassRow(), null).reasonCode).toBe("no_active_membership");
  });

  it("enforces cancellation windows", () => {
    const session = buildSessionRow({ session_date: "2026-06-10", starts_at: "10:00" });
    const classRow = buildClassRow({ cancellation_window_hours: 4 });

    expect(canCancelClassBooking(session, classRow, new Date("2026-06-10T05:00:00"))).toBe(true);
    expect(canCancelClassBooking(session, classRow, new Date("2026-06-10T07:00:00"))).toBe(false);
  });
});

describe("class reports", () => {
  it("exports class booking reports as CSV, Excel, and PDF", async () => {
    const report = { type: "bookings" as const, rows: [buildBookingRow()] };

    expect(classRowsToCsv(report)).toContain("booking-1");
    expect(classRowsToExcel(report)).toContain("Class Booking Report");
    expect(new TextDecoder().decode((await classRowsToPdf(report)).slice(0, 4))).toBe("%PDF");
  });
});

function buildClassRow(overrides: Partial<ClassRow> = {}): ClassRow {
  return {
    id: "class-1",
    gym_id: "gym-1",
    branch_id: null,
    category_id: "category-1",
    name: "Signature Strength",
    slug: "signature-strength",
    description: "A complete strength class.",
    class_type: "group_class",
    difficulty: "all_levels",
    duration_minutes: 60,
    default_capacity: 20,
    reserved_capacity: 0,
    booking_window_days: 14,
    cancellation_window_hours: 4,
    requirements: null,
    location: "Studio A",
    membership_access: "active_members",
    requires_approval: false,
    price_amount: 0,
    currency: "INR",
    status: "active",
    calendar_integration: {},
    metadata: {},
    created_by: null,
    archived_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function buildSessionRow(overrides: Partial<ClassSessionRow> = {}): ClassSessionRow {
  return {
    id: "session-1",
    gym_id: "gym-1",
    branch_id: null,
    class_id: "class-1",
    schedule_id: null,
    primary_trainer_id: "trainer-1",
    substitute_trainer_id: null,
    session_date: "2026-06-10",
    starts_at: "07:00",
    ends_at: "08:00",
    capacity: 20,
    reserved_capacity: 0,
    booked_count: 0,
    waitlist_count: 0,
    status: "scheduled",
    cancellation_reason: null,
    location: "Studio A",
    notes: null,
    calendar_payload: {},
    created_by: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function buildScheduleRow(overrides: Partial<ClassScheduleRow> = {}): ClassScheduleRow {
  return {
    id: "schedule-1",
    gym_id: "gym-1",
    branch_id: null,
    class_id: "class-1",
    recurrence: "weekly",
    start_date: "2026-06-01",
    end_date: "2026-06-30",
    day_of_week: 1,
    day_of_month: null,
    starts_at: "07:00",
    ends_at: "08:00",
    timezone: "Asia/Kolkata",
    capacity_override: null,
    status: "active",
    notes: null,
    created_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function buildBookingRow(): ClassBookingRow {
  return {
    id: "booking-1",
    gym_id: "gym-1",
    branch_id: null,
    session_id: "session-1",
    class_id: "class-1",
    member_id: "member-1",
    status: "booked",
    booking_source: "member_portal",
    booked_at: "2026-06-01T00:00:00.000Z",
    cancelled_at: null,
    cancellation_reason: null,
    waitlist_id: null,
    checked_in_at: null,
    created_by: null,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z"
  };
}
