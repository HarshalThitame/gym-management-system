import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/services/email/resend";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type ThresholdInput = {
  organizationId: string;
  thresholdType: "usage_percent" | "amount" | "invoice_count" | "days_overdue";
  thresholdValue: number;
  comparison?: "gte" | "lte" | "eq";
  notificationChannels?: string[];
  cooldownHours?: number;
};

export async function createThreshold(input: ThresholdInput): Promise<{ ok: boolean; message: string; thresholdId?: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: threshold } = await db.from("billing_thresholds").insert({
    organization_id: input.organizationId,
    threshold_type: input.thresholdType,
    threshold_value: input.thresholdValue,
    comparison: input.comparison ?? "gte",
    notification_channels: input.notificationChannels ?? ["email"],
    cooldown_hours: input.cooldownHours ?? 24,
    is_active: true,
  });

  if (!threshold) return { ok: false, message: "Failed to create threshold." };
  return { ok: true, message: "Threshold created.", thresholdId: threshold.id as string };
}

export async function deleteThreshold(thresholdId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { error } = await db.from("billing_thresholds").delete().eq("id", thresholdId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Threshold deleted." };
}

export async function evaluateThresholds(organizationId: string): Promise<Array<{ thresholdId: string; triggered: boolean; message: string }>> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: thresholds } = await db.from("billing_thresholds")
    .select("*")
    .eq("organization_id", [organizationId])
    .eq("is_active", true);

  const results: Array<{ thresholdId: string; triggered: boolean; message: string }> = [];

  for (const t of thresholds ?? []) {
    const thresholdType = t.threshold_type as string;
    const thresholdValue = parseFloat(t.threshold_value as string);
    const comparison = (t.comparison as string) ?? "gte";
    const cooldownHours = (t.cooldown_hours as number) ?? 24;
    const lastTriggered = t.last_triggered_at as string | null;
    const thresholdId = t.id as string;

    if (lastTriggered) {
      const cooldownMs = cooldownHours * 3600000;
      if (Date.now() - new Date(lastTriggered).getTime() < cooldownMs) {
        continue;
      }
    }

    let currentValue = 0;
    let description = "";

    if (thresholdType === "usage_percent") {
      const { data: sub } = await db.from("organization_subscriptions").select("*").eq("organization_id", [organizationId]).maybeSingle();
      if (sub) {
        const raw = supabase as never as { from(t: string): { select(c: string, o: { count: "exact"; head: true }): { eq(c: string, v: string): Promise<{ count: number | null }> } } };
        const { count: memberCount } = await raw.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
        const maxMembers = (sub.max_members as number) ?? -1;
        currentValue = maxMembers > 0 ? Math.round(((memberCount ?? 0) / maxMembers) * 100) : 0;
        description = `Usage: ${currentValue}% (limit: ${thresholdValue}%)`;
      }
    } else if (thresholdType === "amount") {
      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: invoices } = await db.from("org_subscription_invoices")
        .select("*")
        .eq("organization_id", [organizationId])
        .gte("created_at", monthStart.toISOString());
      currentValue = (invoices ?? []).reduce((s: number, inv: Record<string, unknown>) => s + ((inv.total_amount as number) || 0), 0);
      description = `Amount this period: ₹${(currentValue / 100).toFixed(2)} (threshold: ₹${(thresholdValue / 100).toFixed(2)})`;
    }

    const triggered = comparison === "gte" ? currentValue >= thresholdValue
      : comparison === "lte" ? currentValue <= thresholdValue
      : currentValue === thresholdValue;

    if (triggered) {
      await db.from("billing_thresholds").update({
        last_triggered_at: new Date().toISOString(),
      }).eq("id", thresholdId);

      const channels = t.notification_channels as string[] ?? ["email"];
      if (channels.includes("email")) {
        try {
          await sendEmail({
            to: "", // would need org billing email
            subject: `Billing threshold triggered: ${thresholdType}`,
            html: `<p>Threshold triggered for org ${organizationId}: ${description}</p>`,
          });
        } catch {}
      }
    }

    results.push({ thresholdId, triggered, message: description });
  }

  return results;
}
