import { NextResponse, type NextRequest } from "next/server";
import { getApiTenantOrganizationId, requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { requireApiFeatureAccessAll, requireApiFeatureAccess, type FeatureKey } from "@/features/entitlement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyticsRowsToCsv, analyticsRowsToExcel, analyticsRowsToPdf } from "@/features/analytics/lib/report-export";
import { analyticsReportKeys, reportFormats, type AnalyticsReportFormat, type AnalyticsReportKey } from "@/types/analytics";
import { getAnalyticsReportPayload } from "@/features/analytics/services/analytics-service";
import {
  getTrainerPerformanceReport,
  getClassOccupancyReport,
  getLeadConversionReport,
  getBranchRevenueComparison,
} from "@/features/organization-owner/services/report-service";
import type { Json } from "@/types/database";

const reportTypes = ["trainer_performance", "class_occupancy", "lead_conversion", "branch_revenue"] as const;
type ReportType = (typeof reportTypes)[number];

const REPORT_FEATURE_MAP: Record<ReportType, FeatureKey> = {
  trainer_performance: "trainer_performance_report",
  class_occupancy: "class_occupancy_report",
  lead_conversion: "lead_conversion_report",
  branch_revenue: "branch_revenue_comparison",
};

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("reports", "export");

  if (!auth.ok) {
    return auth.response;
  }
  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) return NextResponse.json({ error: "Organization scope required." }, { status: 403 });

  const typeParam = request.nextUrl.searchParams.get("type") ?? "";
  const isDedicatedReport = reportTypes.includes(typeParam as ReportType);

  // Dedicated report types (Phase 1.4) — gated individually
  if (isDedicatedReport) {
    const reportType = typeParam as ReportType;
    const featureDenied = await requireApiFeatureAccess(organizationId, REPORT_FEATURE_MAP[reportType]);
    if (featureDenied) return featureDenied;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateTo = request.nextUrl.searchParams.get("dateTo") ?? new Date().toISOString().slice(0, 10);

    let data: unknown;
    if (reportType === "trainer_performance") {
      data = await getTrainerPerformanceReport(organizationId, dateFrom, dateTo);
    } else if (reportType === "class_occupancy") {
      data = await getClassOccupancyReport(organizationId, dateFrom, dateTo);
    } else if (reportType === "lead_conversion") {
      data = await getLeadConversionReport(organizationId, dateFrom, dateTo);
    } else if (reportType === "branch_revenue") {
      data = await getBranchRevenueComparison(organizationId, dateFrom, dateTo);
    }

    return NextResponse.json(data);
  }

  // Original analytics export flow (key/format-based)
  const featureDenied = await requireApiFeatureAccessAll(organizationId, ["advanced_reports", "data_export_csv_download"]);
  if (featureDenied) return featureDenied;

  const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
  if (!gymScope.ok) {
    return gymScope.response;
  }

  const keyParam = request.nextUrl.searchParams.get("key") ?? "executive_kpi_snapshot";
  const formatParam = request.nextUrl.searchParams.get("format") ?? "csv";
  const reportKey: AnalyticsReportKey = analyticsReportKeys.includes(keyParam as AnalyticsReportKey) ? keyParam as AnalyticsReportKey : "executive_kpi_snapshot";
  const format: AnalyticsReportFormat = reportFormats.includes(formatParam as AnalyticsReportFormat) ? formatParam as AnalyticsReportFormat : "csv";
  const report = await getAnalyticsReportPayload({
    gymId: gymScope.gymId,
    reportKey
  });

  const supabase = await createSupabaseServerClient();
  const { data: exportRow } = await supabase.from("report_exports").insert({
    gym_id: gymScope.gymId,
    report_key: report.key,
    category: report.category,
    format,
    status: "completed",
    row_count: report.rows.length,
    filters: Object.fromEntries(request.nextUrl.searchParams.entries()) as Json,
    requested_by: auth.context.userId,
    completed_at: new Date().toISOString()
  }).select("id").maybeSingle();

  const savedReportUpdate = supabase.from("saved_reports").update({ last_run_at: new Date().toISOString() }).eq("report_key", report.key);
  await (gymScope.gymId ? savedReportUpdate.eq("gym_id", gymScope.gymId) : savedReportUpdate.is("gym_id", null));

  const filename = `${report.key}-${exportRow?.id ?? Date.now()}`;
  if (format === "excel") {
    return new NextResponse(analyticsRowsToExcel(report), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.xls"`
      }
    });
  }

  if (format === "pdf") {
    const pdf = await analyticsRowsToPdf(report);
    const pdfBody = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(pdfBody).set(pdf);
    return new NextResponse(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`
      }
    });
  }

  return new NextResponse(analyticsRowsToCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`
    }
  });
}
