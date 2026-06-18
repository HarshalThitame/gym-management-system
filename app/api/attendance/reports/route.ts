import { attendanceRowsToCsv } from "@/features/attendance/lib/csv";
import { attendanceReportFormats, attendanceRowsToExcel, attendanceRowsToPdf, type AttendanceReportFormat } from "@/features/attendance/lib/report-export";
import { getAttendanceReportRows } from "@/features/attendance/services/attendance-service";
import { getApiTenantOrganizationId, requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { requireApiFeatureAccess } from "@/features/entitlement";

const reportTypes = ["daily", "weekly", "monthly", "custom", "exceptions"] as const;
type ReportType = (typeof reportTypes)[number];

export async function GET(request: Request) {
  const auth = await requireApiPermission("reports", "export");

  if (!auth.ok) {
    return auth.response;
  }
  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) return Response.json({ error: "Organization scope required." }, { status: 403 });
  const featureDenied = await requireApiFeatureAccess(organizationId, "attendance_reports");
  if (featureDenied) return featureDenied;

  const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
  if (!gymScope.ok) {
    return gymScope.response;
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "daily";
  const type: ReportType = reportTypes.includes(typeParam as ReportType) ? (typeParam as ReportType) : "daily";
  const formatParam = url.searchParams.get("format") ?? "csv";
  const format: AttendanceReportFormat = attendanceReportFormats.includes(formatParam as AttendanceReportFormat) ? (formatParam as AttendanceReportFormat) : "csv";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const rows = await getAttendanceReportRows({
    gymId: gymScope.gymId,
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
