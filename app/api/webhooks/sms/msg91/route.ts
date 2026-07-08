import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";

type Msg91DeliveryPayload = {
  request_id?: string;
  flow_id?: string;
  mobiles?: string;
  status?: string;
  delivered_at?: string;
  sent_at?: string;
  error?: string;
  [key: string]: unknown;
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: Msg91DeliveryPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const messageId = payload.request_id || "";
    const status = payload.status || "";
    const phone = payload.mobiles || "";
    const errorMessage = payload.error || "";

    if (!messageId) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      provider_message_id: messageId,
      status: status === "DELIVERED" || status === "READ" ? "delivered" : status === "SENT" ? "sent" : status === "FAILED" ? "failed" : "queued",
    };

    if (status === "SENT" || status === "DELIVERED" || status === "READ") {
      updateData.sent_at = now;
    }
    if (status === "DELIVERED" || status === "READ") {
      updateData.delivered_at = now;
    }
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error: updateError } = await admin
      .from("sms_logs")
      .update(updateData as never)
      .eq("provider_message_id", messageId) as never as {
      error: { message: string } | null;
    };

    if (updateError) {
      billingLogger.warn("webhook.sms.msg91", "Failed to update SMS log", { messageId, error: updateError.message });
    }

    billingLogger.info("webhook.sms.msg91", "Delivery status updated", {
      messageId,
      status,
      phone: phone.slice(0, 6) + "****",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    billingLogger.error("webhook.sms.msg91", "Webhook handler error", { error: err instanceof Error ? err.message : "Unknown" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
