import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PushNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority: "high" | "normal" | "low";
}

interface ExpoPushMessage {
  to: string;
  sound?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: "high" | "normal" | "default";
  channelId?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getExpoPushTokens(userIds: string[]): Promise<Map<string, string[]>> {
  const { data: devices } = await supabase
    .from("mobile_devices")
    .select("user_id, device_token")
    .in("user_id", userIds)
    .eq("is_active", true);

  const tokenMap = new Map<string, string[]>();
  for (const device of (devices ?? [])) {
    const tokens = tokenMap.get(device.user_id) ?? [];
    tokens.push(device.device_token);
    tokenMap.set(device.user_id, tokens);
  }
  return tokenMap;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: EXPO_ACCESS_TOKEN ? `Bearer ${EXPO_ACCESS_TOKEN}` : "",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Expo push API error: ${text}`);
  }
}

async function processQueue(): Promise<number> {
  const { data: pending } = await supabase
    .from("push_notification_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!pending || pending.length === 0) return 0;

  const notifications = pending as PushNotification[];
  const userIds = [...new Set(notifications.map((n) => n.user_id))];
  const tokenMap = await getExpoPushTokens(userIds);

  const messages: ExpoPushMessage[] = [];
  const failedIds: string[] = [];

  for (const notification of notifications) {
    const tokens = tokenMap.get(notification.user_id) ?? [];
    if (tokens.length === 0) {
      failedIds.push(notification.id);
      continue;
    }

    for (const token of tokens) {
      messages.push({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data ?? {},
        priority: notification.priority === "high" ? "high" : "normal",
        channelId: getChannelId(notification),
      });
    }
  }

  if (messages.length > 0) {
    await sendExpoPush(messages);
  }

  const successIds = notifications
    .filter((n) => !failedIds.includes(n.id))
    .map((n) => n.id);

  if (successIds.length > 0) {
    await supabase
      .from("push_notification_queue")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in("id", successIds);
  }

  if (failedIds.length > 0) {
    await supabase
      .from("push_notification_queue")
      .update({ status: "failed", error_message: "No device token" })
      .in("id", failedIds);
  }

  return messages.length;
}

function getChannelId(notification: PushNotification): string {
  const categoryMap: Record<string, string> = {
    attendance_reminder: "attendance_reminder",
    renewal_reminder: "renewal_reminder",
    payment_receipt: "payment_receipt",
    class_update: "class_booking",
    trainer_message: "trainer_message",
    lead_followup: "lead_followup",
    membership_alert: "membership_alert",
    system: "system",
  };
  return categoryMap[notification.data?.category ?? ""] ?? "system";
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const sent = await processQueue();

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Push delivery error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
