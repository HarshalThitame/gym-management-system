import { classRowsToCsv } from "@/features/classes/lib/csv";
import { classReportFormats, classRowsToExcel, classRowsToPdf, type ClassReportFormat } from "@/features/classes/lib/report-export";
import { getClassReportRows } from "@/features/classes/services/class-service";
import { getApiTenantOrganizationId, requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { requireApiFeatureAccessAll, requireApiFeatureAccess } from "@/features/entitlement";
import { getClassOccupancyReport } from "@/features/organization-owner/services/report-service";
import type { FeatureKey } from "@/features/entitlement";

function rowsToCsv(headers: string[], rows: string[][]) {
  const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  return [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
}

export async function GET(request: Request) {
  const auth = await requireApiPermission("reports", "export");

  if (!auth.ok) {
    return auth.response;
  }
  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) return Response.json({ error: "Organization scope required." }, { status: 403 });

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "bookings";

  // Dedicated class_occupancy report type (Phase 1.4)
  if (typeParam === "class_occupancy") {
    const featureDenied = await requireApiFeatureAccess(organizationId, "class_occupancy_report" as FeatureKey);
    if (featureDenied) return featureDenied;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const dateFrom = url.searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateTo = url.searchParams.get("dateTo") ?? new Date().toISOString().slice(0, 10);
    const data = await getClassOccupancyReport(organizationId, dateFrom, dateTo);

    const csv = rowsToCsv(
      ["Class Type", "Sessions", "Total Slots", "Total Booked", "Occupancy %", "Avg Attendees"],
      data.map((c) => [c.classType, String(c.sessionCount), String(c.totalSlots), String(c.totalBooked), `${c.occupancyPercent}%`, String(c.avgAttendees)])
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="class-occupancy-report.csv"`
      }
    });
  }

  // Original flow
  const featureDenied = await requireApiFeatureAccessAll(organizationId, ["class_booking", "advanced_reports"]);
  if (featureDenied) return featureDenied;

  const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
  if (!gymScope.ok) {
    return gymScope.response;
  }

  const originalTypes = ["attendance", "bookings", "no_shows", "waitlists", "trainer_sessions"] as const;
  type OriginalType = (typeof originalTypes)[number];
  const type: OriginalType = originalTypes.includes(typeParam as OriginalType) ? (typeParam as OriginalType) : "bookings";
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
