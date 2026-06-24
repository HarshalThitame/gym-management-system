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

  const [orgsRes, subsRes] = await Promise.all([
    db.from("organizations").select("id, name").order("name", { ascending: true }),
    db.from("organization_subscriptions")
      .select("organization_id, package_id, status")
      .in("status", ["active", "trial"]),
  ]);

  const allOrgs = (orgsRes.data ?? []) as RawRow[];
  const allSubs = (subsRes.data ?? []) as RawRow[];

  const activeOrgIds = new Set(allSubs.map((s) => asString(s.organization_id)));

  // Build org name lookup
  const orgNameMap: Record<string, string> = {};
  for (const org of allOrgs) {
    orgNameMap[asString(org.id)] = asString(org.name);
  }

  // Get unique package IDs
  const packageIds = [...new Set(allSubs.map((s) => asString(s.package_id)))].filter(Boolean);

  // Batch fetch: all package features for all relevant packages
  const uniqueOrgIds = [...new Set(allSubs.map((s) => asString(s.organization_id)))].filter(Boolean);

  const [pkgFeaturesAllRes, orgEntitlementsAllRes, orgLimitsAllRes] = await Promise.all([
    // All package features for active packages
    db.from("package_features").select("package_id, feature_code")
      .in("package_id" as never, packageIds as never),
    // All org entitlements for active orgs
    db.from("organization_entitlements").select("organization_id, feature_code")
      .in("organization_id" as never, uniqueOrgIds as never),
    // All org usage limits for active orgs
    db.from("organization_usage_limits").select("organization_id, limit_code")
      .in("organization_id" as never, uniqueOrgIds as never),
  ]);

  // Index package features by package_id
  const pkgFeaturesByPkg: Record<string, Set<string>> = {};
  for (const row of (pkgFeaturesAllRes.data ?? []) as RawRow[]) {
    const pkgId = asString(row.package_id);
    const fc = asString(row.feature_code);
    if (!pkgFeaturesByPkg[pkgId]) pkgFeaturesByPkg[pkgId] = new Set();
    if (fc) pkgFeaturesByPkg[pkgId].add(fc);
  }

  // Index org entitlements by org_id
  const orgEntitlementsByOrg: Record<string, Set<string>> = {};
  for (const row of (orgEntitlementsAllRes.data ?? []) as RawRow[]) {
    const orgId = asString(row.organization_id);
    const fc = asString(row.feature_code);
    if (!orgEntitlementsByOrg[orgId]) orgEntitlementsByOrg[orgId] = new Set();
    if (fc) orgEntitlementsByOrg[orgId].add(fc);
  }

  // Detect stale entitlements and missing entitlements
  const staleFeaturesPerOrg: EntitlementHealthReport["staleFeaturesPerOrg"] = [];
  let orgsWithMissingEntitlements = 0;

  for (const sub of allSubs) {
    const orgId = asString(sub.organization_id);
    const pkgId = asString(sub.package_id);

    const pkgFeatures = pkgFeaturesByPkg[pkgId] ?? new Set<string>();
    const orgFeatures = orgEntitlementsByOrg[orgId] ?? new Set<string>();

    const staleFeatureCodes: string[] = [];
    for (const code of orgFeatures) {
      if (!pkgFeatures.has(code)) {
        staleFeatureCodes.push(code);
      }
    }

    if (staleFeatureCodes.length > 0) {
      staleFeaturesPerOrg.push({
        orgId,
        orgName: orgNameMap[orgId] ?? "",
        staleFeatureCodes,
      });
    }

    for (const code of pkgFeatures) {
      if (!orgFeatures.has(code)) {
        orgsWithMissingEntitlements++;
        break;
      }
    }
  }

  // Batch fetch last sync timestamps for all orgs
  const lastSyncTimestamps: EntitlementHealthReport["lastSyncTimestamps"] = [];

  const [entEventAllRes] = await Promise.all([
    db.from("subscription_events")
      .select("organization_id, event_type, created_at")
      .in("organization_id" as never, uniqueOrgIds as never)
      .in("event_type" as never, ["entitlement_sync_completed" as never, "usage_limits_sync_completed" as never])
      .order("created_at", { ascending: false }),
  ]);

  // The above single query gets both event types; we split in memory.
  // For each org, take the most recent of each type.
  const orgEntSyncTimes: Record<string, string | null> = {};
  const orgLimSyncTimes: Record<string, string | null> = {};

  for (const row of (entEventAllRes.data ?? []) as RawRow[]) {
    const orgId = asString(row.organization_id);
    const eventType = asString(row.event_type);
    const createdAt = asString(row.created_at);

    if (eventType === "entitlement_sync_completed" && !orgEntSyncTimes[orgId]) {
      orgEntSyncTimes[orgId] = createdAt || null;
    } else if (eventType === "usage_limits_sync_completed" && !orgLimSyncTimes[orgId]) {
      orgLimSyncTimes[orgId] = createdAt || null;
    }
  }

  for (const org of allOrgs) {
    const orgId = asString(org.id);
    lastSyncTimestamps.push({
      orgId,
      orgName: asString(org.name),
      entitlementsSyncedAt: orgEntSyncTimes[orgId] ?? null,
      limitsSyncedAt: orgLimSyncTimes[orgId] ?? null,
    });
  }

  return {
    totalOrgs: allOrgs.length,
    orgsWithActiveSub: activeOrgIds.size,
    orgsWithStaleEntitlements: staleFeaturesPerOrg.length,
    staleFeaturesPerOrg,
    orgsWithMissingEntitlements,
    lastSyncTimestamps,
  };
}
