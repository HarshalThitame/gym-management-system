import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export async function listNotificationRules(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  let q = db.from("security_notification_rules").select("*").eq("is_active", true);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data } = await q.order("created_at", { ascending: false });
  return data ?? [];
}

export async function createNotificationRule(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data, error } = await db.from("security_notification_rules").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function processSecurityAlert(event: Record<string, unknown>) {
  const severity = event.severity as string;
  const eventType = event.event_type as string;
  const orgId = event.organization_id as string | null;

  const rules = await listNotificationRules(orgId ?? undefined);
  const matchingRules = rules.filter((r: Record<string, unknown>) => {
    const rule = r as Record<string, unknown>;
    const types = rule.event_types as string[];
    const threshold = rule.severity_threshold as string;
    const severityOrder = ["info", "low", "medium", "high", "critical"];
    return types.includes(eventType) && severityOrder.indexOf(severity) >= severityOrder.indexOf(threshold);
  });

  for (const rule of matchingRules) {
    const r = rule as Record<string, unknown>;
    const channels = r.channels as string[];
    for (const channel of channels) {
      if (channel === "email") await sendEmailAlert(r, event);
      if (channel === "slack" && r.slack_webhook) await sendSlackAlert(r.slack_webhook as string, event);
      if (channel === "teams" && r.teams_webhook) await sendTeamsAlert(r.teams_webhook as string, event);
      if (channel === "webhook" && r.webhook_url) await sendWebhookAlert(r.webhook_url as string, event);
    }
  }
}

async function sendEmailAlert(rule: Record<string, unknown>, event: Record<string, unknown>) {
  console.log(`[Security Alert] Email: ${rule.name as string} - ${event.description as string}`);
}

async function sendSlackAlert(webhook: string, event: Record<string, unknown>) {
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 *Security Alert*: ${event.description as string}\nSeverity: ${event.severity as string}\nTime: ${event.created_at as string}` }),
    });
  } catch {}
}

async function sendTeamsAlert(webhook: string, event: Record<string, unknown>) {
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Security Alert", text: event.description as string }),
    });
  } catch {}
}

async function sendWebhookAlert(url: string, event: Record<string, unknown>) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {}
}
