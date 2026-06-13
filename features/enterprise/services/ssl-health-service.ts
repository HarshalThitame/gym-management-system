import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";

async function checkSslCertificate(domain: string): Promise<{
  issued: boolean;
  expiresAt: string | null;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  error: string | null;
}> {
  try {
    const httpsUrl = `https://${domain}/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(httpsUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);

    const cert = (response as unknown as { tls?: { cipher?: { version?: string }; peerCert?: { subject?: string; issuer?: string; valid_from?: string; valid_to?: string } } }).tls;

    if (!cert?.peerCert) {
      const nodeFetch = await fetch(httpsUrl, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      const nodeCert = (nodeFetch as unknown as { socket?: { getPeerCertificate?: () => { subject?: Record<string, string>; issuer?: Record<string, string>; valid_from?: string; valid_to?: string } } }).socket?.getPeerCertificate?.();
      if (nodeCert) {
        return {
          issued: true,
          expiresAt: nodeCert.valid_to ?? null,
          issuer: nodeCert.issuer ? Object.values(nodeCert.issuer).join(", ") : null,
          subject: nodeCert.subject ? Object.values(nodeCert.subject).join(", ") : null,
          validFrom: nodeCert.valid_from ?? null,
          error: null,
        };
      }
    }

    if (cert?.peerCert) {
      return {
        issued: true,
        expiresAt: cert.peerCert.valid_to ?? null,
        issuer: cert.peerCert.issuer ?? null,
        subject: cert.peerCert.subject ?? null,
        validFrom: cert.peerCert.valid_from ?? null,
        error: null,
      };
    }

    return { issued: false, expiresAt: null, issuer: null, subject: null, validFrom: null, error: "Could not retrieve certificate" };
  } catch (err) {
    return { issued: false, expiresAt: null, issuer: null, subject: null, validFrom: null, error: err instanceof Error ? err.message : "SSL check failed" };
  }
}

export type SslHealthStatus = {
  domainId: string;
  domain: string;
  organizationId: string;
  issued: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  issuer: string | null;
  alertLevel: "healthy" | "expiring_soon" | "expired" | "failed";
};

export async function checkDomainSslHealth(domainId: string, domain: string, organizationId: string): Promise<SslHealthStatus> {
  const result = await checkSslCertificate(domain);

  let daysUntilExpiry: number | null = null;
  let alertLevel: SslHealthStatus["alertLevel"] = "healthy";

  if (result.expiresAt) {
    const expiryDate = new Date(result.expiresAt);
    const now = new Date();
    daysUntilExpiry = Math.round((expiryDate.getTime() - now.getTime()) / 86400000);
    if (daysUntilExpiry < 0) alertLevel = "expired";
    else if (daysUntilExpiry < 30) alertLevel = "expiring_soon";
  }

  if (!result.issued) alertLevel = "failed";

  const admin = getSupabaseAdminClient();
  if (admin) {
    const raw = admin as never as {
      from(t: string): {
        insert(r: Record<string, unknown>): Promise<unknown>;
      };
    };

    await raw.from("tenant_domain_checks").insert({
      tenant_domain_id: domainId,
      organization_id: organizationId,
      domain,
      provider: "manual",
      check_status: result.issued ? "passed" : "failed",
      dns_status: "skipped",
      ownership_status: "skipped",
      tls_status: result.issued ? "passed" : "failed",
      expected_records: [],
      observed_records: {
        ssl: {
          issuer: result.issuer,
          subject: result.subject,
          validFrom: result.validFrom,
          expiresAt: result.expiresAt,
          daysUntilExpiry,
          checkedAt: new Date().toISOString(),
        },
      },
      error_message: result.error,
      checked_at: new Date().toISOString(),
    });
  }

  return { domainId, domain, organizationId, issued: result.issued, expiresAt: result.expiresAt, daysUntilExpiry, issuer: result.issuer, alertLevel };
}

export async function runSslHealthCheck(domainIds: Array<{ id: string; domain: string; organizationId: string }>): Promise<{
  healthy: number;
  expiringSoon: number;
  expired: number;
  failed: number;
  details: SslHealthStatus[];
}> {
  const results: SslHealthStatus[] = [];
  for (const d of domainIds) {
    try {
      const status = await checkDomainSslHealth(d.id, d.domain, d.organizationId);
      results.push(status);
    } catch (err) {
      billingLogger.error("sslHealthCheck", `Failed for ${d.domain}`, { error: err instanceof Error ? err.message : "unknown" });
      results.push({ domainId: d.id, domain: d.domain, organizationId: d.organizationId, issued: false, expiresAt: null, daysUntilExpiry: null, issuer: null, alertLevel: "failed" });
    }
  }

  return {
    healthy: results.filter((r) => r.alertLevel === "healthy").length,
    expiringSoon: results.filter((r) => r.alertLevel === "expiring_soon").length,
    expired: results.filter((r) => r.alertLevel === "expired").length,
    failed: results.filter((r) => r.alertLevel === "failed").length,
    details: results,
  };
}

export async function sendDomainAlert(alert: SslHealthStatus, alertType: "ssl_expiry" | "ssl_expired" | "ssl_failed" | "domain_down"): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  billingLogger.info("domainAlert", `${alertType}: ${alert.domain}`, { domainId: alert.domainId, daysUntilExpiry: alert.daysUntilExpiry });

  const hooksUrl = process.env.DOMAIN_ALERT_WEBHOOK_URL;
  if (hooksUrl) {
    try {
      await fetch(hooksUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: alertType,
          domain: alert.domain,
          domainId: alert.domainId,
          organizationId: alert.organizationId,
          daysUntilExpiry: alert.daysUntilExpiry,
          timestamp: new Date().toISOString(),
          severity: alertType === "ssl_expired" || alertType === "domain_down" ? "critical" : "warning",
        }),
      });
    } catch (err) {
      billingLogger.error("domainAlertWebhook", `Failed to send alert for ${alert.domain}`, { error: err instanceof Error ? err.message : "unknown" });
    }
  }
}
