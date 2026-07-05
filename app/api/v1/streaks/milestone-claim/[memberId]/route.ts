import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { claimStreakMilestoneV1, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const POST = withApiAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const gymId = typeof body.gymId === "string" ? body.gymId : typeof body.gym_id === "string" ? body.gym_id : null;
  const milestoneNumber = typeof body.milestoneNumber === "number"
    ? body.milestoneNumber
    : typeof body.milestone_number === "number"
      ? body.milestone_number
      : Number.NaN;
  const claimType = typeof body.claimType === "string"
    ? body.claimType
    : typeof body.claim_type === "string"
      ? body.claim_type
      : "points";

  if (!Number.isInteger(milestoneNumber) || milestoneNumber <= 0) {
    return NextResponse.json(
      { success: false, message: "milestoneNumber must be a positive integer." },
      { status: 400 },
    );
  }

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  const path = new URL(request.url).pathname;
  const memberId = decodeURIComponent(path.split("/").slice(-2, -1)[0] ?? "");
  if (!memberId) {
    return NextResponse.json({ success: false, message: "memberId is required." }, { status: 400 });
  }

  const result = await claimStreakMilestoneV1({
    actor: {
      userId: `api:${context.apiKey.id}`,
      organizationId: context.apiKey.organization_id,
      profile: null,
      primaryRole: null,
      roles: [],
      gymId: gymId ?? gymIds[0],
      branchId: null,
    },
    memberId,
    milestoneNumber,
    claimType,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message, code: result.code }, { status: result.status });
  }

  return NextResponse.json({ success: true, rewardDetails: result.rewardDetails });
}, { requiredScope: "write:attendance", rateLimit: 50 });
