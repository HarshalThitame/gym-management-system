import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { resolveGymScopeIds, searchMembersV1 } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();
  const branchId = url.searchParams.get("branchId") ?? url.searchParams.get("branch_id");
  const gymId = url.searchParams.get("gymId") ?? url.searchParams.get("gym_id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10") || 10, 1), 50);

  if (query.length < 2) {
    return NextResponse.json({ members: [] });
  }

  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ error: "Gym scope not found", message: "Provide a valid gymId for this organization." }, { status: 400 });
  }

  const members = await searchMembersV1({
    organizationId: context.apiKey.organization_id,
    query,
    gymIds,
    gymId,
    branchId,
    limit,
  });

  return NextResponse.json({ members });
}, { requiredScope: "read:members", rateLimit: 120 });
