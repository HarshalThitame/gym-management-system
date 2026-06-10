import { NextResponse } from "next/server";
import { attendanceRowsToCsv } from "@/features/attendance/lib/csv";
import { attendanceReportFormats, attendanceRowsToExcel, attendanceRowsToPdf, type AttendanceReportFormat } from "@/features/attendance/lib/report-export";
import { getAttendanceReportRows } from "@/features/attendance/services/attendance-service";
import { getAuthContext } from "@/lib/auth/session";
import { canAny } from "@/lib/rbac";

const reportTypes = ["daily", "weekly", "monthly", "custom", "exceptions"] as const;
type ReportType = (typeof reportTypes)[number];

export async function GET(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !canAny(context.roles, "reports", "export")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "daily";
  const type: ReportType = reportTypes.includes(typeParam as ReportType) ? (typeParam as ReportType) : "daily";
  const formatParam = url.searchParams.get("format") ?? "csv";
  const format: AttendanceReportFormat = attendanceReportFormats.includes(formatParam as AttendanceReportFormat) ? (formatParam as AttendanceReportFormat) : "csv";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const rows = await getAttendanceReportRows({
    gymId: context.profile?.gym_id ?? null,
    type,
    from,
    to
  });

  if (format === "pdf") {
    const pdf = await attendanceRowsToPdf(rows);
    const pdfBuffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(pdfBuffer).set(pdf);
    const body = new Blob([pdfBuffer], { type: "application/pdf" });
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="attendance-${type}-report.pdf"`
      }
    });
  }

  if (format === "excel") {
    const workbook = attendanceRowsToExcel(rows);
    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${type}-report.xls"`
      }
    });
  }

  return new Response(attendanceRowsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${type}-report.csv"`
    }
  });
}
