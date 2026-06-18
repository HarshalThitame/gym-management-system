import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FeatureKey, LimitKey, SubscriptionStatus } from "./feature-registry";
import { ACTIVE_ENTITLEMENT_STATUSES } from "./feature-registry";

// ─── Types ─────────────────────────────────────────────────────────────────

export type PackageFeatureRow = {
  featureCode: FeatureKey;
  isEnabled: boolean;
};

export type PackageLimitRow = {
  limitCode: LimitKey;
  value: number;
  label: string | null;
};

export type PackageSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  trialDays: number;
};

export type SubscriptionSummary = {
  id: string;
  organizationId: string;
  packageId: string;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  replacedAt: string | null;
  scheduledStartDate: string | null;
  billingPeriod: string | null;
  autoRenew: boolean;
};

export type SubscriptionWithPackageFeatures = {
  subscription: SubscriptionSummary;
  package: PackageSummary;
  features: FeatureKey[];
  limits: Record<LimitKey, number>;
};

// ─── Low-level DB shape helpers (avoid generated-type coupling) ────────────

type RawRow = Record<string, unknown>;
type DbError = { message: string } | null;
type SelectResult = Promise<{ data: RawRow[] | null; error: DbError }>;
type RawDbClient = {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): SelectResult;
    };
  };
};

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

async function client(): Promise<RawDbClient> {
  return (await createSupabaseServerClient()) as unknown as RawDbClient;
}

// ─── Package feature queries ───────────────────────────────────────────────

/**
 * Returns the list of feature keys enabled for a package.
 * Reads from the canonical package_features table.
 */
export async function getPackageFeatures(packageId: string): Promise<FeatureKey[]> {
  const s = await client();
  const { data, error } = await s.from("package_features").select("feature_code, value").eq("package_id", packageId);
  if (error) return [];
  const out: FeatureKey[] = [];
  for (const row of (data ?? []) as RawRow[]) {
    if (asBool(row.value)) {
      const code = asString(row.feature_code);
      if (code) out.push(code as FeatureKey);
    }
  }
  return out;
}

/**
 * Returns enabled feature rows (code + flag) for a package.
 */
export async function getPackageFeatureRows(packageId: string): Promise<PackageFeatureRow[]> {
  const s = await client();
  const { data, error } = await s.from("package_features").select("feature_code, value").eq("package_id", packageId);
  if (error) return [];
  return ((data ?? []) as RawRow[]).map((r) => ({
    featureCode: (asString(r.feature_code) ?? "") as FeatureKey,
    isEnabled: asBool(r.value),
  }));
}

// ─── Package limit queries ─────────────────────────────────────────────────

/**
 * Returns all limits for a package keyed by limit code.
 */
export async function getPackageLimits(packageId: string): Promise<Record<string, number>> {
  const s = await client();
  const { data, error } = await s.from("package_limits").select("limit_code, value").eq("package_id", packageId);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as RawRow[]) {
    const code = asString(row.limit_code);
    if (code) out[code] = typeof row.value === "number" ? row.value : Number(row.value ?? 0);
  }
  return out;
}

/**
 * Returns limit rows (code + value + label) for a package.
 */
export async function getPackageLimitRows(packageId: string): Promise<PackageLimitRow[]> {
  const s = await client();
  const { data, error } = await s.from("package_limits").select("limit_code, value, label").eq("package_id", packageId);
  if (error) return [];
  return ((data ?? []) as RawRow[]).map((r) => ({
    limitCode: (asString(r.limit_code) ?? "") as LimitKey,
    value: typeof r.value === "number" ? r.value : Number(r.value ?? 0),
    label: asString(r.label),
  }));
}

// ─── Organization subscription queries ─────────────────────────────────────

/**
 * Returns the organization's current subscription row (the single row
 * guaranteed by the unique constraint on organization_id), or null.
 */
export async function getOrganizationCurrentSubscription(
  organizationId: string,
): Promise<SubscriptionSummary | null> {
  const s = await client();
  const { data, error } = await s
    .from("organization_subscriptions")
    .select(
      "id, organization_id, package_id, status, started_at, expires_at, trial_ends_at, cancelled_at, replaced_at, scheduled_start_date, billing_period, auto_renew",
    )
    .eq("organization_id", organizationId);
  if (error) return null;
  const row = ((data ?? []) as RawRow[])[0];
  if (!row) return null;
  return {
    id: asString(row.id) ?? "",
    organizationId: asString(row.organization_id) ?? "",
    packageId: asString(row.package_id) ?? "",
    status: (asString(row.status) ?? "active") as SubscriptionStatus,
    startedAt: asString(row.started_at) ?? "",
    expiresAt: asString(row.expires_at),
    trialEndsAt: asString(row.trial_ends_at),
    cancelledAt: asString(row.cancelled_at),
    replacedAt: asString(row.replaced_at),
    scheduledStartDate: asString(row.scheduled_start_date),
    billingPeriod: asString(row.billing_period),
    autoRenew: row.auto_renew !== false,
  };
}

