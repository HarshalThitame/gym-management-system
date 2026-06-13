/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { alertId } = await request.json();
    if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

    const { data: alert, error: alertError } = await supabase
      .from("analytics_alerts" as "gyms")
      .select("*")
      .eq("id", alertId as unknown as string)
      .single();

    if (alertError || !alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

    const a = alert as unknown as Record<string, unknown>;
    const payload = {
      event: "analytics_alert",
      alert_name: a.alert_name,
      metric_key: a.metric_key,
      condition_type: a.condition_type,
      threshold_value: a.threshold_value,
      severity: a.severity,
      triggered_at: new Date().toISOString(),
      organization_id: a.organization_id
    };

    const results: Array<{ channel: string; success: boolean; error?: string }> = [];

    // Slack delivery
    if (a.slack_webhook && typeof a.slack_webhook === "string" && a.slack_webhook.length > 0) {
      try {
        const slackRes = await fetch(a.slack_webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `*${a.severity}*: ${a.alert_name}`,
            attachments: [{ fields: Object.entries(payload).map(([k, v]) => ({ title: k, value: String(v), short: true })) }]
          })
        });
        results.push({ channel: "slack", success: slackRes.ok });
      } catch (e) { results.push({ channel: "slack", success: false, error: String(e) }); }
    }

    // Teams delivery
    if (a.teams_webhook && typeof a.teams_webhook === "string" && a.teams_webhook.length > 0) {
      try {
        const teamsRes = await fetch(a.teams_webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "@type": "MessageCard", "@context": "http://schema.org/extensions",
            summary: `Alert: ${a.alert_name}`,
            title: `${a.severity}: ${a.alert_name}`,
            sections: [{ facts: Object.entries(payload).map(([k, v]) => ({ name: k, value: String(v) })) }]
          })
        });
        results.push({ channel: "teams", success: teamsRes.ok });
      } catch (e) { results.push({ channel: "teams", success: false, error: String(e) }); }
    }

    // Webhook delivery
    if (a.webhook_url && typeof a.webhook_url === "string" && a.webhook_url.length > 0) {
      try {
        const webhookRes = await fetch(a.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        results.push({ channel: "webhook", success: webhookRes.ok });
      } catch (e) { results.push({ channel: "webhook", success: false, error: String(e) }); }
    }

    // Record in alert history
    await (supabase as any).from("analytics_alert_history").insert({
      alert_id: alertId,
      metric_key: a.metric_key,
      trigger_value: 0,
      threshold_value: a.threshold_value,
      condition_met: a.condition_type,
      notification_sent: results.some((r) => r.success),
      channels_used: results.filter((r) => r.success).map((r) => r.channel)
    });

    return NextResponse.json({ delivered: true, results, alert: a.alert_name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
