import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { unregisterViewer, getActiveViewers, heartbeatViewer } from "@/features/support/services/support-collaboration-service";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { ticketId: string; action: string };
    if (!body.ticketId || !body.action) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "ticketId and action required." } }, { status: 400 });
    }

    if (body.action === "heartbeat") {
      const userName = auth.context.profile?.full_name ?? auth.context.email ?? "Unknown";
      heartbeatViewer(body.ticketId, auth.context.userId ?? "", userName);
      const viewers = getActiveViewers(body.ticketId);
      return NextResponse.json({ ok: true, data: { viewers } });
    }

    if (body.action === "leave") {
      unregisterViewer(body.ticketId, auth.context.userId ?? "");
      return NextResponse.json({ ok: true, message: "Left ticket." });
    }

    return NextResponse.json({ ok: false, error: { code: "INVALID_ACTION", message: "Invalid action." } }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}

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

  const viewers = getActiveViewers(ticketId);
  return NextResponse.json({ ok: true, data: { viewers } });
}
