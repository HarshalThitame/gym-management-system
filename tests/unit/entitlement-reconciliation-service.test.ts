import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const syncOrganizationEntitlementsMock = vi.hoisted(() => vi.fn());
const syncOrganizationUsageLimitsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

vi.mock("@/features/subscription/entitlement-sync-service", () => ({
  syncOrganizationEntitlements: syncOrganizationEntitlementsMock,
  syncOrganizationUsageLimits: syncOrganizationUsageLimitsMock,
}));

import {
  applyEntitlementReconciliation,
  buildEntitlementReconciliationPreview,
  listEntitlementReconciliationRuns,
} from "@/features/super-admin/services/entitlement-reconciliation-service";

function makeQuery(rows: Array<Record<string, unknown>>) {
  let current = rows.slice();
  const query: any = {
    in(column: string, values: string[]) {
      current = current.filter((row) => values.includes(String(row[column] ?? "")));
      return query;
    },
    eq(column: string, value: unknown) {
      current = current.filter((row) => String(row[column] ?? "") === String(value ?? ""));
      return Promise.resolve({ data: current.slice(), error: null });
    },
    then(resolve: (value: { data: Array<Record<string, unknown>> | null; error: { message: string } | null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: current.slice(), error: null }).then(resolve, reject);
    },
  };
  return query;
}

describe("entitlement reconciliation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSupabaseAdminClientMock.mockReturnValue({
      from(table: string) {
        if (table === "organization_subscriptions") {
          return {
            select() {
              return makeQuery([
                {
                  organization_id: "org-1",
                  package_id: "pkg-1",
                  packages: { name: "Enterprise" },
                  organizations: { name: "Alpha Gym" },
                  status: "active",
                },
              ]);
            },
          };
        }
        if (table === "package_features") {
          return {
            select() {
              return makeQuery([
                { package_id: "pkg-1", feature_code: "audit_logs" },
                { package_id: "pkg-1", feature_code: "advanced_rbac" },
              ]);
            },
          };
        }
        if (table === "package_limits") {
          return {
            select() {
              return makeQuery([
                { package_id: "pkg-1", limit_code: "api_calls" },
              ]);
            },
          };
        }
        if (table === "organization_entitlements") {
          return {
            select() {
              return makeQuery([
                { organization_id: "org-1", feature_code: "audit_logs" },
                { organization_id: "org-1", feature_code: "legacy_feature" },
              ]);
            },
          };
        }
        if (table === "organization_usage_limits") {
          return {
            select() {
              return makeQuery([
                { organization_id: "org-1", limit_code: "old_limit" },
              ]);
            },
          };
        }
        if (table === "entitlement_reconciliation_runs") {
          return {
            select() {
              return makeQuery([
                {
                  id: "run-1",
                  scope_type: "all",
                  scope_id: null,
                  mode: "preview",
                  status: "completed",
                  requested_by: null,
                  completed_by: null,
                  preview_summary: { orgCount: 1, orgsWithDiffs: 1, missingEntitlementCount: 1, staleEntitlementCount: 1, missingLimitCount: 1, staleLimitCount: 1 },
                  applied_summary: { orgCount: 1, orgsWithDiffs: 1, missingEntitlementCount: 1, staleEntitlementCount: 1, missingLimitCount: 1, staleLimitCount: 1 },
                  differences: [],
                  error_message: null,
                  started_at: "2026-07-07T10:00:00.000Z",
                  completed_at: "2026-07-07T10:00:00.000Z",
                },
              ]);
            },
            insert(row: Record<string, unknown>) {
              return Promise.resolve({ data: [{ id: row.id ?? "run-new" }], error: null });
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    syncOrganizationEntitlementsMock.mockResolvedValue({ ok: true });
    syncOrganizationUsageLimitsMock.mockResolvedValue({ ok: true });
  });

  it("builds a reconciliation preview with stale and missing diffs", async () => {
    const result = await buildEntitlementReconciliationPreview({ scopeType: "all", scopeId: null });

    expect(result.summary.orgCount).toBe(1);
    expect(result.summary.orgsWithDiffs).toBe(1);
    expect(result.summary.missingEntitlementCount).toBe(1);
    expect(result.summary.staleEntitlementCount).toBe(1);
    expect(result.summary.missingLimitCount).toBe(1);
    expect(result.summary.staleLimitCount).toBe(1);
    expect(result.differences[0]?.missingEntitlements).toEqual(["advanced_rbac"]);
    expect(result.differences[0]?.staleEntitlements).toEqual(["legacy_feature"]);
  });

  it("applies reconciliation by syncing org entitlements and limits", async () => {
    const result = await applyEntitlementReconciliation({ scopeType: "organization", scopeId: "org-1" }, "user-1");

    expect(syncOrganizationEntitlementsMock).toHaveBeenCalledWith("org-1", "Entitlement reconciliation apply");
    expect(syncOrganizationUsageLimitsMock).toHaveBeenCalledWith("org-1", "Entitlement reconciliation apply");
    expect(result.summary.orgCount).toBe(1);
    expect(result.differences[0]?.organizationId).toBe("org-1");
  });

  it("lists reconciliation runs newest first", async () => {
    const runs = await listEntitlementReconciliationRuns(5);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe("run-1");
  });
});
