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
    const msgInput: Record<string, unknown> = {
      channel: body.channel as string,
      direction: body.direction as string,
      senderName: body.senderName as string,
      body: body.body as string,
    };
    if (body.senderEmail) msgInput.senderEmail = body.senderEmail;
    if (body.subject) msgInput.subject = body.subject;
    if (body.bodyHtml) msgInput.bodyHtml = body.bodyHtml;
    if (body.externalId) msgInput.externalId = body.externalId;
    const message = await addMessage(body.ticketId as string, msgInput as never);
    return NextResponse.json({ ok: true, data: message }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "SEND_ERROR", message: e instanceof Error ? e.message : "Failed to send message." } }, { status: 500 });
  }
}
