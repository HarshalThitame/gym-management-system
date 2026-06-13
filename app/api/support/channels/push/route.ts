import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { addMessage } from "@/features/support/services/support-ticket-service";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const msgPayload: Record<string, unknown> = {
      channel: "push",
      direction: "outbound",
      senderName: "Support System",
      body: (body.message as string) ?? "",
    };
    if (body.subject) msgPayload.subject = body.subject;
    await addMessage(body.ticketId as string, msgPayload as never);
    return NextResponse.json({ ok: true, message: "Push notification sent." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "SEND_ERROR", message: e instanceof Error ? e.message : "Failed to send push." } }, { status: 500 });
  }
}
