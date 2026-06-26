import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AlertRule = {
  service: string;
  channels: string[];
  severityThreshold: "info" | "warning" | "critical";
};

export type AlertConfig = {
  id?: string;
  emailRecipients: string;
  slackWebhookUrl: string;
  pagerdutyIntegrationKey: string;
  pagerdutySeverityMapping: Record<string, string>;
  thresholdLatencyWarningMs: number;
  thresholdErrorRatePct: number;
  thresholdUptimeWarningPct: number;
  alertRules: AlertRule[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AlertHistoryEntry = {
  id: string;
  service: string;
  component: string;
  severity: "info" | "warning" | "critical";
  channel: "email" | "slack" | "pagerduty" | "all";
  title: string;
  message: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
};

export async function getAlertConfig(): Promise<AlertConfig | null> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;
    const { data } = await (supabase as any)
      .from("monitoring_alert_configs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      emailRecipients: data.email_recipients ?? "",
      slackWebhookUrl: data.slack_webhook_url ?? "",
      pagerdutyIntegrationKey: data.pagerduty_integration_key ?? "",
      pagerdutySeverityMapping: data.pagerduty_severity_mapping ?? { healthy: "info", degraded: "warning", down: "critical" },
      thresholdLatencyWarningMs: data.threshold_latency_warning_ms ?? 500,
      thresholdErrorRatePct: data.threshold_error_rate_pct ?? 5,
      thresholdUptimeWarningPct: data.threshold_uptime_warning_pct ?? 99,
      alertRules: data.alert_rules ?? [],
      isActive: data.is_active ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

export async function saveAlertConfig(config: AlertConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { success: false, error: "Supabase client not configured" };

    const payload: Record<string, unknown> = {
      email_recipients: config.emailRecipients,
      slack_webhook_url: config.slackWebhookUrl,
      pagerduty_integration_key: config.pagerdutyIntegrationKey,
      pagerduty_severity_mapping: config.pagerdutySeverityMapping,
      threshold_latency_warning_ms: config.thresholdLatencyWarningMs,
      threshold_error_rate_pct: config.thresholdErrorRatePct,
      threshold_uptime_warning_pct: config.thresholdUptimeWarningPct,
      alert_rules: config.alertRules,
      is_active: config.isActive,
      updated_at: new Date().toISOString(),
    };

    if (config.id) {
      const { error } = await (supabase as any)
        .from("monitoring_alert_configs")
        .update(payload)
        .eq("id", config.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await (supabase as any)
        .from("monitoring_alert_configs")
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Unknown error" };
  }
}

export async function getAlertHistory(limit: number = 50): Promise<AlertHistoryEntry[]> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("monitoring_alert_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      service: r.service,
      component: r.component,
      severity: r.severity,
      channel: r.channel,
      title: r.title,
      message: r.message,
      acknowledged: r.acknowledged,
      acknowledgedAt: r.acknowledged_at,
      acknowledgedBy: r.acknowledged_by,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return false;
    const { error } = await (supabase as any)
      .from("monitoring_alert_history")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq("id", alertId);
    return !error;
  } catch {
    return false;
  }
}

export async function testSlackWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "🟢 *Monitoring Alert Test* — This is a test message from the Monitoring Center.\nYour Slack webhook is configured correctly.",
      }),
    });
    if (res.ok) return { success: true, message: "Test message sent successfully" };
    const body = await res.text();
    return { success: false, message: `Slack returned status ${res.status}: ${body.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, message: err.message ?? "Failed to reach Slack webhook" };
  }
}

export async function testPagerDuty(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: key,
        event_action: "trigger",
        payload: {
          summary: "[Test] Monitoring alert configuration test",
          source: "Monitoring Center",
          severity: "info",
          custom_details: { test: true },
        },
      }),
    });
    if (res.ok) return { success: true, message: "Test PagerDuty alert sent successfully" };
    const body = await res.text();
    return { success: false, message: `PagerDuty returned status ${res.status}: ${body.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, message: err.message ?? "Failed to reach PagerDuty" };
  }
}
