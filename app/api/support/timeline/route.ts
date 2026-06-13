import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getUnifiedTimeline } from "@/features/support/services/support-collaboration-service";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId");
  if (!ticketId) {
    return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "ticketId required." } }, { status: 400 });
  }

  try {
    const timeline = await getUnifiedTimeline(ticketId);
    return NextResponse.json({ ok: true, data: { entries: timeline } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}
