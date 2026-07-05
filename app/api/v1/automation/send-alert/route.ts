import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getAttendanceAutomationConfigV1, resolveGymScopeIds, sendAttendanceAlertV1 } from "@/features/attendance/lib/phase1-api";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const gymId = typeof body.gymId === "string" ? body.gymId : typeof body.gym_id === "string" ? body.gym_id : null;
  const branchId = typeof body.branchId === "string" ? body.branchId : typeof body.branch_id === "string" ? body.branch_id : null;
  const memberId = typeof body.memberId === "string" ? body.memberId : typeof body.member_id === "string" ? body.member_id : null;
  const alertType = typeof body.alertType === "string" ? body.alertType : typeof body.alert_type === "string" ? body.alert_type : null;
  const message = typeof body.message === "string" ? body.message : null;
  const channels = Array.isArray(body.channels)
    ? body.channels.filter((channel): channel is "sms" | "whatsapp" => channel === "sms" || channel === "whatsapp")
    : Array.isArray(body.channel)
      ? body.channel.filter((channel): channel is "sms" | "whatsapp" => channel === "sms" || channel === "whatsapp")
      : [];

  if (!memberId) {
    return NextResponse.json({ ok: false, error: { code: "MEMBER_ID_REQUIRED", message: "memberId is required." } }, { status: 400 });
  }
  if (alertType !== "streak_alert" && alertType !== "churn_warning") {
    return NextResponse.json({ ok: false, error: { code: "ALERT_TYPE_REQUIRED", message: "alertType must be streak_alert or churn_warning." } }, { status: 400 });
  }

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "GYM_SCOPE_REQUIRED", message: "Provide a valid gymId for this organization." } }, { status: 400 });
  }

  const targetChannels = channels.length > 0 ? channels : ["sms", "whatsapp"];
  const result = await sendAttendanceAlertV1({
    organizationId: context.apiKey.organization_id,
    actor: {
      userId: `api:${context.apiKey.id}`,
      organizationId: context.apiKey.organization_id,
      profile: null,
      primaryRole: null,
      roles: [],
      gymId: gymIds.length === 1 ? gymIds[0] : gymId ?? gymIds[0],
      branchId,
    },
    gymIds,
    gymId,
    branchId,
    memberId,
    alertType,
    channels: targetChannels,
    message,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  const config = await getAttendanceAutomationConfigV1({
    organizationId: context.apiKey.organization_id,
    gymIds,
    gymId,
    branchId,
  });

  return NextResponse.json({ ok: true, data: { ...result, config } }, { status: 201 });
}, { requiredScope: "write:attendance", rateLimit: 60 });
