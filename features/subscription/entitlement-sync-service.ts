import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { CANCELLED_BILLING_FEATURES } from "@/features/entitlement/feature-registry";

type SyncResult = { ok: true; subscriptionId: string } | { ok: false; error: string };

type DbClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type RawRow = Record<string, unknown>;
type RawError = { message: string } | null;
type RawSelectQuery = {
  eq(column: string, value: unknown): Promise<{ data: RawRow[] | null; error: RawError }>;
};
type RawTableQuery = {
  select(columns: string): RawSelectQuery;
  upsert(row: RawRow, options?: RawRow): Promise<{ data: RawRow[] | null; error: RawError }>;
  insert(row: RawRow): Promise<{ data: RawRow[] | null; error: RawError }>;
  delete(): { eq(column: string, value: unknown): Promise<{ data: RawRow[] | null; error: RawError }> };
};
type RawDbClient = {
  from(table: string): RawTableQuery;
};

function db(): DbClient {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Database connection failed.");
  }
  return client;
}

function rawDb(): RawDbClient {
  return db() as unknown as RawDbClient;
}

async function getActiveSubscription(organizationId: string, includeCancelled = false) {
  const statuses = includeCancelled ? ["active", "trial", "cancelled"] : ["active", "trial"];
  const { data, error } = await db()
    .from("organization_subscriptions")
    .select("id, package_id, status")
    .eq("organization_id", organizationId)
    .in("status", statuses)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])[0] as { id: string; package_id: string; status: string } | undefined;
}

export async function syncOrganizationEntitlements(organizationId: string, reason = "Entitlements synced."): Promise<SyncResult> {
  try {
    const subscription = await getActiveSubscription(organizationId);
    if (!subscription) {
      // Check if there's a cancelled subscription — preserve billing features
      const cancelledSub = await getActiveSubscription(organizationId, true);
      if (cancelledSub && cancelledSub.status === "cancelled") {
        const client = rawDb();
        // Delete all non-billing entitlements
        const { data: existing } = await client
          .from("organization_entitlements")
          .select("feature_code")
          .eq("organization_id", organizationId);
        const existingFeatures = (existing ?? []).map((r: Record<string, unknown>) => r.feature_code as string);
        for (const code of existingFeatures) {
          if (!CANCELLED_BILLING_FEATURES.includes(code as never)) {
            await client.from("organization_entitlements").delete()
              .eq("organization_id", organizationId)
              .eq("feature_code", code);
          }
        }
        return { ok: true, subscriptionId: cancelledSub.id };
      }
      const client = rawDb();
      await client.from("organization_entitlements").delete().eq("organization_id", organizationId);
      return { ok: true, subscriptionId: "none" };
    }

    const client = rawDb();
    const { data: features, error } = await client
      .from("package_features")
      .select("feature_code, value, min_value, max_value")
      .eq("package_id", subscription.package_id);

    if (error) {
      return { ok: false, error: error.message };
    }

    const { error: deleteError } = await client
      .from("organization_entitlements")
      .delete()
      .eq("organization_id", organizationId);
    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    for (const feature of features ?? []) {
      const { error: upsertError } = await client
        .from("organization_entitlements")
        .upsert(
          {
            organization_id: organizationId,
            feature_code: feature.feature_code,
            value: feature.value,
            min_value: feature.min_value,
            max_value: feature.max_value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, feature_code" },
        );

      if (upsertError) {
        return { ok: false, error: upsertError.message };
      }
    }

    await client.from("subscription_events").insert({
      organization_id: organizationId,
      subscription_id: subscription.id,
      event_type: "entitlement_sync_completed",
      new_state: { entitlementsSyncedAt: new Date().toISOString() },
      actor_id: null,
      reason,
    });

    return { ok: true, subscriptionId: subscription.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Entitlement sync failed." };
  }
}

export async function syncOrganizationUsageLimits(organizationId: string, reason = "Usage limits synced."): Promise<SyncResult> {
  try {
    const subscription = await getActiveSubscription(organizationId);
    if (!subscription) {
      // For cancelled subscriptions, preserve usage limits (they're needed for billing display)
      const cancelledSub = await getActiveSubscription(organizationId, true);
      if (cancelledSub && cancelledSub.status === "cancelled") {
        return { ok: true, subscriptionId: cancelledSub.id };
      }
      const client = rawDb();
      await client.from("organization_usage_limits").delete().eq("organization_id", organizationId);
      return { ok: true, subscriptionId: "none" };
    }

    const client = rawDb();
    const { data: limits, error } = await client
      .from("package_limits")
      .select("limit_code, value, label, description")
      .eq("package_id", subscription.package_id);

    if (error) {
      return { ok: false, error: error.message };
    }

    const { error: deleteError } = await client
      .from("organization_usage_limits")
      .delete()
      .eq("organization_id", organizationId);
    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    for (const limit of limits ?? []) {
      const { error: upsertError } = await client
        .from("organization_usage_limits")
        .upsert(
          {
            organization_id: organizationId,
            limit_code: limit.limit_code,
            value: limit.value,
            label: limit.label,
            description: limit.description,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, limit_code" },
        );

      if (upsertError) {
        return { ok: false, error: upsertError.message };
      }
    }

    await client.from("subscription_events").insert({
      organization_id: organizationId,
      subscription_id: subscription.id,
      event_type: "usage_limits_sync_completed",
      new_state: { usageLimitsSyncedAt: new Date().toISOString() },
      actor_id: null,
      reason,
    });

    return { ok: true, subscriptionId: subscription.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Usage limit sync failed." };
  }
}
