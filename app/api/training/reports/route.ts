import { getApiTenantOrganizationId, requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { requireApiFeatureAccessAll, requireApiFeatureAccess } from "@/features/entitlement";
import { trainingRowsToCsv } from "@/features/training/lib/csv";
import { getTrainingReportRows } from "@/features/training/services/training-service";
import { getTrainerPerformanceReport } from "@/features/organization-owner/services/report-service";
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
  const typeParam = url.searchParams.get("type") ?? "sessions";

  // Dedicated trainer_performance report type (Phase 1.4)
  if (typeParam === "trainer_performance") {
    const featureDenied = await requireApiFeatureAccess(organizationId, "trainer_performance_report" as FeatureKey);
    if (featureDenied) return featureDenied;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const dateFrom = url.searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateTo = url.searchParams.get("dateTo") ?? new Date().toISOString().slice(0, 10);
    const result = await getTrainerPerformanceReport(organizationId, dateFrom, dateTo);

    const csv = rowsToCsv(
      ["Trainer", "Total Sessions", "PT Sessions", "Class Sessions", "Avg Rating", "Total Attendees"],
      result.trainers.map((t) => [t.trainerName, String(t.totalSessions), String(t.ptSessions), String(t.classSessions), String(t.avgRating), String(t.totalAttendees)])
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="trainer-performance-report.csv"`
      }
    });
  }

  // Original flow
  const featureDenied = await requireApiFeatureAccessAll(organizationId, ["trainer_management", "advanced_reports"]);
  if (featureDenied) return featureDenied;

  const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
  if (!gymScope.ok) {
    return gymScope.response;
  }

  const originalTypes = ["sessions", "assignments", "ratings", "staff"] as const;
  type OriginalType = (typeof originalTypes)[number];
  const type: OriginalType = originalTypes.includes(typeParam as OriginalType) ? typeParam as OriginalType : "sessions";
  const report = await getTrainingReportRows(gymScope.gymId, type);
  const csv = trainingRowsToCsv(report);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-${type}-report.csv"`
    }
  });
}
