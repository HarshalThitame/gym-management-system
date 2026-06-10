import { NextResponse } from "next/server";
import { classRowsToCsv } from "@/features/classes/lib/csv";
import { classReportFormats, classRowsToExcel, classRowsToPdf, type ClassReportFormat } from "@/features/classes/lib/report-export";
import { getClassReportRows } from "@/features/classes/services/class-service";
import { getAuthContext } from "@/lib/auth/session";
import { hasRequiredRole } from "@/lib/rbac";

const reportTypes = ["attendance", "bookings", "no_shows", "waitlists", "trainer_sessions"] as const;
type ReportType = (typeof reportTypes)[number];

export async function GET(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !hasRequiredRole(context.roles, ["super_admin", "gym_admin", "reception_staff"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "bookings";
  const type: ReportType = reportTypes.includes(typeParam as ReportType) ? (typeParam as ReportType) : "bookings";
  const formatParam = url.searchParams.get("format") ?? "csv";
  const format: ClassReportFormat = classReportFormats.includes(formatParam as ClassReportFormat) ? (formatParam as ClassReportFormat) : "csv";
  const report = await getClassReportRows(context.profile?.gym_id ?? null, type);

  if (format === "pdf") {
    const pdf = await classRowsToPdf(report);
    const pdfBuffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(pdfBuffer).set(pdf);
    return new Response(new Blob([pdfBuffer], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="classes-${type}-report.pdf"`
      }
    });
  }

  if (format === "excel") {
    return new Response(classRowsToExcel(report), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="classes-${type}-report.xls"`
      }
    });
  }

  return new Response(classRowsToCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="classes-${type}-report.csv"`
    }
  });
}
