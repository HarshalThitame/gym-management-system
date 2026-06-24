import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type RawRow = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function adminDb() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Database connection failed.");
  return client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
        in(k: string, vals: string[]): {
          order(k: string, o: { ascending: boolean }): Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

export type EntitlementHealthReport = {
  totalOrgs: number;
  orgsWithActiveSub: number;
  orgsWithStaleEntitlements: number;
  staleFeaturesPerOrg: {
    orgId: string;
    orgName: string;
    staleFeatureCodes: string[];
  }[];
  orgsWithMissingEntitlements: number;
  lastSyncTimestamps: {
    orgId: string;
    orgName: string;
    entitlementsSyncedAt: string | null;
    limitsSyncedAt: string | null;
  }[];
};

export async function getEntitlementHealthReport(): Promise<EntitlementHealthReport> {
  const db = await adminDb();

  const { data: allOrgs } = await db
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: allSubs } = await db
    .from("organization_subscriptions")
    .select("organization_id, package_id, status")
    .in("status", ["active", "trial"]);

  const activeOrgIds = new Set((allSubs ?? []).map((s) => asString(s.organization_id)));

  const staleFeaturesPerOrg: EntitlementHealthReport["staleFeaturesPerOrg"] = [];
  let orgsWithMissingEntitlements = 0;

  if (allSubs) {
    for (const sub of allSubs) {
      const orgId = asString(sub.organization_id);
      const pkgId = asString(sub.package_id);

      const [pkgFeaturesRes, orgEntitlementsRes, orgLimitsRes] = await Promise.all([
        db.from("package_features").select("feature_code").eq("package_id" as never, pkgId as never),
        db.from("organization_entitlements").select("feature_code").eq("organization_id" as never, orgId as never),
        db.from("organization_usage_limits").select("limit_code").eq("organization_id" as never, orgId as never),
      ]);

      const pkgFeatureCodes = new Set((pkgFeaturesRes.data ?? []).map((r) => asString(r.feature_code)));
      const orgFeatureCodes = new Set((orgEntitlementsRes.data ?? []).map((r) => asString(r.feature_code)));

      const staleFeatureCodes: string[] = [];
      for (const code of orgFeatureCodes) {
        if (code && !pkgFeatureCodes.has(code)) {
          staleFeatureCodes.push(code);
        }
      }

      if (staleFeatureCodes.length > 0) {
        const orgName = (allOrgs ?? []).find((o) => asString(o.id) === orgId)
          ? asString(((allOrgs ?? []).find((o) => asString(o.id) === orgId) as RawRow)?.name ?? "")
          : "";
        staleFeaturesPerOrg.push({ orgId, orgName, staleFeatureCodes });
      }

      for (const code of pkgFeatureCodes) {
        if (code && !orgFeatureCodes.has(code)) {
          orgsWithMissingEntitlements++;
          break;
        }
      }
    }
  }

  const lastSyncTimestamps: EntitlementHealthReport["lastSyncTimestamps"] = [];

  for (const org of allOrgs ?? []) {
    const orgId = asString(org.id);

    const [entEventRes, limEventRes] = await Promise.all([
      db
        .from("subscription_events")
        .select("created_at")
        .eq("organization_id" as never, orgId as never)
        .eq("event_type" as never, "entitlement_sync_completed" as never)
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("subscription_events")
        .select("created_at")
        .eq("organization_id" as never, orgId as never)
        .eq("event_type" as never, "usage_limits_sync_completed" as never)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    lastSyncTimestamps.push({
      orgId,
      orgName: asString(org.name),
      entitlementsSyncedAt: asString(entEventRes.data?.[0]?.created_at ?? "") || null,
      limitsSyncedAt: asString(limEventRes.data?.[0]?.created_at ?? "") || null,
    });
  }

  return {
    totalOrgs: (allOrgs ?? []).length,
    orgsWithActiveSub: activeOrgIds.size,
    orgsWithStaleEntitlements: staleFeaturesPerOrg.length,
    staleFeaturesPerOrg,
    orgsWithMissingEntitlements,
    lastSyncTimestamps,
  };
}
