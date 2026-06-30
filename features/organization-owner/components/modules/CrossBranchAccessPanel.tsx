"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { BarChart3, CheckCircle2, Download, Edit3, Globe2, Layers, Plus, ShieldAlert, ShieldCheck, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { RuleCreatedDialog } from "@/features/organization-owner/components/modules/RuleCreatedDialog";
import {
  getAccessRules,
  createAccessRule,
  updateAccessRule,
  deleteAccessRule,
  getAccessLogs,
  getCrossBranchCheckInsToday,
} from "@/features/organization-owner/actions/cross-branch-actions";
import type { AccessRule, AccessLog, AccessLogsFilter } from "@/features/organization-owner/actions/cross-branch-actions";

type CrossBranchAccessPanelProps = {
  dashboard: OrganizationOwnerDashboard;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CrossBranchAccessPanel({ dashboard }: CrossBranchAccessPanelProps) {
  const hasFeature = useHasFeature("cross_branch_member_access");

  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [checkInsToday, setCheckInsToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState<"org-wide" | "per-member">("org-wide");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedFromBranchId, setSelectedFromBranchId] = useState("");
  const [selectedToBranchId, setSelectedToBranchId] = useState("");
  const [selectedAccess, setSelectedAccess] = useState<"allow" | "deny">("allow");
  const [successRule, setSuccessRule] = useState<AccessRule | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [logFilters, setLogFilters] = useState<AccessLogsFilter>({ page: 1, pageSize: 50 });
  const [logPage, setLogPage] = useState(1);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());

  const [logMemberId, setLogMemberId] = useState("");
  const [logGymId, setLogGymId] = useState("");

  const refreshRules = useCallback(async () => {
    if (!hasFeature) return;
    try {
      const data = await getAccessRules(dashboard.organization.id);
      setRules(data);
    } catch { /* silently ignore */ }
    setLoading(false);
  }, [dashboard.organization.id, hasFeature]);

  const refreshLogs = useCallback(async () => {
    if (!hasFeature) return;
    try {
      const filters: AccessLogsFilter = { ...logFilters, page: logPage };
      if (logMemberId) filters.memberId = logMemberId;
      if (logGymId) filters.gymId = logGymId;
      const result = await getAccessLogs(dashboard.organization.id, filters);
      setLogs(result.logs);
      setLogsTotal(result.total);
    } catch { /* silently ignore */ }
  }, [dashboard.organization.id, hasFeature, logFilters, logPage, logMemberId, logGymId]);

  const refreshCheckIns = useCallback(async () => {
    try {
      const count = await getCrossBranchCheckInsToday(dashboard.organization.id);
      setCheckInsToday(count);
    } catch { /* silently ignore */ }
  }, [dashboard.organization.id]);

  useEffect(() => { refreshRules(); refreshCheckIns(); }, [refreshRules, refreshCheckIns]);
  useEffect(() => { if (activeTab === "logs") refreshLogs(); }, [activeTab, refreshLogs]);

  const members = dashboard.members;
  const allBranches = dashboard.branches;
  const gyms = dashboard.gyms;

  const openCreate = useCallback(() => {
    setEditingRule(null);
    setFormError(null);
    setRuleType("org-wide");
    setSelectedMemberId("");
    setSelectedFromBranchId("");
    setSelectedToBranchId("");
    setSelectedAccess("allow");
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((rule: AccessRule) => {
    setEditingRule(rule);
    setFormError(null);
    setRuleType(rule.member_id ? "per-member" : "org-wide");
    setSelectedMemberId(rule.member_id ?? "");
    setSelectedFromBranchId(rule.from_branch_id ?? "");
    setSelectedToBranchId(rule.to_branch_id);
    setSelectedAccess(rule.is_allowed ? "allow" : "deny");
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingRule(null);
    setFormError(null);
  }, []);

  const previewText = useMemo(() => {
    const memberName = selectedMemberId
      ? members.find((m) => m.id === selectedMemberId)?.full_name ?? "Member"
      : "All members";
    const fromLabel = selectedFromBranchId
      ? allBranches.find((b) => b.id === selectedFromBranchId)?.name ?? "branch"
      : "any branch";
    const toLabel = selectedToBranchId
      ? allBranches.find((b) => b.id === selectedToBranchId)?.name ?? "a branch"
      : "a branch";
    const accessLabel = selectedAccess === "allow" ? "can" : "cannot";
    return `${memberName} from ${fromLabel} ${accessLabel} access ${toLabel}`;
  }, [selectedMemberId, selectedFromBranchId, selectedToBranchId, selectedAccess, members, allBranches]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value;
    const toBranchId = selectedToBranchId;

    if (!name || !toBranchId) {
      setFormError("Rule name and target branch are required.");
      setSaving(false);
      return;
    }

    const data = {
      name,
      memberId: ruleType === "per-member" ? (selectedMemberId || null) : null,
      fromBranchId: selectedFromBranchId || null,
      toBranchId,
      isAllowed: selectedAccess === "allow",
      priority: Number((e.currentTarget.elements.namedItem("priority") as HTMLInputElement)?.value ?? 0),
    };

    try {
      if (editingRule) {
        await updateAccessRule(dashboard.organization.id, editingRule.id, data);
        showToast("Rule updated", "success");
        closeDrawer();
      } else {
        const created = await createAccessRule(dashboard.organization.id, data);
        closeDrawer();
        setSuccessRule(created);
      }
      refreshRules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save rule");
    }
    setSaving(false);
  }, [editingRule, dashboard.organization.id, closeDrawer, refreshRules, ruleType, selectedMemberId, selectedFromBranchId, selectedToBranchId, selectedAccess]);

  const handleDelete = useCallback(async (ruleId: string, ruleName: string) => {
    if (!window.confirm(`Delete rule "${ruleName}"?`)) return;
    try {
      await deleteAccessRule(dashboard.organization.id, ruleId);
      showToast("Rule deleted", "success");
      refreshRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete rule", "error");
    }
  }, [dashboard.organization.id, refreshRules]);

  const handleToggleActive = useCallback(async (rule: AccessRule) => {
    try {
      await updateAccessRule(dashboard.organization.id, rule.id, { isActive: !rule.is_active });
      refreshRules();
      showToast(rule.is_active ? "Rule disabled" : "Rule enabled", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to toggle rule", "error");
    }
  }, [dashboard.organization.id, refreshRules]);

  const handleSelectRule = useCallback((ruleId: string, checked: boolean) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(ruleId);
      else next.delete(ruleId);
      return next;
    });
  }, []);

  const handleBulkToggleActive = useCallback(async (enable: boolean) => {
    const ids = Array.from(selectedRuleIds);
    if (ids.length === 0) { showToast("No rules selected", "info"); return; }
    try {
      await Promise.all(ids.map((id) => updateAccessRule(dashboard.organization.id, id, { isActive: enable })));
      showToast(`${ids.length} rule(s) ${enable ? "enabled" : "disabled"}`, "success");
      setSelectedRuleIds(new Set());
      refreshRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk action failed", "error");
    }
  }, [selectedRuleIds, dashboard.organization.id, refreshRules]);

  const handleApplyLogFilters = useCallback(() => {
    setLogPage(1);
    refreshLogs();
  }, [refreshLogs]);

  if (!hasFeature) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-bold">Cross-Branch Access</p>
        <p className="mt-1 text-xs text-muted-foreground">This feature requires the Enterprise plan. Upgrade your plan to enable cross-branch member access.</p>
      </div>
    );
  }

  const orgWideRules = rules.filter((r) => !r.member_id).length;
  const perMemberRules = rules.filter((r) => r.member_id).length;
  const logsAllowed = logs.filter((l) => l.decision === "allowed").length;
  const logsDenied = logs.filter((l) => l.decision === "denied").length;

  return (
    <div className="space-y-6">
      {/* ═══ Tabs ═══ */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
        <button
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${activeTab === "rules" ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("rules")}
          type="button"
        >
          <Layers className="size-4" /> Rules
        </button>
        <button
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${activeTab === "logs" ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("logs")}
          type="button"
        >
          <BarChart3 className="size-4" /> Logs
        </button>
      </div>

      {activeTab === "rules" ? (
        <>
          {/* ═══ KPI CARDS ═══ */}
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard detail="Active access rules" icon={<Layers className="size-5" />} label="Total Rules" value={String(rules.length)} />
            <StatCard detail="Organization-wide rules" icon={<Globe2 className="size-5" />} label="Org-Wide Rules" value={String(orgWideRules)} />
            <StatCard detail="Member-specific rules" icon={<ShieldCheck className="size-5" />} label="Per-Member Rules" value={String(perMemberRules)} />
            <StatCard detail="Cross-branch check-ins today" icon={<BarChart3 className="size-5" />} label="Check-ins Today" value={String(checkInsToday)} />
          </section>

          {/* ═══ BULK ACTIONS + ADD RULE ═══ */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedRuleIds.size > 0 ? (
                <>
                  <span className="text-xs font-bold text-muted-foreground">{selectedRuleIds.size} selected</span>
                  <Button onClick={() => handleBulkToggleActive(true)} size="sm" variant="primary"><ToggleRight className="size-3.5" /> Enable</Button>
                  <Button onClick={() => handleBulkToggleActive(false)} size="sm" variant="secondary"><ToggleLeft className="size-3.5" /> Disable</Button>
                </>
              ) : null}
            </div>
            <Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Rule</Button>
          </div>

          {/* ═══ RULES TABLE ═══ */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 w-10">
                    <input
                      className="size-4 rounded border-border"
                      type="checkbox"
                      checked={selectedRuleIds.size === rules.length && rules.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRuleIds(new Set(rules.map((r) => r.id)));
                        else setSelectedRuleIds(new Set());
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Rule Name</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">From</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">To</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Access</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Active</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={9}>Loading...</td></tr>
                ) : rules.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={9}>No access rules configured. Click &quot;Add Rule&quot; to create one.</td></tr>
                ) : rules.map((rule) => {
                  const fromBranch = rule.from_branch_id ? allBranches.find((b) => b.id === rule.from_branch_id) : null;
                  const toBranch = allBranches.find((b) => b.id === rule.to_branch_id);
                  const targetMember = rule.member_id ? members.find((m) => m.id === rule.member_id) : null;
                  return (
                    <tr key={rule.id} className="border-b border-border last:border-0 transition-all hover:bg-surface-muted/50">
                      <td className="px-4 py-3">
                        <input
                          className="size-4 rounded border-border"
                          type="checkbox"
                          checked={selectedRuleIds.has(rule.id)}
                          onChange={(e) => handleSelectRule(rule.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 font-bold">{rule.name}</td>
                      <td className="px-4 py-3">
                        {rule.member_id ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                            Per-Member {targetMember ? `(${targetMember.full_name})` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">Org-Wide</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fromBranch ? fromBranch.name : "Any Branch"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{toBranch ? toBranch.name : rule.to_branch_id}</td>
                      <td className="px-4 py-3">
                        {rule.is_allowed ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Allow</span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Deny</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-black">{rule.priority}</td>
                      <td className="px-4 py-3">
                        <button
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.is_active ? "bg-green-500" : "bg-gray-300"}`}
                          onClick={() => handleToggleActive(rule)}
                          type="button"
                          aria-label={rule.is_active ? "Disable rule" : "Enable rule"}
                        >
                          <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${rule.is_active ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => openEdit(rule)} type="button" aria-label="Edit rule"><Edit3 className="size-3.5" /></button>
                          <button className="rounded-md p-1 text-red-500 hover:bg-red-50" onClick={() => handleDelete(rule.id, rule.name)} type="button" aria-label="Delete rule"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ═══ RULE DRAWER ═══ */}
          <OrgOwnerDrawer description={editingRule ? `Editing ${editingRule.name}` : "Create a new cross-branch access rule"} onClose={closeDrawer} open={drawerOpen} title={editingRule ? "Edit Access Rule" : "Add Access Rule"} size="lg">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <DrawerFormMessage status={formError ? "error" : "idle"} message={formError} />
              <div className="grid gap-5 md:grid-cols-2">
                <DrawerField label="Rule Name" required>
                  <input className={selectClass} defaultValue={editingRule?.name ?? ""} name="name" placeholder="e.g. Cross-branch access to Central" required type="text" />
                </DrawerField>
                <DrawerField label="Priority" required>
                  <input className={selectClass} defaultValue={editingRule?.priority ?? 0} min={0} name="priority" type="number" />
                </DrawerField>
                <DrawerField label="Rule Type" required>
                  <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1">
                    <button
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-all ${ruleType === "org-wide" ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setRuleType("org-wide")}
                      type="button"
                    >
                      <Globe2 className="mr-1 inline size-3.5" /> All Members
                    </button>
                    <button
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-all ${ruleType === "per-member" ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setRuleType("per-member")}
                      type="button"
                    >
                      <ShieldCheck className="mr-1 inline size-3.5" /> Specific Member
                    </button>
                  </div>
                </DrawerField>
                {ruleType === "per-member" ? (
                  <DrawerField label="Member" required>
                    <select className={selectClass} onChange={(e) => setSelectedMemberId(e.target.value)} value={selectedMemberId}>
                      <option value="" disabled>Select member</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name} ({m.member_code})</option>
                      ))}
                    </select>
                  </DrawerField>
                ) : null}
                <DrawerField label="From Branch">
                  <select className={selectClass} onChange={(e) => setSelectedFromBranchId(e.target.value)} value={selectedFromBranchId}>
                    <option value="">Any Branch</option>
                    {allBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.branch_code})</option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Target Branch" required>
                  <select className={selectClass} onChange={(e) => setSelectedToBranchId(e.target.value)} value={selectedToBranchId} defaultValue={editingRule?.to_branch_id ?? ""}>
                    <option value="" disabled>Select branch</option>
                    {allBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.branch_code})</option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Access" required>
                  <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1">
                    <button
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-all ${selectedAccess === "allow" ? "bg-green-100 text-green-800 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setSelectedAccess("allow")}
                      type="button"
                    >
                      <CheckCircle2 className="mr-1 inline size-3.5" /> Allow
                    </button>
                    <button
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-all ${selectedAccess === "deny" ? "bg-red-100 text-red-800 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setSelectedAccess("deny")}
                      type="button"
                    >
                      <ShieldAlert className="mr-1 inline size-3.5" /> Deny
                    </button>
                  </div>
                </DrawerField>
              </div>
              {/* ═══ PREVIEW ═══ */}
              <div className="rounded-md border border-border bg-surface-muted p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Preview</p>
                <p className="mt-2 text-sm font-bold">{previewText}</p>
              </div>
              <div className="flex justify-end gap-3 border-t border-border pt-6">
                <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
                <DrawerSubmitButton loading={saving}>{editingRule ? "Update Rule" : "Create Rule"}</DrawerSubmitButton>
              </div>
            </form>
          </OrgOwnerDrawer>
        </>
      ) : (
        <>
          {/* ═══ LOGS TAB ═══ */}
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard detail="Cross-branch check-ins today" icon={<CheckCircle2 className="size-5" />} label="Check-ins Today" value={String(checkInsToday)} />
            <StatCard detail="Total logged events" icon={<BarChart3 className="size-5" />} label="Total Logs" value={String(logsTotal)} />
            <StatCard detail="Allowed cross-branch accesses" icon={<ShieldCheck className="size-5" />} label="Allowed" value={String(logsAllowed)} />
            <StatCard detail="Denied cross-branch accesses" icon={<ShieldAlert className="size-5" />} label="Denied" value={String(logsDenied)} />
          </section>

          {/* ═══ LOGS FILTERS ═══ */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Member</label>
              <select className={selectClass} onChange={(e) => setLogMemberId(e.target.value)} value={logMemberId}>
                <option value="">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Gym</label>
              <select className={selectClass} onChange={(e) => setLogGymId(e.target.value)} value={logGymId}>
                <option value="">All Gyms</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Decision</label>
              <select className={selectClass} onChange={(e) => setLogFilters((f) => ({ ...f, decision: e.target.value || undefined } as AccessLogsFilter))} value={logFilters.decision ?? ""}>
                <option value="">All</option>
                <option value="allowed">Allowed</option>
                <option value="denied">Denied</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Date From</label>
              <input className={selectClass} onChange={(e) => setLogFilters((f) => ({ ...f, dateFrom: e.target.value || undefined } as AccessLogsFilter))} type="date" value={logFilters.dateFrom ?? ""} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Date To</label>
              <input className={selectClass} onChange={(e) => setLogFilters((f) => ({ ...f, dateTo: e.target.value || undefined } as AccessLogsFilter))} type="date" value={logFilters.dateTo ?? ""} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyLogFilters} size="sm" variant="primary">Apply</Button>
              <Button onClick={() => {
                const data = logs.map((l) => ({
                  date: l.created_at ? new Date(l.created_at).toLocaleDateString() : "",
                  member: members.find((m) => m.id === l.member_id)?.full_name ?? l.member_id,
                  fromGym: gyms.find((g) => g.id === l.from_gym_id)?.name ?? l.from_gym_id ?? "N/A",
                  toGym: gyms.find((g) => g.id === l.to_gym_id)?.name ?? l.to_gym_id,
                  decision: l.decision,
                  rule: l.rule_name ?? "-",
                  reason: l.reason ?? "",
                }));
                exportToCSV(data, "cross-branch-access-logs");
              }} size="sm" variant="secondary"><Download className="size-3.5" /> Export CSV</Button>
            </div>
          </div>

          {/* ═══ LOGS TABLE ═══ */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Date/Time</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Member</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">From Gym</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">To Gym</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Decision</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Rule</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>No cross-branch access logs yet.</td></tr>
                ) : logs.map((log) => {
                  const logMember = members.find((m) => m.id === log.member_id);
                  const fromGym = gyms.find((g) => g.id === log.from_gym_id);
                  const toGym = gyms.find((g) => g.id === log.to_gym_id);
                  return (
                    <tr key={log.id} className="border-b border-border last:border-0 transition-all hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-mono text-xs">{log.created_at ? new Date(log.created_at).toLocaleString("en-IN") : ""}</td>
                      <td className="px-4 py-3 font-bold">{logMember ? logMember.full_name : log.member_id}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fromGym ? fromGym.name : log.from_gym_id ?? "N/A"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{toGym ? toGym.name : log.to_gym_id}</td>
                      <td className="px-4 py-3">
                        {log.decision === "allowed" ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Allowed</span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Denied</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-muted-foreground max-w-xs truncate">{log.rule_name ?? "-"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{log.reason ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ═══ PAGINATION ═══ */}
          {logsTotal > (logFilters.pageSize ?? 50) ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Showing {(logPage - 1) * (logFilters.pageSize ?? 50) + 1}-{Math.min(logPage * (logFilters.pageSize ?? 50), logsTotal)} of {logsTotal}</p>
              <div className="flex items-center gap-2">
                <Button disabled={logPage <= 1} onClick={() => setLogPage((p) => p - 1)} size="sm" variant="secondary">Previous</Button>
                <Button disabled={logPage * (logFilters.pageSize ?? 50) >= logsTotal} onClick={() => setLogPage((p) => p + 1)} size="sm" variant="secondary">Next</Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <RuleCreatedDialog
        branches={allBranches}
        data={successRule}
        members={members}
        onClose={() => setSuccessRule(null)}
        open={successRule !== null}
      />
    </div>
  );
}
