import type { AccessLogRow, AttendanceSessionRow } from "@/types/attendance";

export type AttendanceReportPayload =
  | { type: "sessions"; rows: AttendanceSessionRow[] }
  | { type: "exceptions"; rows: AccessLogRow[] };

export type AttendanceReportTable = {
  title: string;
  generatedAt: string;
  headers: string[];
  rows: string[][];
};

export function attendanceRowsToCsv(report: AttendanceReportPayload) {
  const table = getAttendanceReportTable(report);
  return toCsv(table.headers, table.rows);
}

export function getAttendanceReportTable(report: AttendanceReportPayload): AttendanceReportTable {
  const generatedAt = new Date().toISOString();

  if (report.type === "exceptions") {
    return {
      title: "Attendance Exception Report",
      generatedAt,
      headers: ["access_log_id", "member_id", "direction", "source", "decision", "reason_code", "message", "occurred_at"],
      rows: report.rows.map((row) => [
        row.id,
        row.member_id ?? "",
        row.direction,
        row.source,
        row.decision,
        row.reason_code,
        row.message,
        row.occurred_at
      ])
    };
  }

  return {
    title: "Attendance Session Report",
    generatedAt,
    headers: ["session_id", "member_id", "membership_id", "status", "check_in_at", "check_out_at", "duration_minutes", "check_in_source", "check_out_source"],
    rows: report.rows.map((row) => [
      row.id,
      row.member_id,
      row.membership_id ?? "",
      row.status,
      row.check_in_at,
      row.check_out_at ?? "",
      String(row.duration_minutes ?? ""),
      row.check_in_source,
      row.check_out_source ?? ""
    ])
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
