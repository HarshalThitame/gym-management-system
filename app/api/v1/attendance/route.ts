import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { listAttendanceSessionsV1, normalizeV1CheckInResponse, resolveGymScopeIds, checkInMember } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 100);
  const memberId = searchParams.get("member_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const status = searchParams.get("status");
  const branchId = searchParams.get("branch_id");
  const gymId = searchParams.get("gym_id");

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json(
      { error: "Gym scope not found", message: "Provide a valid gym_id for this organization." },
      { status: 400 },
    );
  }

  const result = await listAttendanceSessionsV1({
    gymIds,
    gymId,
    page,
    limit,
    memberId,
    branchId,
    status,
    dateFrom,
    dateTo,
  });

  return NextResponse.json(result);
}, { requiredScope: "read:attendance", rateLimit: 100 });

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const memberId = typeof body.member_id === "string" ? body.member_id : typeof body.memberId === "string" ? body.memberId : null;
  const gymId = typeof body.gym_id === "string" ? body.gym_id : typeof body.gymId === "string" ? body.gymId : null;
  const branchId = typeof body.branch_id === "string" ? body.branch_id : typeof body.branchId === "string" ? body.branchId : null;
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!memberId) {
    return NextResponse.json(
      { error: "Missing required field", message: "member_id is required" },
      { status: 400 },
    );
  }

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json(
      { error: "Gym scope not found", message: "Provide a valid gym_id for this organization." },
      { status: 400 },
    );
  }

  const result = await checkInMember({
    actor: {
      userId: `api:${context.apiKey.id}`,
      organizationId: context.apiKey.organization_id,
      profile: null,
      primaryRole: null,
      roles: [],
      gymId: gymIds[0],
      branchId,
    },
    memberId,
    source: "reception",
    branchId,
    notes,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ data: normalizeV1CheckInResponse(result) }, { status: 201 });
}, { requiredScope: "write:attendance", rateLimit: 60 });
