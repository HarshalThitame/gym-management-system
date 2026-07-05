import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { getMemberInsightsV1, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const gymId = url.searchParams.get("gymId") ?? url.searchParams.get("gym_id");
  const branchId = url.searchParams.get("branchId") ?? url.searchParams.get("branch_id");
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "GYM_SCOPE_REQUIRED", message: "Provide a valid gymId for this organization." } }, { status: 400 });
  }

  const memberId = decodeURIComponent(request.nextUrl.pathname.split("/").at(-1) ?? "");
  if (!memberId) {
    return NextResponse.json({ ok: false, error: { code: "MEMBER_ID_REQUIRED", message: "memberId is required." } }, { status: 400 });
  }

  const data = await getMemberInsightsV1({ gymIds, gymId, branchId, memberId });
  if (!data) {
    return NextResponse.json({ ok: false, error: { code: "MEMBER_NOT_FOUND", message: "Member not found in this gym scope." } }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}, { requiredScope: "read:attendance", rateLimit: 100 });
