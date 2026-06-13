import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";
import { addMessage } from "@/features/support/services/support-ticket-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.SUPPORT_EMAIL_WEBHOOK_KEY) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key." } }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const sdb = db(supabase as unknown);
    const emailSubject = (body.subject as string) ?? "";
    const fromEmail = (body.from as string) ?? "";
    const fromName = (body.fromName as string) ?? fromEmail;

    const ticketNumberMatch = emailSubject.match(/TKT-\d{4}-\d{6}/);
    if (!ticketNumberMatch) {
      return NextResponse.json({ ok: false, error: { code: "NO_TICKET_REF", message: "No ticket reference found in subject." } }, { status: 400 });
    }

    const { data: ticket } = await sdb
      .from("support_tickets")
      .select("id, status")
      .eq("ticket_number", ticketNumberMatch[0])
      .single();

    if (!ticket) {
      return NextResponse.json({ ok: false, error: { code: "TICKET_NOT_FOUND", message: "Ticket not found." } }, { status: 404 });
    }

    const ticketRow = ticket as { id: string; status: string };
    if (ticketRow.status === "closed") {
      await sdb.from("support_tickets").update({ status: "reopened", reopened_at: new Date().toISOString() }).eq("id", ticketRow.id);
    }

    const msgPayload: Record<string, unknown> = {
      channel: "email",
      direction: "inbound",
      senderName: fromName,
      body: (body.text as string) ?? (body.html as string) ?? "",
    };
    if (body.from) msgPayload.senderEmail = body.from;
    if (emailSubject) msgPayload.subject = emailSubject;
    if (body.html) msgPayload.bodyHtml = body.html;
    if (body.messageId) msgPayload.externalId = body.messageId;
    await addMessage(ticketRow.id, msgPayload as never);

    return NextResponse.json({ ok: true, message: "Email processed." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "WEBHOOK_ERROR", message: e instanceof Error ? e.message : "Failed to process email." } }, { status: 500 });
  }
}
