import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import {
  checkInMember,
  normalizeV1CheckInResponse,
  resolveGymScopeIds,
  validateAttendanceQrToken,
} from "@/features/attendance/lib/phase1-api";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const memberId = typeof body.memberId === "string" ? body.memberId : typeof body.member_id === "string" ? body.member_id : null;
  const qrToken = typeof body.qrToken === "string" ? body.qrToken : typeof body.qr_token === "string" ? body.qr_token : null;
  const branchId = typeof body.branchId === "string" ? body.branchId : typeof body.branch_id === "string" ? body.branch_id : null;
  const requestedGymId = typeof body.gymId === "string" ? body.gymId : typeof body.gym_id === "string" ? body.gym_id : null;
  const checkinMethod = typeof body.checkinMethod === "string" ? body.checkinMethod : typeof body.checkin_method === "string" ? body.checkin_method : null;
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : typeof body.device_id === "string" ? body.device_id : null;
  const notes = typeof body.notes === "string" ? body.notes : null;

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, requestedGymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  let effectiveMemberId = memberId;
  let qrTokenId: string | null = null;
  let source: "reception" | "qr" = checkinMethod === "qr" || qrToken ? "qr" : "reception";
  let effectiveGymId = requestedGymId ?? gymIds[0];

  if (qrToken) {
    const validated = await validateAttendanceQrToken(qrToken, requestedGymId ?? null);
    if (!validated.valid || !validated.memberId) {
      const message = validated.reason === "expired"
        ? "QR token has expired."
        : validated.reason === "used"
          ? "QR token was already used."
          : validated.reason === "wrong_gym"
            ? "This QR belongs to another organization gym scope."
            : "QR token is invalid.";
      return NextResponse.json(
        { success: false, message },
        { status: validated.reason === "wrong_gym" ? 403 : 401 },
      );
    }
    if (validated.qrToken && !gymIds.includes(validated.qrToken.gym_id ?? "")) {
      return NextResponse.json(
        { success: false, message: "This QR belongs to another organization gym scope." },
        { status: 403 },
      );
    }
    effectiveMemberId = validated.memberId;
    qrTokenId = validated.qrToken.id;
    effectiveGymId = validated.qrToken.gym_id ?? effectiveGymId;
    source = "qr";
  }

  if (!effectiveMemberId) {
    return NextResponse.json({ error: "Missing required field", message: "memberId or qrToken is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: branch } = branchId
    ? await supabase.from("branches").select("gym_id").eq("id", branchId).maybeSingle()
    : { data: null };
  const gymId = branch?.gym_id ?? effectiveGymId;

  const result = await checkInMember({
    actor: {
      userId: `api:${context.apiKey.id}`,
      organizationId: context.apiKey.organization_id,
      profile: null,
      primaryRole: null,
      roles: [],
      gymId,
      branchId: branchId ?? null,
    },
    memberId: effectiveMemberId,
    source,
    deviceId,
    qrTokenId,
    branchId,
    notes,
  });

  if (!result.ok) {
    const status = result.status === 403 ? 403 : result.status === 409 ? 409 : result.status;
    return NextResponse.json({ success: false, message: result.message }, { status });
  }

  return NextResponse.json(normalizeV1CheckInResponse(result), { status: 201 });
}, { requiredScope: "write:attendance", rateLimit: 60 });
