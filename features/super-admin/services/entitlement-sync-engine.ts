import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ApplyMode = "new_only" | "all" | "renewal" | "selected";

export async function syncOrganizationEntitlements(orgId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("sync_org_entitlements", { target_org_id: orgId });
  return { ok: !error, error: error?.message };
}

export async function hasEntitlement(orgId: string, featureKey: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("has_entitlement", { org_id: orgId, feature_key: featureKey });
  return data ?? false;
}

export async function checkUsageLimit(orgId: string, limitKey: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("check_usage_limit", { org_id: orgId, limit_key: limitKey });
  return (data ?? [])[0] ?? { current_usage: 0, max_limit: 0, within_limit: false };
}

export async function calculatePackageImpact(packageId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: orgs } = await supabase
    .from("organization_subscriptions")
    .select("organization_id, status, organizations!inner(id, name)")
    .eq("package_id", packageId)
    .neq("status", "cancelled");

  return {
    totalAffected: orgs?.length ?? 0,
    organizations: (orgs ?? []).map((o: any) => ({
      id: o.organization_id,
      name: o.organizations?.name ?? "Unknown",
      status: o.status,
    })),
  };
}

export async function applyPackageChanges(
  packageId: string,
  mode: ApplyMode = "all",
  selectedOrgIds?: string[]
) {
  const supabase = await createSupabaseServerClient();
  const impact = await calculatePackageImpact(packageId);

  let targetOrgs = impact.organizations;

  if (mode === "new_only") {
    // Only new subscriptions will get the updated package
    return { ok: true, affected: 0, message: "Changes will apply to new subscriptions only." };
  }

  if (mode === "selected" && selectedOrgIds) {
    targetOrgs = targetOrgs.filter((o) => selectedOrgIds.includes(o.id));
  }

  if (mode === "renewal") {
    // Mark for renewal — update scheduled_change_at
    for (const org of targetOrgs) {
      await supabase.from("organization_subscriptions")
        .update({
          apply_changes_at: "renewal",
          scheduled_package_id: packageId,
        })
        .eq("organization_id", org.id)
        .eq("package_id", packageId);
    }
    return { ok: true, affected: targetOrgs.length, message: `Changes scheduled for ${targetOrgs.length} org(s) on renewal.` };
  }

  // Apply immediately (mode === "all")
  for (const org of targetOrgs) {
    await syncOrganizationEntitlements(org.id);
  }

  return { ok: true, affected: targetOrgs.length, message: `Entitlements synced for ${targetOrgs.length} org(s).` };
}

export async function setOrganizationOverride(
  orgId: string,
  limitKey: string,
  overrideValue: number,
  reason: string,
  expiresAt?: string
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organization_usage_limits").upsert({
    organization_id: orgId,
    limit_key: limitKey,
    limit_value: -1, // Base value from package (irrelevant with override)
    overridden_value: overrideValue,
    override_reason: reason,
    override_expires_at: expiresAt ?? null,
  }, { onConflict: "organization_id, limit_key" });
  return { ok: !error, error: error?.message };
}

export async function setFeatureOverride(
  orgId: string,
  featureKey: string,
  enabled: boolean,
  reason: string,
  expiresAt?: string
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organization_feature_overrides").upsert({
    organization_id: orgId,
    feature_key: featureKey,
    enabled,
    reason,
    expires_at: expiresAt ?? null,
  }, { onConflict: "organization_id, feature_key" });
  return { ok: !error, error: error?.message };
}

export async function runHealthCheck() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("run_subscription_health_check");
  const results = (data ?? []) as Array<{ organization_id: string; status: string; message: string }>;

  // Store results
  for (const r of results) {
    await supabase.from("subscription_health_results").insert({
      check_type: "automated",
      status: r.status,
      organization_id: r.organization_id,
      message: r.message,
    });
  }

  return {
    healthy: results.filter((r) => r.status === "healthy").length,
    warnings: results.filter((r) => r.status === "warning").length,
    critical: results.filter((r) => r.status === "critical").length,
    results,
  };
}
