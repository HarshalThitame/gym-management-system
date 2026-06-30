"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, Download, Edit2, Eye, Plus, Power, PowerOff, Settings, Trash2, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { useHasFeature } from "@/features/organization-owner/entitlements/entitlement-provider";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { showToast } from "@/components/ui/toast";
import { formatCurrency, formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import {
  getSplitRules,
  createSplitRule,
  updateSplitRule,
  deleteSplitRule,
  toggleSplitRule,
  getSplitLogs,
  getBranchRevenueReport,
  type SplitRule,
  type SplitLog,
  type BranchRevenueReport,
} from "@/features/organization-owner/actions/revenue-split-actions";
import { GenericConfirmDialog } from "@/features/organization-owner/components/modules/GenericConfirmDialog";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";

type Props = { dashboard: OrganizationOwnerDashboard };

const CHART_COLORS = ["#16a34a", "#f59e0b", "#dc2626", "#6b7280", "#0891b2", "#8b5cf6"];

export function RevenueSplitPanel({ dashboard }: Props) {
  const hasFeature = useHasFeature("branch_revenue_split");
  const [activeTab, setActiveTab] = useState<"rules" | "reports" | "logs">("rules");

  if (!hasFeature) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-bold text-muted-foreground">Branch Revenue Split is available on the Enterprise plan.</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Upgrade to access revenue splitting across branches.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
        <button
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${activeTab === "rules" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("rules")} type="button"
        >
          Rules
        </button>
        <button
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${activeTab === "reports" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("reports")} type="button"
        >
          Reports
        </button>
        <button
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${activeTab === "logs" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("logs")} type="button"
        >
          Logs
        </button>
      </div>

      {activeTab === "rules" && <SplitRulesTab dashboard={dashboard} />}
      {activeTab === "reports" && <SplitReportsTab dashboard={dashboard} />}
      {activeTab === "logs" && <SplitLogsTab dashboard={dashboard} />}
    </div>
  );
}

