"use client";

import { useActionState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { FormMessage } from "@/features/auth/components/form-message";
import { showToast } from "@/components/ui/toast";
import {
  applyEntitlementReconciliationAction,
  previewEntitlementReconciliationAction,
} from "../actions/entitlement-reconciliation-actions";
import type { ReconciliationRunRecord, ReconciliationSummary, ReconciliationOrgDiff } from "../services/entitlement-reconciliation-service";

type ReconciliationState = {
  status?: "success" | "error";
  message?: string;
  runId?: string;
  summary?: ReconciliationSummary;
  differences?: ReconciliationOrgDiff[];
  fieldErrors?: Record<string, string[]>;
};

function statLabel(summary: ReconciliationSummary | undefined, key: keyof ReconciliationSummary) {
  return summary ? String(summary[key] ?? 0) : "0";
}

export function EntitlementReconciliationSection({ runs }: { runs: ReconciliationRunRecord[] }) {
  const [previewState, previewAction] = useActionState<ReconciliationState, FormData>(previewEntitlementReconciliationAction, { status: "idle", message: "" });
  const [applyState, applyAction] = useActionState<ReconciliationState, FormData>(applyEntitlementReconciliationAction, { status: "idle", message: "" });

  useEffect(() => {
    if (previewState.status === "success" && previewState.message) {
      showToast(previewState.message, "success");
    }
  }, [previewState.status, previewState.message]);

  useEffect(() => {
    if (applyState.status === "success" && applyState.message) {
      showToast(applyState.message, "success");
    }
  }, [applyState.status, applyState.message]);

  const latestRun = runs[0] ?? null;
  const latestSummary = latestRun?.mode === "apply" ? latestRun.appliedSummary : latestRun?.previewSummary;

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-black">Entitlement Reconciliation</h2>
          <p className="text-sm text-muted-foreground">Preview and repair stale or missing org entitlements against the active package source of truth.</p>
        </div>
      </div>

      {latestSummary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Orgs" value={latestSummary.orgCount} />
          <StatCard label="Orgs with diffs" value={latestSummary.orgsWithDiffs} />
          <StatCard label="Missing entitlements" value={latestSummary.missingEntitlementCount} />
          <StatCard label="Stale entitlements" value={latestSummary.staleEntitlementCount} />
          <StatCard label="Missing limits" value={latestSummary.missingLimitCount} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={previewAction} className="space-y-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <h3 className="font-black">Preview reconciliation</h3>
          </div>
          <ScopeFields />
          <FormMessage state={previewState as never} />
          <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-bold hover:bg-surface-muted" type="submit">
            <RefreshCw className="size-4" />
            Run preview
          </button>
          {previewState.status === "success" && previewState.summary && (
            <ResultBlock title="Preview result" summary={previewState.summary} differences={previewState.differences ?? []} />
          )}
        </form>

        <form action={applyAction} className="space-y-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <h3 className="font-black">Apply reconciliation</h3>
          </div>
          <ScopeFields />
          <p className="text-xs font-semibold text-muted-foreground">Apply uses the same scope as preview. It rewrites org entitlements and usage limits to match the package source of truth.</p>
          <FormMessage state={applyState as never} />
          <button className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100" type="submit">
            <CheckCircle2 className="size-4" />
            Apply changes
          </button>
          {applyState.status === "success" && applyState.summary && (
            <ResultBlock title="Apply result" summary={applyState.summary} differences={applyState.differences ?? []} />
          )}
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground">Recent runs</h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Scope</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Diffs</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={5}>No reconciliation runs yet.</td></tr>
              ) : runs.map((run) => (
                <tr key={run.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs font-semibold">{run.scopeType === "organization" ? run.scopeId ?? "organization" : "all organizations"}</td>
                  <td className="px-4 py-3 text-xs font-semibold">{run.mode}</td>
                  <td className="px-4 py-3 text-xs font-semibold">{run.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{run.appliedSummary.orgsWithDiffs ?? run.previewSummary.orgsWithDiffs} org(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScopeFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Scope type</span>
        <select name="scopeType" className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold">
          <option value="all">All organizations</option>
          <option value="organization">Single organization</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Organization ID</span>
        <input name="scopeId" placeholder="Optional organization UUID" className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold" />
      </label>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function ResultBlock({ title, summary, differences }: { title: string; summary: ReconciliationSummary; differences: ReconciliationOrgDiff[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p className="text-xs font-semibold">Orgs with diffs: {summary.orgsWithDiffs}</p>
        <p className="text-xs font-semibold">Missing entitlements: {summary.missingEntitlementCount}</p>
        <p className="text-xs font-semibold">Stale entitlements: {summary.staleEntitlementCount}</p>
        <p className="text-xs font-semibold">Missing limits: {summary.missingLimitCount}</p>
      </div>
      {differences.length > 0 && (
        <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
          {differences.slice(0, 5).map((diff) => (
            <div key={diff.organizationId} className="rounded-md border border-border bg-background p-3 text-xs">
              <p className="font-bold">{diff.organizationName}</p>
              <p className="text-muted-foreground">
                {diff.missingEntitlements.length} missing entitlements · {diff.staleEntitlements.length} stale entitlements · {diff.missingLimits.length} missing limits
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
