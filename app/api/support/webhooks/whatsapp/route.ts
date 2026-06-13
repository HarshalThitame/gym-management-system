import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";
import { addMessage } from "@/features/support/services/support-ticket-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.SUPPORT_WHATSAPP_WEBHOOK_KEY) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key." } }, { status: 401 });
    }

    const fromNumber = (body.from as string) ?? "";
    const messageBody = (body.text as string) ?? (body.body as string) ?? "";
    const mediaUrl = body.mediaUrl as string | undefined;

    const supabase = await createSupabaseServerClient();
    const sdb = db(supabase as unknown);
    const { data: tickets } = await sdb
      .from("support_tickets")
      .select("id, status")
      .eq("customer_phone", fromNumber)
      .in("status", ["open", "in_review", "in_progress", "waiting_on_customer", "reopened"])
      .order("created_at", { ascending: false })
      .limit(1);

    const ticketList = tickets as Array<{ id: string; status: string }> | null;
    const ticket = ticketList?.[0];
    if (!ticket) {
      return NextResponse.json({ ok: false, error: { code: "NO_OPEN_TICKET", message: "No open ticket found for this number." } }, { status: 404 });
    }

    const msgPayload: Record<string, unknown> = {
      channel: "whatsapp",
      direction: "inbound",
      senderName: fromNumber,
      body: messageBody + (mediaUrl ? `\n\nMedia: ${mediaUrl}` : ""),
    };
    if (body.messageId) msgPayload.externalId = body.messageId;
    await addMessage(ticket.id, msgPayload as never);

    return NextResponse.json({ ok: true, message: "WhatsApp message processed." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "WEBHOOK_ERROR", message: e instanceof Error ? e.message : "Failed to process WhatsApp message." } }, { status: 500 });
  }
}
