import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { trainingRowsToCsv } from "@/features/training/lib/csv";
import { getTrainingReportRows } from "@/features/training/services/training-service";

const reportTypes = ["sessions", "assignments", "ratings", "staff"] as const;
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
  const typeParam = url.searchParams.get("type") ?? "sessions";
  const type: ReportType = reportTypes.includes(typeParam as ReportType) ? typeParam as ReportType : "sessions";
  const report = await getTrainingReportRows(gymScope.gymId, type);
  const csv = trainingRowsToCsv(report);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-${type}-report.csv"`
    }
  });
}
