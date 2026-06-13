import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSslHealthCheck, sendDomainAlert } from "@/features/enterprise/services/ssl-health-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin client unavailable" }, { status: 503 });

  const { data: domains } = await admin.from("tenant_domains").select("id, domain, organization_id, ssl_status");
  if (!domains) return NextResponse.json({ error: "No domains found" }, { status: 404 });

  const domainIds = (domains as Array<Record<string, unknown>>).map((d) => ({
    id: d.id as string,
    domain: d.domain as string,
    organizationId: d.organization_id as string,
  }));

  const result = await runSslHealthCheck(domainIds);

  for (const d of result.details) {
    if (d.alertLevel === "expired") await sendDomainAlert(d, "ssl_expired");
    else if (d.alertLevel === "expiring_soon") await sendDomainAlert(d, "ssl_expiry");
    else if (d.alertLevel === "failed") await sendDomainAlert(d, "ssl_failed");
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    summary: { healthy: result.healthy, expiringSoon: result.expiringSoon, expired: result.expired, failed: result.failed },
  });
}
