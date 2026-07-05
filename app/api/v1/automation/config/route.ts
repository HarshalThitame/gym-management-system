import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getAttendanceAutomationConfigV1, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const gymId = url.searchParams.get("gymId") ?? url.searchParams.get("gym_id");
  const branchId = url.searchParams.get("branchId") ?? url.searchParams.get("branch_id");
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);

  const data = await getAttendanceAutomationConfigV1({
    organizationId: context.apiKey.organization_id,
    gymIds,
    gymId,
    branchId,
  });

  return NextResponse.json({ ok: true, data });
}, { requiredScope: "read:attendance", rateLimit: 60 });
