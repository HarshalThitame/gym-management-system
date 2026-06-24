"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Trash2, ShieldCheck, Activity } from "lucide-react";
import type { IntegrityResult } from "@/features/entitlement/feature-key-validator";
import type { EntitlementHealthReport } from "@/features/super-admin/services/entitlement-health-service";
import { syncAllOrganizationEntitlements, cleanupStaleEntitlements } from "@/features/super-admin/actions/entitlement-sync-actions";

function StatusBadge({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border ${
      passed
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-red-50 text-red-700 border-red-200"
    }`}>
      {passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      {label}
    </div>
  );
}

export function FeatureAuditIntegritySection({
  integrity,
  healthReport,
}: {
  integrity: IntegrityResult;
  healthReport: EntitlementHealthReport;
}) {
  const [syncPending, startSync] = useTransition();
  const [cleanupPending, startCleanup] = useTransition();
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6 border-t">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Runtime Integrity Checks</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Validates that all feature keys across the codebase and database are consistent. Last run: {new Date(integrity.timestamp).toLocaleString()}.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <StatusBadge
            passed={integrity.valid}
            label={integrity.valid ? "All Checks Passed" : "Issues Found"}
          />
        </div>

        {integrity.errors.length > 0 && (
          <div className="border border-red-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-red-50 px-4 py-2 border-b border-red-200">
              <span className="text-sm font-semibold text-red-700">
                {integrity.errors.length} issue{integrity.errors.length !== 1 ? "s" : ""} found
              </span>
            </div>
            <div className="divide-y divide-red-100">
              {integrity.errors.map((err, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-red-800">{err.key}</div>
                    <div className="text-xs text-red-600">{err.detail}</div>
                    <div className="text-xs text-red-400 mt-0.5">{err.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {integrity.errors.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">
              All integrity checks passed — feature keys are consistent across the codebase and database.
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="size-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Entitlement Health Report</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-bold">{healthReport.totalOrgs}</div>
            <div className="text-xs text-muted-foreground">Total Organizations</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-bold text-emerald-600">{healthReport.orgsWithActiveSub}</div>
            <div className="text-xs text-muted-foreground">With Active Subscription</div>
          </div>
          <div className={`rounded-lg border p-3 ${healthReport.orgsWithStaleEntitlements > 0 ? "border-amber-300" : ""}`}>
            <div className={`text-2xl font-bold ${healthReport.orgsWithStaleEntitlements > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {healthReport.orgsWithStaleEntitlements}
            </div>
            <div className="text-xs text-muted-foreground">With Stale Entitlements</div>
          </div>
          <div className={`rounded-lg border p-3 ${healthReport.orgsWithMissingEntitlements > 0 ? "border-amber-300" : ""}`}>
            <div className={`text-2xl font-bold ${healthReport.orgsWithMissingEntitlements > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {healthReport.orgsWithMissingEntitlements}
            </div>
            <div className="text-xs text-muted-foreground">With Missing Entitlements</div>
          </div>
        </div>

        {healthReport.staleFeaturesPerOrg.length > 0 && (
          <div className="border border-amber-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
              <span className="text-sm font-semibold text-amber-700">
                Stale Entitlements Detail
              </span>
            </div>
            <div className="divide-y divide-amber-100 max-h-60 overflow-y-auto">
              {healthReport.staleFeaturesPerOrg.map((org) => (
                <div key={org.orgId} className="px-4 py-2">
                  <div className="text-sm font-medium">{org.orgName || org.orgId}</div>
                  <div className="text-xs text-amber-600 font-mono mt-0.5">
                    {org.staleFeatureCodes.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold tracking-tight mb-3">Sync & Cleanup Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={syncPending}
            onClick={() => {
              startSync(async () => {
                const result = await syncAllOrganizationEntitlements(null);
                setSyncResult(
                  result.success
                    ? `Synced ${result.synced} org${result.synced !== 1 ? "s" : ""} successfully.`
                    : `Synced ${result.synced}, failed ${result.failed}. ${result.errors.slice(0, 3).join("; ")}`
                );
              });
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`size-4 ${syncPending ? "animate-spin" : ""}`} />
            Sync All Organization Entitlements
          </button>

          <button
            disabled={cleanupPending}
            onClick={() => {
              startCleanup(async () => {
                const result = await cleanupStaleEntitlements(null);
                setCleanupResult(
                  `Cleaned up ${result.deletedEntitlements} stale entitlement${result.deletedEntitlements !== 1 ? "s" : ""} and ${result.deletedLimits} stale limit${result.deletedLimits !== 1 ? "s" : ""}.`
                );
              });
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <Trash2 className={`size-4 ${cleanupPending ? "animate-spin" : ""}`} />
            Cleanup Stale Entitlements
          </button>
        </div>

        {syncResult && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {syncResult}
          </div>
        )}
        {cleanupResult && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {cleanupResult}
          </div>
        )}
      </div>

      {healthReport.lastSyncTimestamps.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Last Sync Timestamps</h3>
          <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-2 font-semibold">Organization</th>
                  <th className="text-left p-2 font-semibold">Entitlements Synced</th>
                  <th className="text-left p-2 font-semibold">Limits Synced</th>
                </tr>
              </thead>
              <tbody>
                {healthReport.lastSyncTimestamps
                  .filter((ts) => ts.entitlementsSyncedAt || ts.limitsSyncedAt)
                  .map((ts) => (
                    <tr key={ts.orgId} className="border-b hover:bg-muted/30">
                      <td className="p-2">{ts.orgName || ts.orgId}</td>
                      <td className="p-2 text-muted-foreground text-xs">
                        {ts.entitlementsSyncedAt ? new Date(ts.entitlementsSyncedAt).toLocaleString() : "-"}
                      </td>
                      <td className="p-2 text-muted-foreground text-xs">
                        {ts.limitsSyncedAt ? new Date(ts.limitsSyncedAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
