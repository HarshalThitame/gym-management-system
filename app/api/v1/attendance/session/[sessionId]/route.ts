import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getAttendanceSessionDetail, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gymId") ?? searchParams.get("gym_id");
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  const sessionId = request.nextUrl.pathname.split("/").at(-1);
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId", message: "sessionId is required" }, { status: 400 });
  }

  const detail = await getAttendanceSessionDetail(gymIds, gymId, sessionId);
  if (!detail) {
    return NextResponse.json({ error: "Session not found", message: "No attendance session exists for the given id." }, { status: 404 });
  }

  return NextResponse.json(detail);
}, { requiredScope: "read:attendance", rateLimit: 100 });
