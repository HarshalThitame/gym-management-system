import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { canAny } from "@/lib/rbac";
import { trainingRowsToCsv } from "@/features/training/lib/csv";
import { getTrainingReportRows } from "@/features/training/services/training-service";

const reportTypes = ["sessions", "assignments", "ratings", "staff"] as const;
type ReportType = (typeof reportTypes)[number];

export async function GET(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !canAny(context.roles, "reports", "export")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "sessions";
  const type: ReportType = reportTypes.includes(typeParam as ReportType) ? typeParam as ReportType : "sessions";
  const report = await getTrainingReportRows(context.profile?.gym_id ?? null, type);
  const csv = trainingRowsToCsv(report);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-${type}-report.csv"`
    }
  });
}
