import { NextResponse } from "next/server";
import { fitnessRowsToCsv, type FitnessReportType } from "@/features/fitness/lib/csv";
import { fitnessReportFormats, fitnessRowsToExcel, fitnessRowsToPdf, type FitnessReportFormat } from "@/features/fitness/lib/report-export";
import { getFitnessReportRows } from "@/features/fitness/services/fitness-service";
import { getAuthContext } from "@/lib/auth/session";
import { canAny } from "@/lib/rbac";

const reportTypes = ["goal_progress", "workout_adherence", "measurement_changes", "nutrition_compliance"] as const;

export async function GET(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !canAny(context.roles, "reports", "export")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "goal_progress";
  const type: FitnessReportType = reportTypes.includes(typeParam as FitnessReportType) ? (typeParam as FitnessReportType) : "goal_progress";
  const formatParam = url.searchParams.get("format") ?? "csv";
  const format: FitnessReportFormat = fitnessReportFormats.includes(formatParam as FitnessReportFormat) ? (formatParam as FitnessReportFormat) : "csv";
  const report = await getFitnessReportRows(context.profile?.gym_id ?? null, type);

  if (format === "pdf") {
    const pdf = await fitnessRowsToPdf(report);
    const pdfBuffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(pdfBuffer).set(pdf);
    return new Response(new Blob([pdfBuffer], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fitness-${type}-report.pdf"`
      }
    });
  }

  if (format === "excel") {
    return new Response(fitnessRowsToExcel(report), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="fitness-${type}-report.xls"`
      }
    });
  }

  return new Response(fitnessRowsToCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fitness-${type}-report.csv"`
    }
  });
}
