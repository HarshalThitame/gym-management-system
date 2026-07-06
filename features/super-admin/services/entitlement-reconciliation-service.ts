import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncOrganizationEntitlements, syncOrganizationUsageLimits } from "@/features/subscription/entitlement-sync-service";

type RawRow = Record<string, unknown>;
type DbResult = { data: RawRow[] | null; error: { message: string } | null };

type ScopeType = "all" | "organization";
type RunMode = "preview" | "apply";
type RunStatus = "running" | "completed" | "failed";

export type EntitlementReconciliationScope = {
  scopeType: ScopeType;
  scopeId: string | null;
};

export type ReconciliationOrgDiff = {
  organizationId: string;
  organizationName: string;
  packageId: string;
  packageName: string;
  missingEntitlements: string[];
  staleEntitlements: string[];
  missingLimits: string[];
  staleLimits: string[];
};

export type ReconciliationSummary = {
  orgCount: number;
  orgsWithDiffs: number;
  missingEntitlementCount: number;
  staleEntitlementCount: number;
  missingLimitCount: number;
  staleLimitCount: number;
};

export type ReconciliationRunRecord = {
  id: string;
  scopeType: ScopeType;
  scopeId: string | null;
  mode: RunMode;
  status: RunStatus;
  requestedBy: string | null;
  completedBy: string | null;
  previewSummary: ReconciliationSummary;
  appliedSummary: ReconciliationSummary;
  differences: ReconciliationOrgDiff[];
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type ReconciliationResult = {
  summary: ReconciliationSummary;
  differences: ReconciliationOrgDiff[];
  runId: string;
};

function db() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Database connection failed.");
  return client as unknown as {
    from(table: string): {
      select(columns: string): { in(column: string, values: string[]): Promise<DbResult>; eq(column: string, value: unknown): Promise<DbResult> };
      insert(row: RawRow): Promise<DbResult>;
      update(row: RawRow): { eq(column: string, value: unknown): Promise<DbResult> };
      delete(): { eq(column: string, value: unknown): Promise<DbResult> };
    };
  };
}

async function getActiveSubscriptions(scope: EntitlementReconciliationScope) {
  const client = db();
  const base = client
    .from("organization_subscriptions")
    .select("organization_id, package_id, packages:package_id(id, name), organizations:organization_id(id, name)")
    .in("status", ["active", "trial"]);

  const { data, error } = scope.scopeType === "organization" && scope.scopeId
    ? await base.eq("organization_id", scope.scopeId)
    : await base;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const orgId = String(row.organization_id ?? "");
    const pkgId = String(row.package_id ?? "");
    return {
      organizationId: orgId,
      organizationName: String((row.organizations as RawRow | undefined)?.name ?? ""),
      packageId: pkgId,
      packageName: String((row.packages as RawRow | undefined)?.name ?? ""),
    };
  }).filter((row) => row.organizationId && row.packageId);
}

async function loadPackageFeatures(packageIds: string[]) {
  if (packageIds.length === 0) return new Map<string, Set<string>>();
  const { data, error } = await db()
    .from("package_features")
    .select("package_id, feature_code")
    .in("package_id", packageIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const pkgId = String(row.package_id ?? "");
    const code = String(row.feature_code ?? "");
    if (!pkgId || !code) continue;
    if (!map.has(pkgId)) map.set(pkgId, new Set());
    map.get(pkgId)!.add(code);
  }
  return map;
}

async function loadPackageLimits(packageIds: string[]) {
  if (packageIds.length === 0) return new Map<string, Set<string>>();
  const { data, error } = await db()
    .from("package_limits")
    .select("package_id, limit_code")
    .in("package_id", packageIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const pkgId = String(row.package_id ?? "");
    const code = String(row.limit_code ?? "");
    if (!pkgId || !code) continue;
    if (!map.has(pkgId)) map.set(pkgId, new Set());
    map.get(pkgId)!.add(code);
  }
  return map;
}

async function loadOrganizationEntitlements(orgIds: string[]) {
  if (orgIds.length === 0) return new Map<string, Set<string>>();
  const { data, error } = await db()
    .from("organization_entitlements")
    .select("organization_id, feature_code")
    .in("organization_id", orgIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const orgId = String(row.organization_id ?? "");
    const code = String(row.feature_code ?? "");
    if (!orgId || !code) continue;
    if (!map.has(orgId)) map.set(orgId, new Set());
    map.get(orgId)!.add(code);
  }
  return map;
}

async function loadOrganizationLimits(orgIds: string[]) {
  if (orgIds.length === 0) return new Map<string, Set<string>>();
  const { data, error } = await db()
    .from("organization_usage_limits")
    .select("organization_id, limit_code")
    .in("organization_id", orgIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const orgId = String(row.organization_id ?? "");
    const code = String(row.limit_code ?? "");
    if (!orgId || !code) continue;
    if (!map.has(orgId)) map.set(orgId, new Set());
    map.get(orgId)!.add(code);
  }
  return map;
}

function diffForOrg(
  org: { organizationId: string; organizationName: string; packageId: string; packageName: string },
  packageFeatures: Map<string, Set<string>>,
  packageLimits: Map<string, Set<string>>,
  orgEntitlements: Map<string, Set<string>>,
  orgLimits: Map<string, Set<string>>,
): ReconciliationOrgDiff {
  const pkgFeatures = packageFeatures.get(org.packageId) ?? new Set<string>();
  const pkgLimits = packageLimits.get(org.packageId) ?? new Set<string>();
  const currentEntitlements = orgEntitlements.get(org.organizationId) ?? new Set<string>();
  const currentLimits = orgLimits.get(org.organizationId) ?? new Set<string>();

  return {
    organizationId: org.organizationId,
    organizationName: org.organizationName || org.organizationId,
    packageId: org.packageId,
    packageName: org.packageName || org.packageId,
    missingEntitlements: [...pkgFeatures].filter((feature) => !currentEntitlements.has(feature)).sort(),
    staleEntitlements: [...currentEntitlements].filter((feature) => !pkgFeatures.has(feature)).sort(),
    missingLimits: [...pkgLimits].filter((limit) => !currentLimits.has(limit)).sort(),
    staleLimits: [...currentLimits].filter((limit) => !pkgLimits.has(limit)).sort(),
  };
}

