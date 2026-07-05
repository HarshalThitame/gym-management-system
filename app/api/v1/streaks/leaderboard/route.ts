import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getStreakLeaderboardV1, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId") ?? url.searchParams.get("branch_id");
  const gymId = url.searchParams.get("gymId") ?? url.searchParams.get("gym_id");
  const timeframe = url.searchParams.get("timeframe");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10") || 10, 1), 50);
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  const leaderboard = await getStreakLeaderboardV1({
    gymIds,
    gymId,
    branchId,
    limit,
    timeframe,
  });

  return NextResponse.json(leaderboard);
}, { requiredScope: "read:members", rateLimit: 100 });
