import type { ClassAttendanceRow, ClassBookingRow, ClassWaitlistRow } from "@/types/classes";
import type { Database } from "@/types/database";

type ClassTrainerSummaryRow = Database["public"]["Views"]["class_trainer_summary"]["Row"];

export type ClassReportPayload =
  | { type: "attendance"; rows: ClassAttendanceRow[] }
  | { type: "bookings"; rows: ClassBookingRow[] }
  | { type: "no_shows"; rows: ClassBookingRow[] }
  | { type: "waitlists"; rows: ClassWaitlistRow[] }
  | { type: "trainer_sessions"; rows: ClassTrainerSummaryRow[] };

export type ClassReportTable = {
  title: string;
  generatedAt: string;
  headers: string[];
  rows: string[][];
};

export function classRowsToCsv(report: ClassReportPayload) {
  const table = getClassReportTable(report);
  return toCsv(table.headers, table.rows);
}

export function getClassReportTable(report: ClassReportPayload): ClassReportTable {
  const generatedAt = new Date().toISOString();

  if (report.type === "attendance") {
    return {
      title: "Class Attendance Report",
      generatedAt,
      headers: ["attendance_id", "session_id", "class_id", "member_id", "status", "method", "marked_at"],
      rows: report.rows.map((row) => [row.id, row.session_id, row.class_id, row.member_id, row.status, row.method, row.marked_at])
    };
  }

  if (report.type === "waitlists") {
    return {
      title: "Class Waitlist Report",
      generatedAt,
      headers: ["waitlist_id", "session_id", "class_id", "member_id", "position", "status", "joined_at", "promoted_at"],
      rows: report.rows.map((row) => [row.id, row.session_id, row.class_id, row.member_id, String(row.position), row.status, row.joined_at, row.promoted_at ?? ""])
    };
  }

  if (report.type === "trainer_sessions") {
    return {
      title: "Class Trainer Sessions Report",
      generatedAt,
      headers: ["trainer_id", "session_count", "completed_sessions", "average_fill_rate", "attended_count"],
      rows: report.rows.map((row) => [
        row.trainer_id ?? "",
        String(row.session_count ?? 0),
        String(row.completed_sessions ?? 0),
        String(row.average_fill_rate ?? 0),
        String(row.attended_count ?? 0)
      ])
    };
  }

  const title = report.type === "no_shows" ? "Class No-Show Report" : "Class Booking Report";
  return {
    title,
    generatedAt,
    headers: ["booking_id", "session_id", "class_id", "member_id", "status", "source", "booked_at", "cancelled_at"],
    rows: report.rows.map((row) => [row.id, row.session_id, row.class_id, row.member_id, row.status, row.booking_source, row.booked_at, row.cancelled_at ?? ""])
  };
}

function toCsv(headers: string[], rows: string[][]) {
  return [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsv).join(","))
  ].join("\n");
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}
