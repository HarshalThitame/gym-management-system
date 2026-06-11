import { classRowsToCsv } from "@/features/classes/lib/csv";
import { classReportFormats, classRowsToExcel, classRowsToPdf, type ClassReportFormat } from "@/features/classes/lib/report-export";
import { getClassReportRows } from "@/features/classes/services/class-service";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";

const reportTypes = ["attendance", "bookings", "no_shows", "waitlists", "trainer_sessions"] as const;
type ReportType = (typeof reportTypes)[number];

export async function GET(request: Request) {
  const auth = await requireApiPermission("reports", "export");

  if (!auth.ok) {
    return auth.response;
  }

  const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
  if (!gymScope.ok) {
    return gymScope.response;
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "bookings";
  const type: ReportType = reportTypes.includes(typeParam as ReportType) ? (typeParam as ReportType) : "bookings";
  const formatParam = url.searchParams.get("format") ?? "csv";
  const format: ClassReportFormat = classReportFormats.includes(formatParam as ClassReportFormat) ? (formatParam as ClassReportFormat) : "csv";
  const report = await getClassReportRows(gymScope.gymId, type);

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