function SplitRulesTab({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const [rules, setRules] = useState<SplitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRule, setEditRule] = useState<SplitRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ ruleId: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSplitRules(dashboard.organization.id);
      setRules(data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [dashboard.organization.id]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSplitRule(dashboard.organization.id, pendingDelete.ruleId);
      setSuccessAction({ action: "deleted", title: "Split Rule Deleted!", itemName: pendingDelete.name });
      loadRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete split rule", "error");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, dashboard.organization.id, loadRules, setSuccessAction]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const branches = useMemo(() =>
    dashboard.branches.map((b) => ({ id: b.id, name: b.name })),
    [dashboard.branches]
  );

  const activeRules = rules.filter((r) => r.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Split Rules</p>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold">{activeRules.length} active / {rules.length} total</span>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          onClick={() => { setEditRule(null); setShowForm(true); }} type="button"
        >
          <Plus className="size-3.5" /> Add Split Rule
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading rules...</p>
      ) : rules.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No split rules configured yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="px-4 py-3 font-black">Rule Name</th>
                <th className="px-4 py-3 font-black">Source Branch</th>
                <th className="px-4 py-3 font-black">Target Branch</th>
                <th className="px-4 py-3 font-black">Split %</th>
                <th className="px-4 py-3 font-black">Status</th>
                <th className="px-4 py-3 font-black">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const sourceName = branches.find((b) => b.id === rule.source_branch_id)?.name ?? "—";
                const targetName = branches.find((b) => b.id === rule.target_branch_id)?.name ?? "—";
                return (
                  <tr key={rule.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-bold">{rule.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sourceName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{targetName}</td>
                    <td className="px-4 py-3 font-bold">{Number(rule.split_percentage).toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <EnterpriseStatusBadge status={rule.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded p-1 hover:bg-surface-muted"
                          onClick={async () => {
                            await toggleSplitRule(dashboard.organization.id, rule.id, !rule.is_active);
                            loadRules();
                          }}
                          title={rule.is_active ? "Deactivate" : "Activate"}
                          type="button"
                        >
                          {rule.is_active ? <PowerOff className="size-3.5 text-muted-foreground" /> : <Power className="size-3.5 text-accent" />}
                        </button>
                        <button className="rounded p-1 hover:bg-surface-muted" onClick={() => { setEditRule(rule); setShowForm(true); }} title="Edit" type="button">
                          <Edit2 className="size-3.5 text-muted-foreground" />
                        </button>
                        <button
                          className="rounded p-1 hover:bg-surface-muted"
                          onClick={() => setPendingDelete({ ruleId: rule.id, name: rule.name })}
                          title="Delete" type="button"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <SplitRuleForm
          dashboard={dashboard}
          rule={editRule}
          onClose={() => setShowForm(false)}
          onSaved={(name) => {
            setShowForm(false);
            loadRules();
            setSuccessAction({ action: editRule ? "updated" : "created", title: editRule ? "Split Rule Updated!" : "Split Rule Created!", itemName: name });
          }}
        />
      )}
      <GenericConfirmDialog
        open={!!pendingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        title="Delete Split Rule?"
        itemName={pendingDelete?.name ?? ""}
        warning="This action cannot be undone."
        loading={deleting}
      />
      <GenericSuccessDialog
        action={successAction?.action ?? "created"}
        itemName={successAction?.itemName ?? ""}
        onClose={() => setSuccessAction(null)}
        open={successAction !== null}
        title={successAction?.title ?? ""}
      />
    </div>
  );
}

function SplitRuleForm({
  dashboard,
  rule,
  onClose,
  onSaved,
}: {
  dashboard: OrganizationOwnerDashboard;
  rule: SplitRule | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [sourceBranchId, setSourceBranchId] = useState(rule?.source_branch_id ?? "");
  const [targetBranchId, setTargetBranchId] = useState(rule?.target_branch_id ?? "");
  const [splitPercentage, setSplitPercentage] = useState(rule ? Number(rule.split_percentage) : 50);
  const [description, setDescription] = useState(rule?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branches = useMemo(() =>
    dashboard.branches.map((b) => ({ id: b.id, name: b.name })),
    [dashboard.branches]
  );

  const targetBranches = useMemo(() =>
    branches.filter((b) => b.id !== sourceBranchId),
    [branches, sourceBranchId]
  );

  const sourceName = branches.find((b) => b.id === sourceBranchId)?.name ?? "?";
  const targetName = branches.find((b) => b.id === targetBranchId)?.name ?? "?";

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError("Rule name is required."); return; }
    if (!sourceBranchId) { setError("Select a source branch."); return; }
    if (!targetBranchId) { setError("Select a target branch."); return; }
    if (sourceBranchId === targetBranchId) { setError("Source and target must be different branches."); return; }

    setSaving(true);
    try {
      if (rule) {
        const updateData: { name: string; splitPercentage: number; description?: string } = {
          name: name.trim(),
          splitPercentage,
        };
        const desc = description.trim();
        if (desc) updateData.description = desc;
        await updateSplitRule(dashboard.organization.id, rule.id, updateData);
      } else {
        const createData: { name: string; sourceBranchId: string; targetBranchId: string; splitPercentage: number; description?: string } = {
          name: name.trim(),
          sourceBranchId,
          targetBranchId,
          splitPercentage,
        };
        const desc = description.trim();
        if (desc) createData.description = desc;
        await createSplitRule(dashboard.organization.id, createData);
      }
      onSaved(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Split rule form">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-black">{rule ? "Edit Split Rule" : "Add Split Rule"}</h2>
          <button className="rounded-md p-1 hover:bg-surface-muted" onClick={onClose} type="button">
            <Eye className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Rule Name</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-bold placeholder:text-muted-foreground/60"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Branch A 30% to Branch B"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Source Branch</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-bold"
                value={sourceBranchId}
                onChange={(e) => { setSourceBranchId(e.target.value); if (e.target.value === targetBranchId) setTargetBranchId(""); }}
              >
                <option value="">Select...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Target Branch</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-bold"
                value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}
              >
                <option value="">Select...</option>
                {targetBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Split Percentage</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="range" min="0" max="100" value={splitPercentage}
                onChange={(e) => setSplitPercentage(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <input
                type="number" min="0" max="100" value={splitPercentage}
                onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 100) setSplitPercentage(v); }}
                className="w-16 rounded-md border border-border bg-surface-muted px-2 py-1.5 text-center text-sm font-bold"
              />
              <span className="text-sm font-bold">%</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Description</label>
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm placeholder:text-muted-foreground/60"
              rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this rule..."
            />
          </div>

          {sourceBranchId && targetBranchId && sourceBranchId !== targetBranchId && (
            <Card>
              <CardHeader><h3 className="text-sm font-black">Preview</h3></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <span className="font-bold">{sourceName}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="font-bold text-accent">{splitPercentage}%</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="font-bold">{targetName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {splitPercentage}% of payments recorded at {sourceName} will be attributed to {targetName} for revenue reporting.
                </p>
              </CardContent>
            </Card>
          )}

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">{error}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-4">
          <button className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-bold hover:bg-surface-muted" onClick={onClose} type="button">Cancel</button>
          <button
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSave} disabled={saving} type="button"
          >
            {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SplitReportsTab({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const [report, setReport] = useState<BranchRevenueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadReport = useCallback(async (from?: string, to?: string) => {
    try {
      setLoading(true);
      const data = await getBranchRevenueReport(dashboard.organization.id, from || undefined, to || undefined);
      setReport(data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [dashboard.organization.id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const totalNet = report.reduce((s, r) => s + r.netRevenue, 0);
  const totalSplitIn = report.reduce((s, r) => s + r.splitIn, 0);
  const totalSplitOut = report.reduce((s, r) => s + r.splitOut, 0);

  const chartData = useMemo(() =>
    report.map((r) => ({
      name: r.branchName,
      direct: r.directRevenue,
      splitIn: r.splitIn,
      splitOut: -r.splitOut,
    })),
    [report]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Branch Revenue Report</p>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs" />
          <button
            className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            onClick={() => loadReport(dateFrom, dateTo)} type="button"
          >
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading report...</p>
      ) : report.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No revenue data available.</p>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <StatCard label="Net Revenue" value={formatCurrency(totalNet)} detail="Total after split adjustments" icon={<TrendingUp className="size-5" />} />
            <StatCard label="Split In" value={formatCurrency(totalSplitIn)} detail="Revenue received from other branches" icon={<ArrowRight className="size-5" />} status="watch" />
            <StatCard label="Split Out" value={formatCurrency(totalSplitOut)} detail="Revenue given to other branches" icon={<ArrowRight className="size-5 rotate-90" />} status="risk" />
            <StatCard label="Branches" value={formatCompactNumber(report.length)} detail="Active branches with revenue data" icon={<BarChart3 className="size-5" />} />
          </section>

          <Card>
            <CardHeader><h3 className="text-sm font-black">Revenue by Branch</h3></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No chart data.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
                      <Tooltip formatter={(v: unknown) => [formatCurrency(Math.abs(Number(v ?? 0))), ""]} />
                      <Bar dataKey="direct" name="Direct" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="splitIn" name="Split In" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactNumber(Math.abs(v))} tickLine={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 font-black">Branch</th>
                  <th className="px-4 py-3 font-black">Direct Revenue</th>
                  <th className="px-4 py-3 font-black">+ Split In</th>
                  <th className="px-4 py-3 font-black">- Split Out</th>
                  <th className="px-4 py-3 font-black bg-primary/10">= Net Revenue</th>
                  <th className="px-4 py-3 font-black">Members</th>
                  <th className="px-4 py-3 font-black">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.branchId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-bold">{r.branchName}</td>
                    <td className="px-4 py-3">{formatCurrency(r.directRevenue)}</td>
                    <td className="px-4 py-3 text-accent">+{formatCurrency(r.splitIn)}</td>
                    <td className="px-4 py-3 text-destructive">-{formatCurrency(r.splitOut)}</td>
                    <td className="px-4 py-3 font-black bg-primary/5">{formatCurrency(r.netRevenue)}</td>
                    <td className="px-4 py-3">{formatCompactNumber(r.memberCount)}</td>
                    <td className="px-4 py-3">{formatCompactNumber(r.attendanceCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SplitLogsTab({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const [logsData, setLogsData] = useState<{ logs: SplitLog[]; total: number; summary: { totalOriginal: number; totalSplit: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const filters: { branchId?: string; dateFrom?: string; dateTo?: string; page: number; pageSize: number } = { page, pageSize };
      if (branchId) filters.branchId = branchId;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      const data = await getSplitLogs(dashboard.organization.id, filters);
      setLogsData(data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [dashboard.organization.id, branchId, dateFrom, dateTo, page]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const branches = useMemo(() =>
    dashboard.branches.map((b) => ({ id: b.id, name: b.name })),
    [dashboard.branches]
  );

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";

  const totalPages = logsData ? Math.ceil(logsData.total / pageSize) : 0;

  const handleExportCSV = () => {
    if (!logsData || logsData.logs.length === 0) return;
    const csvData = logsData.logs.map((l) => ({
      date: l.created_at,
      paymentId: l.payment_id,
      sourceBranch: branchName(l.source_branch_id),
      targetBranch: branchName(l.target_branch_id),
      originalAmount: l.original_amount,
      splitAmount: l.split_amount,
      splitPercentage: l.split_percentage,
    }));
    exportToCSV(csvData, "revenue-split-logs");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Split Logs</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs"
            value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }}
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs" />
          <button
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-bold hover:bg-surface-muted"
            onClick={handleExportCSV} type="button"
          >
            <Download className="size-3" /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading logs...</p>
      ) : !logsData || logsData.logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No split logs recorded yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Total Original: <strong>{formatCurrency(logsData.summary.totalOriginal)}</strong></span>
            <span>Total Split: <strong>{formatCurrency(logsData.summary.totalSplit)}</strong></span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 font-black">Date</th>
                  <th className="px-4 py-3 font-black">Payment ID</th>
                  <th className="px-4 py-3 font-black">Source</th>
                  <th className="px-4 py-3 font-black">Target</th>
                  <th className="px-4 py-3 font-black">Original Amount</th>
                  <th className="px-4 py-3 font-black">Split Amount</th>
                  <th className="px-4 py-3 font-black">Split %</th>
                </tr>
              </thead>
              <tbody>
                {logsData.logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{new Date(log.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 font-mono text-[10px]">{log.payment_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-3">{branchName(log.source_branch_id)}</td>
                    <td className="px-4 py-3">{branchName(log.target_branch_id)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(log.original_amount)}</td>
                    <td className="px-4 py-3 font-bold text-accent">{formatCurrency(log.split_amount)}</td>
                    <td className="px-4 py-3">{Number(log.split_percentage).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                className="rounded-md border border-border px-2 py-1 text-xs font-bold hover:bg-surface-muted disabled:opacity-30"
                onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} type="button"
              >
                Prev
              </button>
              <span className="text-xs font-bold">{page} / {totalPages}</span>
              <button
                className="rounded-md border border-border px-2 py-1 text-xs font-bold hover:bg-surface-muted disabled:opacity-30"
                onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} type="button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
