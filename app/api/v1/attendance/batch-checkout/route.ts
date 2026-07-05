import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { batchCheckOutMembersV1, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const gymId = typeof body.gymId === "string" ? body.gymId : typeof body.gym_id === "string" ? body.gym_id : null;
  const branchId = typeof body.branchId === "string" ? body.branchId : typeof body.branch_id === "string" ? body.branch_id : null;
  const sessionType = typeof body.sessionType === "string" ? body.sessionType : typeof body.session_type === "string" ? body.session_type : null;
  const sessionName = typeof body.sessionName === "string" ? body.sessionName : typeof body.session_name === "string" ? body.session_name : null;
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : typeof body.device_id === "string" ? body.device_id : null;
  const notes = typeof body.notes === "string" ? body.notes : null;
  const checkoutMethod = typeof body.checkoutMethod === "string" ? body.checkoutMethod : typeof body.checkout_method === "string" ? body.checkout_method : null;
  const allInside = Boolean(body.allInside ?? body.all_inside);
  const memberIds = Array.isArray(body.memberIds)
    ? body.memberIds.filter((memberId): memberId is string => typeof memberId === "string")
    : Array.isArray(body.member_ids)
      ? body.member_ids.filter((memberId): memberId is string => typeof memberId === "string")
      : [];

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length !== 1) {
    return NextResponse.json({ ok: false, error: { code: "GYM_SCOPE_REQUIRED", message: "Provide a single gymId for batch checkout." } }, { status: 400 });
  }

  const result = await batchCheckOutMembersV1({
    actor: {
      userId: `api:${context.apiKey.id}`,
      organizationId: context.apiKey.organization_id,
      profile: null,
      primaryRole: null,
      roles: [],
      gymId: gymIds[0],
      branchId,
    },
    memberIds,
    allInside,
    deviceId,
    branchId,
    sessionType,
    sessionName,
    notes,
    checkoutMethod,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result }, { status: 200 });
}, { requiredScope: "write:attendance", rateLimit: 60 });