function summarize(differences: ReconciliationOrgDiff[]): ReconciliationSummary {
  return {
    orgCount: differences.length,
    orgsWithDiffs: differences.filter((d) => d.missingEntitlements.length || d.staleEntitlements.length || d.missingLimits.length || d.staleLimits.length).length,
    missingEntitlementCount: differences.reduce((sum, d) => sum + d.missingEntitlements.length, 0),
    staleEntitlementCount: differences.reduce((sum, d) => sum + d.staleEntitlements.length, 0),
    missingLimitCount: differences.reduce((sum, d) => sum + d.missingLimits.length, 0),
    staleLimitCount: differences.reduce((sum, d) => sum + d.staleLimits.length, 0),
  };
}

async function persistRun(input: {
  scope: EntitlementReconciliationScope;
  mode: RunMode;
  status: RunStatus;
  requestedBy: string | null;
  completedBy: string | null;
  previewSummary: ReconciliationSummary;
  appliedSummary: ReconciliationSummary;
  differences: ReconciliationOrgDiff[];
  errorMessage?: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("entitlement_reconciliation_runs")
    .insert({
      id,
      scope_type: input.scope.scopeType,
      scope_id: input.scope.scopeId,
      mode: input.mode,
      status: input.status,
      requested_by: input.requestedBy,
      completed_by: input.completedBy,
      preview_summary: input.previewSummary as never,
      applied_summary: input.appliedSummary as never,
      differences: input.differences as never,
      error_message: input.errorMessage ?? null,
      started_at: now,
      completed_at: input.status === "running" ? null : now,
    })
    ;

  if (error) throw new Error(error.message);
  return id;
}

export async function buildEntitlementReconciliationPreview(scope: EntitlementReconciliationScope): Promise<ReconciliationResult> {
  const subscriptions = await getActiveSubscriptions(scope);
  const packageIds = [...new Set(subscriptions.map((s) => s.packageId))];
  const orgIds = subscriptions.map((s) => s.organizationId);
  const [packageFeatures, packageLimits, orgEntitlements, orgLimits] = await Promise.all([
    loadPackageFeatures(packageIds),
    loadPackageLimits(packageIds),
    loadOrganizationEntitlements(orgIds),
    loadOrganizationLimits(orgIds),
  ]);

  const differences = subscriptions.map((sub) => diffForOrg(sub, packageFeatures, packageLimits, orgEntitlements, orgLimits));
  const summary = summarize(differences);
  const runId = await persistRun({
    scope,
    mode: "preview",
    status: "completed",
    requestedBy: null,
    completedBy: null,
    previewSummary: summary,
    appliedSummary: summary,
    differences,
  });

  return { summary, differences, runId };
}

export async function applyEntitlementReconciliation(scope: EntitlementReconciliationScope, actorId: string | null = null): Promise<ReconciliationResult> {
  const preview = await buildEntitlementReconciliationPreview(scope);
  const subscriptions = await getActiveSubscriptions(scope);
  const results: ReconciliationOrgDiff[] = [];

  for (const sub of subscriptions) {
    const entRes = await syncOrganizationEntitlements(sub.organizationId, "Entitlement reconciliation apply");
    if (!entRes.ok) throw new Error(entRes.error);
    const limRes = await syncOrganizationUsageLimits(sub.organizationId, "Entitlement reconciliation apply");
    if (!limRes.ok) throw new Error(limRes.error);
    results.push(preview.differences.find((diff) => diff.organizationId === sub.organizationId) ?? {
      organizationId: sub.organizationId,
      organizationName: sub.organizationName,
      packageId: sub.packageId,
      packageName: sub.packageName,
      missingEntitlements: [],
      staleEntitlements: [],
      missingLimits: [],
      staleLimits: [],
    });
  }

  const appliedSummary = summarize(results);
  const runId = await persistRun({
    scope,
    mode: "apply",
    status: "completed",
    requestedBy: actorId,
    completedBy: actorId,
    previewSummary: preview.summary,
    appliedSummary,
    differences: results,
  });

  return { summary: appliedSummary, differences: results, runId };
}

export async function listEntitlementReconciliationRuns(limit = 10): Promise<ReconciliationRunRecord[]> {
  const { data, error } = await db()
    .from("entitlement_reconciliation_runs")
    .select("id, scope_type, scope_id, mode, status, requested_by, completed_by, preview_summary, applied_summary, differences, error_message, started_at, completed_at")
    .in("status", ["running", "completed", "failed"]);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .sort((a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")))
    .slice(0, limit)
    .map((row) => ({
    id: String(row.id),
    scopeType: (row.scope_type as ScopeType) ?? "all",
    scopeId: row.scope_id ? String(row.scope_id) : null,
    mode: (row.mode as RunMode) ?? "preview",
    status: (row.status as RunStatus) ?? "completed",
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    previewSummary: row.preview_summary as ReconciliationSummary,
    appliedSummary: row.applied_summary as ReconciliationSummary,
    differences: (row.differences as ReconciliationOrgDiff[]) ?? [],
    errorMessage: row.error_message ? String(row.error_message) : null,
    startedAt: String(row.started_at ?? ""),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }));
}