/**
 * Returns the package the organization is currently subscribed to, or null.
 */
export async function getOrganizationPurchasedPackage(
  organizationId: string,
): Promise<PackageSummary | null> {
  const sub = await getOrganizationCurrentSubscription(organizationId);
  if (!sub) return null;
  if (!ACTIVE_ENTITLEMENT_STATUSES.includes(sub.status)) return null;
  const s = await client();
  const { data, error } = await s
    .from("packages")
    .select("id, name, slug, description, is_active, sort_order, trial_days")
    .eq("id", sub.packageId);
  if (error) return null;
  const row = ((data ?? []) as RawRow[])[0];
  if (!row) return null;
  return {
    id: asString(row.id) ?? "",
    name: asString(row.name) ?? "",
    slug: asString(row.slug) ?? "",
    description: asString(row.description),
    isActive: row.is_active !== false,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    trialDays: typeof row.trial_days === "number" ? row.trial_days : 0,
  };
}

/**
 * Combined resolver: returns the active subscription together with its
 * package's enabled feature keys and limits. This is the canonical
 * "what is this organization entitled to" lookup.
 *
 * Returns null if there is no active/trial subscription, or the package
 * cannot be resolved.
 */
export async function getSubscriptionWithPackageFeatures(
  organizationId: string,
): Promise<SubscriptionWithPackageFeatures | null> {
  const sub = await getOrganizationCurrentSubscription(organizationId);
  if (!sub) return null;
  if (!ACTIVE_ENTITLEMENT_STATUSES.includes(sub.status)) return null;

  // Trial expiry guard: a trial past its end date grants no entitlements.
  if (sub.status === "trial" && sub.trialEndsAt) {
    if (new Date(sub.trialEndsAt).getTime() < Date.now()) return null;
  }

  const s = await client();
  const { data: pkgRows, error: pkgErr } = await s
    .from("packages")
    .select("id, name, slug, description, is_active, sort_order, trial_days")
    .eq("id", sub.packageId);
  if (pkgErr || !pkgRows) return null;
  const pkgRow = (pkgRows as RawRow[])[0];
  if (!pkgRow) return null;

  const [features, limitsMap] = await Promise.all([
    getPackageFeatures(sub.packageId),
    getPackageLimits(sub.packageId),
  ]);

  const pkg: PackageSummary = {
    id: asString(pkgRow.id) ?? "",
    name: asString(pkgRow.name) ?? "",
    slug: asString(pkgRow.slug) ?? "",
    description: asString(pkgRow.description),
    isActive: pkgRow.is_active !== false,
    sortOrder: typeof pkgRow.sort_order === "number" ? pkgRow.sort_order : 0,
    trialDays: typeof pkgRow.trial_days === "number" ? pkgRow.trial_days : 0,
  };

  return {
    subscription: sub,
    package: pkg,
    features,
    limits: limitsMap as Record<LimitKey, number>,
  };
}

// ─── Entitlement snapshot sync (reuses existing service) ───────────────────
// Delegated to features/subscription/entitlement-sync-service.ts which already
// populates organization_entitlements + organization_usage_limits. Re-exported
// here so callers have one import path.

export { syncOrganizationEntitlements, syncOrganizationUsageLimits } from "@/features/subscription/entitlement-sync-service";

// ─── Admin-only: full package entitlement read (super-admin use) ───────────

/**
 * Returns features + limits + pricing for a package. Uses the admin client
 * (service role) — only call from super-admin server actions.
 */
export async function getPackageEntitlementsAdmin(packageId: string): Promise<{
  features: FeatureKey[];
  limits: Record<string, number>;
  pricing: Record<string, number>;
}> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Database connection failed.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as any;

  const [featRes, limitRes, priceRes] = await Promise.all([
    a.from("package_features").select("feature_code, value").eq("package_id", packageId),
    a.from("package_limits").select("limit_code, value").eq("package_id", packageId),
    a.from("package_pricing").select("billing_period, price, is_active").eq("package_id", packageId),
  ]);

  const features: FeatureKey[] = [];
  for (const r of (featRes.data ?? []) as RawRow[]) {
    if (asBool(r.value)) features.push((asString(r.feature_code) ?? "") as FeatureKey);
  }
  const limits: Record<string, number> = {};
  for (const r of (limitRes.data ?? []) as RawRow[]) {
    const code = asString(r.limit_code);
    if (code) limits[code] = typeof r.value === "number" ? r.value : Number(r.value ?? 0);
  }
  const pricing: Record<string, number> = {};
  for (const r of (priceRes.data ?? []) as RawRow[]) {
    if (r.is_active !== false) {
      const bp = asString(r.billing_period);
      if (bp) pricing[bp] = typeof r.price === "number" ? r.price : Number(r.price ?? 0);
    }
  }
  return { features, limits, pricing };
}
