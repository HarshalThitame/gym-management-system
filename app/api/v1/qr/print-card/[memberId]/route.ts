import { NextRequest } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { buildAttendanceQrCardPdf, resolveGymScopeIds } from "@/features/attendance/lib/phase1-api";

export const GET = withApiAuth(async (request: NextRequest, context) => {
  const gymId = new URL(request.url).searchParams.get("gymId") ?? new URL(request.url).searchParams.get("gym_id");
  const gymIds = await resolveGymScopeIds(context.apiKey.organization_id, gymId);
  if (gymIds.length !== 1) {
    return Response.json({ error: "Gym scope required", message: "Provide a single gymId for printable QR cards." }, { status: 400 });
  }

  const memberId = request.nextUrl.pathname.split("/").at(-1);
  if (!memberId) {
    return Response.json({ error: "Missing memberId", message: "memberId is required." }, { status: 400 });
  }

  const pdf = await buildAttendanceQrCardPdf(memberId, {
    userId: `api:${context.apiKey.id}`,
    organizationId: context.apiKey.organization_id,
    profile: null,
    primaryRole: null,
    roles: [],
    gymId: gymIds[0],
    branchId: null,
  });

  if (!pdf) {
    return Response.json({ error: "Member not found", message: "Member not found in the selected gym." }, { status: 404 });
  }

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attendance-qr-card-${memberId}.pdf"`,
    },
  });
}, { requiredScope: "read:attendance", rateLimit: 60 });
