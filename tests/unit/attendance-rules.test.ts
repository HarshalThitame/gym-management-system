import { describe, expect, it } from "vitest";
import { attendanceRowsToCsv } from "@/features/attendance/lib/csv";
import { attendanceRowsToExcel, attendanceRowsToPdf } from "@/features/attendance/lib/report-export";
import {
  buildQrPayload,
  calculateVisitDurationMinutes,
  generateQrTokenValue,
  getInactiveBucket,
  hashQrToken,
  validateMembershipForAccess
} from "@/features/attendance/lib/business-rules";
import { ManualCheckInSchema, QrCheckInSchema } from "@/features/attendance/schemas/attendance";
import type { AttendanceSessionRow } from "@/types/attendance";
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

describe("attendance access rules", () => {
  it("generates and hashes QR tokens consistently", () => {
    const token = generateQrTokenValue();
    expect(token).toMatch(/^att_/);
    expect(hashQrToken(token)).toHaveLength(64);
    expect(hashQrToken(token)).toBe(hashQrToken(token));
  });

  it("builds QR payload URLs", () => {
    expect(buildQrPayload("att_token", "https://gym.example")).toBe("https://gym.example/admin/attendance?token=att_token");
  });

  it("calculates visit duration in minutes", () => {
    expect(calculateVisitDurationMinutes("2026-06-10T07:00:00.000Z", "2026-06-10T08:15:00.000Z")).toBe(75);
  });

  it("allows active paid memberships", () => {
    expect(validateMembershipForAccess(activeMembership, new Date("2026-06-10")).allowed).toBe(true);
  });

  it("rejects frozen, suspended, cancelled, expired, and pending memberships", () => {
    expect(validateMembershipForAccess({ ...activeMembership, status: "frozen" }, new Date("2026-06-10")).reasonCode).toBe("membership_frozen");
    expect(validateMembershipForAccess({ ...activeMembership, status: "suspended" }, new Date("2026-06-10")).reasonCode).toBe("membership_suspended");
    expect(validateMembershipForAccess({ ...activeMembership, status: "cancelled" }, new Date("2026-06-10")).reasonCode).toBe("membership_cancelled");
    expect(validateMembershipForAccess({ ...activeMembership, end_date: "2026-01-01" }, new Date("2026-06-10")).reasonCode).toBe("membership_expired");
    expect(validateMembershipForAccess({ ...activeMembership, payment_status: "pending" }, new Date("2026-06-10")).reasonCode).toBe("payment_pending");
  });

  it("buckets inactive members for retention alerts", () => {
    const now = new Date("2026-06-30T09:00:00.000Z");

    expect(getInactiveBucket("2026-06-22T09:00:00.000Z", now)).toBe("inactive_7_days");
    expect(getInactiveBucket("2026-06-12T09:00:00.000Z", now)).toBe("inactive_15_days");
    expect(getInactiveBucket("2026-05-01T09:00:00.000Z", now)).toBe("inactive_30_days");
  });
});

describe("attendance schemas", () => {
  it("validates manual check-in fields", () => {
    expect(ManualCheckInSchema.safeParse({ memberId: "not-a-uuid" }).success).toBe(false);
    expect(ManualCheckInSchema.safeParse({ memberId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  });

  it("validates QR scan token length", () => {
    expect(QrCheckInSchema.safeParse({ tokenValue: "short" }).success).toBe(false);
    expect(QrCheckInSchema.safeParse({ tokenValue: "att_abcdefghijklmnopqrstuvwxyz" }).success).toBe(true);
  });
});

describe("attendance CSV reports", () => {
  it("exports attendance sessions", () => {
    const row = buildAttendanceSessionRow();

    expect(attendanceRowsToCsv({ type: "sessions", rows: [row] })).toContain("session-1");
    expect(attendanceRowsToCsv({ type: "sessions", rows: [row] })).toContain("checked_out");
  });

  it("exports Excel-compatible attendance workbooks", () => {
    const workbook = attendanceRowsToExcel({ type: "sessions", rows: [buildAttendanceSessionRow()] });

    expect(workbook).toContain("<table>");
    expect(workbook).toContain("Attendance Session Report");
    expect(workbook).toContain("session-1");
  });

  it("exports PDF attendance reports", async () => {
    const pdf = await attendanceRowsToPdf({ type: "sessions", rows: [buildAttendanceSessionRow()] });
    const header = new TextDecoder().decode(pdf.slice(0, 4));

    expect(header).toBe("%PDF");
  });
});

function buildAttendanceSessionRow(): AttendanceSessionRow {
	  return {
	    id: "session-1",
	    gym_id: "gym-1",
	    branch_id: null,
	    member_id: "member-1",
    membership_id: "membership-1",
    qr_token_id: null,
    check_in_at: "2026-06-10T07:00:00.000Z",
    check_out_at: "2026-06-10T08:00:00.000Z",
    duration_minutes: 60,
    status: "checked_out",
    check_in_source: "reception",
    check_out_source: "reception",
    entry_device_id: null,
    exit_device_id: null,
    created_by: null,
    checked_out_by: null,
    notes: null,
    created_at: "2026-06-10T07:00:00.000Z",
    updated_at: "2026-06-10T08:00:00.000Z"
  };
}
