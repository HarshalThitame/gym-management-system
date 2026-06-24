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
      insert(row: RawRow): Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
      delete(): {
        eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
        not(k: string, v: string, ref: string): Promise<{ error: { message: string } | null }>;
      };
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

  let deletedEntitlements = 0;
  let deletedLimits = 0;

  for (const org of activeOrgs) {
    const orgId = asString(org.organization_id);
    const pkgId = asString(org.package_id);

    const { data: validFeatures } = await db
      .from("package_features")
      .select("feature_code")
      .eq("package_id" as never, pkgId as never);

    const validFeatureCodes = new Set((validFeatures ?? []).map((r) => asString(r.feature_code)));

    const { data: existingEntitlements } = await db
      .from("organization_entitlements")
      .select("feature_code")
      .eq("organization_id" as never, orgId as never);

    for (const ent of existingEntitlements ?? []) {
      const fc = asString(ent.feature_code);
      if (fc && !validFeatureCodes.has(fc)) {
        const { error } = await db
          .from("organization_entitlements")
          .delete()
          .eq("organization_id" as never, orgId as never)
          .eq("feature_code" as never, fc as never);
        if (!error) deletedEntitlements++;
      }
    }

    const { data: validLimits } = await db
      .from("package_limits")
      .select("limit_code")
      .eq("package_id" as never, pkgId as never);

    const validLimitCodes = new Set((validLimits ?? []).map((r) => asString(r.limit_code)));

    const { data: existingLimits } = await db
      .from("organization_usage_limits")
      .select("limit_code")
      .eq("organization_id" as never, orgId as never);

    for (const lim of existingLimits ?? []) {
      const lc = asString(lim.limit_code);
      if (lc && !validLimitCodes.has(lc)) {
        const { error } = await db
          .from("organization_usage_limits")
          .delete()
          .eq("organization_id" as never, orgId as never)
          .eq("limit_code" as never, lc as never);
        if (!error) deletedLimits++;
      }
    }
  }

  revalidatePath("/super-admin/feature-audit");

  return { deletedEntitlements, deletedLimits, success: true };
}
