import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { issueDynamicAttendanceQr, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const gymId = new URL(request.url).searchParams.get("gymId") ?? new URL(request.url).searchParams.get("gym_id");
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length !== 1) {
    return NextResponse.json({ error: "Gym scope required", message: "Provide a single gymId for dynamic QR generation." }, { status: 400 });
  }

  const memberId = new URL(request.url).pathname.split("/").at(-1);
  if (!memberId) {
    return NextResponse.json({ error: "Missing memberId", message: "memberId is required." }, { status: 400 });
  }

  const result = await issueDynamicAttendanceQr(memberId, {
    userId: `api:${context.apiKey.id}`,
    organizationId: context.apiKey.organization_id,
    profile: null,
    primaryRole: null,
    roles: [],
    gymId: gymIds[0],
    branchId: null,
  });

  if (!result) {
    return NextResponse.json({ error: "Member not found", message: "Member not found in the selected gym." }, { status: 404 });
  }

  return NextResponse.json({
    qrCode: result.qrCode,
    qrToken: result.qrToken.token_value,
    expiresAt: result.expiresAt,
    refreshAfterSeconds: result.refreshAfterSeconds,
  }, { status: 201 });
}, { requiredScope: "write:attendance", rateLimit: 60 });
