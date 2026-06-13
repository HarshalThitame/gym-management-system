import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";

export async function checkDomainRegistrationExpiry(): Promise<{
  expiringSoon: number;
  expired: number;
  ok: number;
  errors: string[];
}> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { expiringSoon: 0, expired: 0, ok: 0, errors: ["Admin client unavailable"] };

  const { data: domains } = await admin.from("tenant_domains").select("id, domain, organization_id, metadata");
  if (!domains) return { expiringSoon: 0, expired: 0, ok: 0, errors: [] };

  let expiringSoon = 0;
  let expired = 0;
  let ok = 0;
  const errors: string[] = [];

  for (const d of domains as Array<Record<string, unknown>>) {
    try {
      const domainName = d.domain as string;
      const meta = (d.metadata ?? {}) as Record<string, unknown>;
      const existingExpiry = meta.registration_expires_at as string | null;

      if (existingExpiry) {
        const expiryDate = new Date(existingExpiry);
        const daysUntilExpiry = Math.round((expiryDate.getTime() - Date.now()) / 86400000);

        if (daysUntilExpiry < 0) {
          expired++;
          billingLogger.warn("domainRegistrationExpiry", `Domain ${domainName} registration EXPIRED on ${existingExpiry}`);
        } else if (daysUntilExpiry < 30) {
          expiringSoon++;
          billingLogger.info("domainRegistrationExpiry", `Domain ${domainName} registration expiring in ${daysUntilExpiry} days`);
        } else {
          ok++;
        }
        continue;
      }

      // Try to fetch WHOIS via DNS lookup (fallback)
      try {
        const { Resolver } = await import("dns/promises");
        const resolver = new Resolver();
        await resolver.resolve(domainName);
        ok++;
      } catch {
        errors.push(`Could not resolve ${domainName}`);
      }
    } catch (err) {
      errors.push(`${d.domain as string}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return { expiringSoon, expired, ok, errors };
}
