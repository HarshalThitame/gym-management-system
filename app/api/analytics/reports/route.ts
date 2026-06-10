import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { canAny } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyticsRowsToCsv, analyticsRowsToExcel, analyticsRowsToPdf } from "@/features/analytics/lib/report-export";
import { analyticsReportKeys, reportFormats, type AnalyticsReportFormat, type AnalyticsReportKey } from "@/types/analytics";
import { getAnalyticsReportPayload } from "@/features/analytics/services/analytics-service";
import type { Json } from "@/types/database";

export async function GET(request: NextRequest) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !canAny(context.roles, "reports", "export")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const keyParam = request.nextUrl.searchParams.get("key") ?? "executive_kpi_snapshot";
  const formatParam = request.nextUrl.searchParams.get("format") ?? "csv";
  const reportKey: AnalyticsReportKey = analyticsReportKeys.includes(keyParam as AnalyticsReportKey) ? keyParam as AnalyticsReportKey : "executive_kpi_snapshot";
  const format: AnalyticsReportFormat = reportFormats.includes(formatParam as AnalyticsReportFormat) ? formatParam as AnalyticsReportFormat : "csv";
  const report = await getAnalyticsReportPayload({
    gymId: context.profile?.gym_id ?? null,
    reportKey
  });

  const supabase = await createSupabaseServerClient();
  const { data: exportRow } = await supabase.from("report_exports").insert({
    gym_id: context.profile?.gym_id ?? null,
    report_key: report.key,
    category: report.category,
    format,
    status: "completed",
    row_count: report.rows.length,
    filters: Object.fromEntries(request.nextUrl.searchParams.entries()) as Json,
    requested_by: context.userId,
    completed_at: new Date().toISOString()
  }).select("id").maybeSingle();

  await supabase.from("saved_reports").update({ last_run_at: new Date().toISOString() }).eq("report_key", report.key);

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
