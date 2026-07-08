import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { billingLogger } from "@/features/billing/lib/logger";
import { sendCampaignSms } from "@/features/communications/lib/message-sender";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle() as never as {
    data: { gym_id: string | null } | null;
    error: unknown;
  };

  if (!profile?.gym_id) return NextResponse.json({ error: "No gym scope" }, { status: 403 });

  const body = await request.json() as { organizationId: string; to: string; message: string };
  if (!body.to || !body.message) {
    return NextResponse.json({ error: "to and message are required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const result = await sendCampaignSms({
    organizationId: body.organizationId,
    to: body.to,
    message: body.message,
  });

  if (!result.ok) {
    billingLogger.error("sms.send", "Failed to send SMS", { error: result.error });
    return NextResponse.json({ error: result.error || "SMS sending failed" }, { status: 500 });
  }

  // Log to sms_logs with provider message ID for webhook delivery tracking
  await admin.from("sms_logs").insert({
    gym_id: profile.gym_id,
    to_phone: body.to,
    message: body.message,
    provider: "msg91",
    status: "queued",
    provider_message_id: result.providerMessageId || null,
    queued_at: new Date().toISOString(),
  } as never);

  billingLogger.info("sms.send", "SMS queued", {
    to: body.to.slice(0, 6) + "****",
    providerMessageId: result.providerMessageId,
  });

  return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId });
}
