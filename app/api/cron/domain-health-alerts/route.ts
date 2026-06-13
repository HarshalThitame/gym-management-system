import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin client unavailable" }, { status: 503 });

  const { data: domains } = await admin.from("tenant_domains").select("id, domain, status, ssl_status, organization_id");
  if (!domains) return NextResponse.json({ error: "No domains" }, { status: 404 });

  const rows = domains as Array<Record<string, unknown>>;
  const failedDns = rows.filter((d) => (d.status as string) === "failed");
  const failedSsl = rows.filter((d) => (d.ssl_status as string) === "failed");
  const alerts: Array<{ type: string; domain: string; severity: string; timestamp: string }> = [];

  const now = new Date().toISOString();

  for (const d of failedDns) {
    alerts.push({ type: "dns_failed", domain: d.domain as string, severity: "critical", timestamp: now });
  }
  for (const d of failedSsl) {
    if (!failedDns.find((fd) => fd.id === d.id)) {
      alerts.push({ type: "ssl_failed", domain: d.domain as string, severity: "warning", timestamp: now });
    }
  }

  const webhookUrl = process.env.DOMAIN_ALERT_WEBHOOK_URL;
  if (webhookUrl && alerts.length > 0) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "domain_health_check", alerts, timestamp: now, summary: `${failedDns.length} DNS failures, ${failedSsl.length} SSL failures` }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true, timestamp: now, alerts, summary: { failedDns: failedDns.length, failedSsl: failedSsl.length } });
}
