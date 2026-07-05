import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getMemberStreakV1, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const gymId = url.searchParams.get("gymId") ?? url.searchParams.get("gym_id");
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  const path = new URL(request.url).pathname;
  const memberId = decodeURIComponent(path.split("/").slice(-2, -1)[0] ?? "");
  if (!memberId) {
    return NextResponse.json({ error: "Missing memberId", message: "memberId is required" }, { status: 400 });
  }

  const data = await getMemberStreakV1(memberId, gymIds, gymId);
  if (!data) {
    return NextResponse.json({ error: "Not found", message: "Member not found for the requested gym scope." }, { status: 404 });
  }

  return NextResponse.json({
    currentStreak: data.currentStreak,
    maxStreak: data.maxStreak,
    lastCheckinDate: data.lastCheckinDate,
    daysUntilMilestone: data.daysUntilMilestone,
    nextMilestone: data.nextMilestone,
    totalCheckins: data.totalCheckins,
    milestonesReached: data.milestonesReached,
    milestonesClaimed: data.milestonesClaimed,
    streakStartDate: data.streakStartDate,
    isBroken: data.isBroken,
    member: {
      id: data.memberId,
      name: data.memberName,
      branchId: data.branchId,
      gymId: data.gymId,
    },
  });
}, { requiredScope: "read:members", rateLimit: 100 });
