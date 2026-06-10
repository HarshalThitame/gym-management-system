import type { StaffProfileRow, TrainerAssignmentRow, TrainerFeedbackRow, TrainerSessionRow } from "@/types/training";

type TrainingReportPayload =
  | { type: "sessions"; rows: TrainerSessionRow[] }
  | { type: "assignments"; rows: TrainerAssignmentRow[] }
  | { type: "ratings"; rows: TrainerFeedbackRow[] }
  | { type: "staff"; rows: StaffProfileRow[] };

export function trainingRowsToCsv(report: TrainingReportPayload) {
  if (report.type === "sessions") {
    return toCsv(
      ["session_id", "trainer_id", "member_id", "date", "starts_at", "ends_at", "status", "workout_type", "duration_minutes"],
      report.rows.map((row) => [row.id, row.trainer_id, row.member_id, row.session_date, row.starts_at, row.ends_at, row.status, row.workout_type, String(row.duration_minutes)])
    );
  }

  if (report.type === "assignments") {
    return toCsv(
      ["assignment_id", "trainer_id", "member_id", "assignment_type", "status", "assigned_at", "ended_at"],
      report.rows.map((row) => [row.id, row.trainer_id, row.member_id, row.assignment_type, row.status, row.assigned_at, row.ended_at ?? ""])
    );
  }

  if (report.type === "ratings") {
    return toCsv(
      ["feedback_id", "trainer_id", "member_id", "session_id", "rating", "status", "created_at"],
      report.rows.map((row) => [row.id, row.trainer_id, row.member_id, row.session_id ?? "", String(row.rating), row.status, row.created_at])
    );
  }

  return toCsv(
    ["staff_id", "employee_code", "full_name", "role", "status", "employment_type", "joined_at"],
    report.rows.map((row) => [row.id, row.employee_code, row.full_name, row.staff_role, row.status, row.employment_type, row.joined_at])
  );
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
