"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import {
  syncOrganizationEntitlements,
  syncOrganizationUsageLimits,
} from "@/features/subscription/entitlement-sync-service";

const superAdminRoles = ["super_admin"] as const;

type RawRow = Record<string, unknown>;
type QueryResult = { data: RawRow[] | null; error: { message: string } | null };
type QueryBuilder = PromiseLike<QueryResult> & {
  eq(k: string, v: unknown): QueryBuilder;
  in(k: string, vals: readonly unknown[]): QueryBuilder;
  order(k: string, o: { ascending: boolean }): QueryBuilder;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function adminDb() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Database connection failed.");
  return client as unknown as {
    from(t: string): {
      select(c: string): QueryBuilder;
      insert(row: RawRow): QueryBuilder;
      delete(): QueryBuilder;
    };
  };
}

export type SyncAllResult = {
  synced: number;
  failed: number;
  errors: string[];
};

export type CleanupStaleResult = {
  deletedEntitlements: number;
  deletedLimits: number;
};

export async function syncAllOrganizationEntitlements(_prevState: unknown): Promise<SyncAllResult & { success?: boolean }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) {
    return { synced: 0, failed: 0, errors: ["Super Admin access is required."], success: false };
  }

  const db = await adminDb();

  const { data: orgs } = await db
    .from("organization_subscriptions")
    .select("organization_id")
    .in("status", ["active", "trial"])
    .order("organization_id", { ascending: true });

  const uniqueOrgIds = [...new Set((orgs ?? []).map((r) => asString(r.organization_id)))];

  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < uniqueOrgIds.length; i += 10) {
    const batch = uniqueOrgIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (orgId) => {
        const [entRes, limRes] = await Promise.all([
          syncOrganizationEntitlements(orgId, "Manual bulk sync"),
          syncOrganizationUsageLimits(orgId, "Manual bulk sync"),
        ]);
        if (!entRes.ok) throw new Error(entRes.error);
        if (!limRes.ok) throw new Error(limRes.error);
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        synced++;
      } else {
        failed++;
        errors.push(result.reason instanceof Error ? result.reason.message : "Unknown sync failure");
      }
    }
  }

  revalidatePath("/super-admin/feature-audit");

  return { synced, failed, errors, success: failed === 0 };
}

export async function cleanupStaleEntitlements(_prevState: unknown): Promise<CleanupStaleResult & { success?: boolean }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) {
    return { deletedEntitlements: 0, deletedLimits: 0, success: false };
  }

  const db = await adminDb();

  const { data: activeOrgs } = await db
    .from("organization_subscriptions")
    .select("organization_id, package_id")
    .in("status", ["active", "trial"]);

  if (!activeOrgs || activeOrgs.length === 0) {
    return { deletedEntitlements: 0, deletedLimits: 0, success: true };
  }

  const uniqueOrgIds = [...new Set(activeOrgs.map((o) => asString(o.organization_id)))];
  const uniquePkgIds = [...new Set(activeOrgs.map((o) => asString(o.package_id)))].filter(Boolean);

  // Batch fetch all package features and org entitlements in parallel
  const [pkgFeaturesRes, orgEntitlementsRes, pkgLimitsRes, orgLimitsRes] = await Promise.all([
    db.from("package_features").select("package_id, feature_code")
      .in("package_id" as never, uniquePkgIds as never),
    db.from("organization_entitlements").select("organization_id, feature_code")
      .in("organization_id" as never, uniqueOrgIds as never),
    db.from("package_limits").select("package_id, limit_code")
      .in("package_id" as never, uniquePkgIds as never),
    db.from("organization_usage_limits").select("organization_id, limit_code")
      .in("organization_id" as never, uniqueOrgIds as never),
  ]);

  // Index: package_id → Set<feature_code>
  const pkgFeatures: Record<string, Set<string>> = {};
  for (const row of (pkgFeaturesRes.data ?? []) as RawRow[]) {
    const pid = asString(row.package_id);
    const fc = asString(row.feature_code);
    if (!pkgFeatures[pid]) pkgFeatures[pid] = new Set();
    if (fc) pkgFeatures[pid].add(fc);
  }

  // Index: package_id → Set<limit_code>
  const pkgLimits: Record<string, Set<string>> = {};
  for (const row of (pkgLimitsRes.data ?? []) as RawRow[]) {
    const pid = asString(row.package_id);
    const lc = asString(row.limit_code);
    if (!pkgLimits[pid]) pkgLimits[pid] = new Set();
    if (lc) pkgLimits[pid].add(lc);
  }

  // Collect stale feature codes and limit codes to delete
  const entDeletions: { orgId: string; featureCode: string }[] = [];
  const limDeletions: { orgId: string; limitCode: string }[] = [];

  for (const row of (orgEntitlementsRes.data ?? []) as RawRow[]) {
    const orgId = asString(row.organization_id);
    const fc = asString(row.feature_code);

    // Find this org's package
    const org = activeOrgs.find((o) => asString(o.organization_id) === orgId);
    if (!org) continue;
    const pkgId = asString(org.package_id);
    const validCodes = pkgFeatures[pkgId] ?? new Set<string>();

    if (fc && !validCodes.has(fc)) {
      entDeletions.push({ orgId, featureCode: fc });
    }
  }

  for (const row of (orgLimitsRes.data ?? []) as RawRow[]) {
    const orgId = asString(row.organization_id);
    const lc = asString(row.limit_code);

    const org = activeOrgs.find((o) => asString(o.organization_id) === orgId);
    if (!org) continue;
    const pkgId = asString(org.package_id);
    const validCodes = pkgLimits[pkgId] ?? new Set<string>();

    if (lc && !validCodes.has(lc)) {
      limDeletions.push({ orgId, limitCode: lc });
    }
  }

  // Execute deletions in parallel batches of 10
  let deletedEntitlements = 0;
  let deletedLimits = 0;

  for (let i = 0; i < entDeletions.length; i += 10) {
    const batch = entDeletions.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((d) =>
        db.from("organization_entitlements")
          .delete()
          .eq("organization_id" as never, d.orgId as never)
          .eq("feature_code" as never, d.featureCode as never)
      )
    );
    deletedEntitlements += results.filter((r) => r.status === "fulfilled" && !r.value.error).length;
  }

  for (let i = 0; i < limDeletions.length; i += 10) {
    const batch = limDeletions.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((d) =>
        db.from("organization_usage_limits")
          .delete()
          .eq("organization_id" as never, d.orgId as never)
          .eq("limit_code" as never, d.limitCode as never)
      )
    );
    deletedLimits += results.filter((r) => r.status === "fulfilled" && !r.value.error).length;
  }

  revalidatePath("/super-admin/feature-audit");

  return { deletedEntitlements, deletedLimits, success: true };
}
