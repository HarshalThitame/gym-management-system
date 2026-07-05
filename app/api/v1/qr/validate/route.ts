import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { resolveGymScopeIds, validateAttendanceQrToken } from "@/features/attendance/lib/phase1-api";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const qrToken = typeof body.qrToken === "string" ? body.qrToken : typeof body.qr_token === "string" ? body.qr_token : null;
  const gymId = typeof body.gymId === "string" ? body.gymId : typeof body.gym_id === "string" ? body.gym_id : null;
  if (!qrToken) {
    return NextResponse.json({ valid: false, error: "qrToken is required" }, { status: 400 });
  }

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  const effectiveGymId = gymIds.length === 1 ? gymIds[0] : gymId;
  const result = await validateAttendanceQrToken(qrToken, effectiveGymId ?? null);

  return NextResponse.json({
    valid: result.valid,
    memberId: result.memberId,
    branchId: result.branchId,
    reason: result.reason,
  }, { status: result.valid ? 200 : result.reason === "wrong_gym" ? 403 : 401 });
}, { requiredScope: "read:attendance", rateLimit: 120 });
