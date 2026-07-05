import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { checkOutMember, normalizeV1CheckOutResponse, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : typeof body.session_id === "string" ? body.session_id : null;
  const memberId = typeof body.memberId === "string" ? body.memberId : typeof body.member_id === "string" ? body.member_id : null;
  const checkoutMethod = typeof body.checkoutMethod === "string" ? body.checkoutMethod : typeof body.checkout_method === "string" ? body.checkout_method : null;
  const requestedGymId = typeof body.gymId === "string" ? body.gymId : typeof body.gym_id === "string" ? body.gym_id : null;

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, requestedGymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  const result = await checkOutMember({
    actor: {
      userId: `api:${context.apiKey.id}`,
      organizationId: context.apiKey.organization_id,
      profile: null,
      primaryRole: null,
      roles: [],
      gymId: gymIds[0],
      branchId: null,
    },
    sessionId,
    memberId,
    checkoutMethod,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json(normalizeV1CheckOutResponse(result));
}, { requiredScope: "write:attendance", rateLimit: 60 });
