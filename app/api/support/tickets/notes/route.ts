import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { addNote } from "@/features/support/services/support-ticket-service";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { ticketId: string; body: string; isInternal: boolean; mentions?: string[] };
    if (!body.ticketId || !body.body) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_FIELDS", message: "ticketId and body required." } }, { status: 400 });
    }

    const note = await addNote(body.ticketId, body.body, body.isInternal ?? true, body.mentions ?? [], auth.context.userId ?? "");
    return NextResponse.json({ ok: true, data: note }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "NOTE_ERROR", message: e instanceof Error ? e.message : "Failed to add note." } }, { status: 500 });
  }
}
