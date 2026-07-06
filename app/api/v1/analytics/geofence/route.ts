import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getGeofenceMonitoringAnalyticsV1 } from "@/features/attendance/lib/geofence-monitoring";
import { resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const gymId = url.searchParams.get("gymId") ?? url.searchParams.get("gym_id");
  const branchId = url.searchParams.get("branchId") ?? url.searchParams.get("branch_id");
  const hours = Number(url.searchParams.get("hours") ?? "24") || 24;
  const staleMinutes = Number(url.searchParams.get("staleMinutes") ?? "30") || 30;

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "GYM_SCOPE_REQUIRED", message: "Provide a valid gymId for this organization." } }, { status: 400 });
  }

  const data = await getGeofenceMonitoringAnalyticsV1({
    gymIds,
    gymId,
    branchId,
    hours,
    staleMinutes
  });

  return NextResponse.json({ ok: true, data });
}, { requiredScope: "read:attendance", rateLimit: 60 });
