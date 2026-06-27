"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CalendarDays, Edit3, Globe2, Layers, Plus, ShieldAlert, Trash2 } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import {
  getCrossBranchClassSummary,
  getCrossBranchClassBookings,
  getCrossBranchClassRules,
  createCrossBranchClassRule,
  updateCrossBranchClassRule,
  deleteCrossBranchClassRule,
  getAvailableCrossBranchClasses,
  type CrossBranchClassSummary,
  type CrossBranchClassBooking,
  type CrossBranchClassRule,
} from "@/features/organization-owner/actions/cross-branch-class-actions";

type Props = {
  dashboard: OrganizationOwnerDashboard;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CrossBranchClassBookingPanel({ dashboard }: Props) {
  const hasFeature = useHasFeature("cross_branch_class_booking");

  const [activeTab, setActiveTab] = useState<"overview" | "rules" | "bookings">("overview");
  const [summary, setSummary] = useState<CrossBranchClassSummary | null>(null);
  const [rules, setRules] = useState<CrossBranchClassRule[]>([]);
  const [bookings, setBookings] = useState<CrossBranchClassBooking[]>([]);
  const [availableGyms, setAvailableGyms] = useState<{ gymId: string; gymName: string; availableClasses: number; upcomingSessions: number }[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CrossBranchClassRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [selectedFromGymId, setSelectedFromGymId] = useState("");
  const [selectedToGymId, setSelectedToGymId] = useState("");
  const [selectedAccess, setSelectedAccess] = useState<"allow" | "deny">("allow");

  const refreshSummary = useCallback(async () => {
    if (!hasFeature) return;
    try {
      const [s, r, a] = await Promise.all([
        getCrossBranchClassSummary(dashboard.organization.id),
        getCrossBranchClassRules(dashboard.organization.id),
        getAvailableCrossBranchClasses(dashboard.organization.id),
      ]);
      setSummary(s);
      setRules(r);
      setAvailableGyms(a);
    } catch {
      // silently ignore
    }
    setLoading(false);
  }, [dashboard.organization.id, hasFeature]);

  const refreshBookings = useCallback(async () => {
    if (!hasFeature) return;
    try {
      const result = await getCrossBranchClassBookings(dashboard.organization.id, { page: 1, pageSize: 50 });
      setBookings(result.bookings);
      setBookingsTotal(result.total);
    } catch {
      // silently ignore
    }
  }, [dashboard.organization.id, hasFeature]);

  useEffect(() => { refreshSummary(); }, [refreshSummary]);
  useEffect(() => { if (activeTab === "bookings") refreshBookings(); }, [activeTab, refreshBookings]);

  const gyms = dashboard.gyms;

  const openCreate = useCallback(() => {
    setEditingRule(null);
    setFormError(null);
    setRuleName("");
    setSelectedFromGymId("");
    setSelectedToGymId("");
    setSelectedAccess("allow");
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((rule: CrossBranchClassRule) => {
    setEditingRule(rule);
    setFormError(null);
    setRuleName(rule.name);
    setSelectedFromGymId(rule.from_gym_id ?? "");
    setSelectedToGymId(rule.to_gym_id);
    setSelectedAccess(rule.is_allowed ? "allow" : "deny");
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingRule(null);
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    if (!ruleName.trim() || !selectedToGymId) {
      setFormError("Rule name and target gym are required.");
      setSaving(false);
      return;
    }

    const data = {
      name: ruleName.trim(),
      fromGymId: selectedFromGymId || null,
      toGymId: selectedToGymId,
      isAllowed: selectedAccess === "allow",
    };

    try {
      if (editingRule) {
        await updateCrossBranchClassRule(dashboard.organization.id, editingRule.id, data);
        showToast("Rule updated", "success");
      } else {
        await createCrossBranchClassRule(dashboard.organization.id, data);
        showToast("Rule created", "success");
      }
      closeDrawer();
      refreshSummary();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save rule");
    }
    setSaving(false);
  }, [editingRule, dashboard.organization.id, closeDrawer, refreshSummary, ruleName, selectedFromGymId, selectedToGymId, selectedAccess]);

  const handleDelete = useCallback(async (ruleId: string, name: string) => {
    if (!window.confirm(`Delete rule "${name}"?`)) return;
    try {
      await deleteCrossBranchClassRule(dashboard.organization.id, ruleId);
      showToast("Rule deleted", "success");
      refreshSummary();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete rule", "error");
    }
  }, [dashboard.organization.id, refreshSummary]);

  const handleToggleActive = useCallback(async (rule: CrossBranchClassRule) => {
    try {
      await updateCrossBranchClassRule(dashboard.organization.id, rule.id, { isActive: !rule.is_active });
      refreshSummary();
      showToast(rule.is_active ? "Rule disabled" : "Rule enabled", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to toggle rule", "error");
    }
  }, [dashboard.organization.id, refreshSummary]);

  const previewText = useMemo(() => {
    const fromLabel = selectedFromGymId
      ? gyms.find((g) => g.id === selectedFromGymId)?.name ?? "a gym"
      : "Any gym";
    const toLabel = selectedToGymId
      ? gyms.find((g) => g.id === selectedToGymId)?.name ?? "a gym"
      : "a gym";
    const accessLabel = selectedAccess === "allow" ? "can book classes at" : "cannot book classes at";
    return `Members from ${fromLabel} ${accessLabel} ${toLabel}`;
  }, [selectedFromGymId, selectedToGymId, selectedAccess, gyms]);

  if (!hasFeature) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-bold">Cross-Branch Class Booking</p>
        <p className="mt-1 text-xs text-muted-foreground">This feature requires an Enterprise plan. Upgrade to enable cross-branch class booking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
        {([
          { key: "overview", label: "Overview", icon: <Globe2 className="size-4" /> },
          { key: "rules", label: "Rules", icon: <Layers className="size-4" /> },
          { key: "bookings", label: "Bookings", icon: <BookOpen className="size-4" /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${activeTab === tab.key ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard detail="Cross-branch bookings across all gyms" icon={<BookOpen className="size-5" />} label="Total Bookings" value={String(summary?.totalBookings ?? 0)} />
            <StatCard detail="Cross-branch bookings today" icon={<CalendarDays className="size-5" />} label="Today" value={String(summary?.todayBookings ?? 0)} />
            <StatCard detail="Active cross-branch booking rules" icon={<Layers className="size-5" />} label="Active Rules" value={String(summary?.activeRules ?? 0)} />
            <StatCard detail="Upcoming class sessions available" icon={<BarChart3 className="size-5" />} label="Available Sessions" value={String(summary?.classesAvailable ?? 0)} />
          </section>

          <section className="rounded-lg border border-border bg-surface p-5">
            <h3 className="text-lg font-black">Gym Booking Availability</h3>
            <p className="mt-1 text-sm text-muted-foreground">Upcoming class sessions available per gym for cross-branch booking</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Gym</th>
                    <th className="px-3 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Available Classes</th>
                    <th className="px-3 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Upcoming Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={3}>Loading...</td></tr>
                  ) : availableGyms.length === 0 ? (
                    <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={3}>No gyms with available classes</td></tr>
                  ) : availableGyms.map((g) => (
                    <tr key={g.gymId} className="border-b border-border last:border-0">
                      <td className="px-3 py-3 font-bold">{g.gymName}</td>
                      <td className="px-3 py-3">{g.availableClasses} class types</td>
                      <td className="px-3 py-3">{g.upcomingSessions} sessions</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {/* ═══ RULES TAB ═══ */}
      {activeTab === "rules" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rules.length} rule{rules.length !== 1 ? "s" : ""} configured</p>
            <Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Rule</Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Rule Name</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">From Gym</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">To Gym</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Access</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Active</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>Loading...</td></tr>
                ) : rules.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>No cross-branch booking rules configured. Click Add Rule to create one.</td></tr>
                ) : rules.map((rule) => {
                  const fromGym = rule.from_gym_id ? gyms.find((g) => g.id === rule.from_gym_id) : null;
                  const toGym = gyms.find((g) => g.id === rule.to_gym_id);
                  return (
                    <tr key={rule.id} className="border-b border-border last:border-0 transition-all hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold">{rule.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fromGym ? fromGym.name : "Any Gym"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{toGym ? toGym.name : rule.to_gym_id}</td>
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

          <OrgOwnerDrawer description={editingRule ? `Editing ${editingRule.name}` : "Create a cross-branch class booking rule"} onClose={closeDrawer} open={drawerOpen} title={editingRule ? "Edit Rule" : "Add Rule"} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
              <DrawerFormMessage status={formError ? "error" : "idle"} message={formError} />
              <div className="grid gap-5 md:grid-cols-2">
                <DrawerField label="Rule Name" required>
                  <input className={selectClass} defaultValue={editingRule?.name ?? ""} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Allow cross-branch booking from Central" required type="text" />
                </DrawerField>
                <DrawerField label="Priority">
                  <input className={selectClass} defaultValue={editingRule?.priority ?? 0} min={0} name="priority" type="number" />
                </DrawerField>
                <DrawerField label="From Gym">
                  <select className={selectClass} onChange={(e) => setSelectedFromGymId(e.target.value)} value={selectedFromGymId}>
                    <option value="">Any Gym</option>
                    {gyms.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Target Gym" required>
                  <select className={selectClass} onChange={(e) => setSelectedToGymId(e.target.value)} value={selectedToGymId}>
                    <option value="" disabled>Select gym</option>
                    {gyms.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
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
                      Allow
                    </button>
                    <button
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-all ${selectedAccess === "deny" ? "bg-red-100 text-red-800 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setSelectedAccess("deny")}
                      type="button"
                    >
                      Deny
                    </button>
                  </div>
                </DrawerField>
              </div>
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
      ) : null}

      {/* ═══ BOOKINGS TAB ═══ */}
      {activeTab === "bookings" ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard detail="Total cross-branch class bookings" icon={<BookOpen className="size-5" />} label="Total Bookings" value={String(bookingsTotal)} />
            {summary ? (
              <StatCard detail="Unique source gyms" icon={<Globe2 className="size-5" />} label="From Gyms" value={String(summary.fromGyms.length)} />
            ) : null}
            {summary ? (
              <StatCard detail="Unique target gyms" icon={<BarChart3 className="size-5" />} label="To Gyms" value={String(summary.toGyms.length)} />
            ) : null}
          </section>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{bookings.length} of {bookingsTotal} cross-branch bookings</p>
            <Button size="sm" variant="secondary" onClick={() => {
              const data = bookings.map((b) => ({
                member: b.member_name,
                from: b.from_gym_name,
                to: b.to_gym_name,
                classId: b.class_id,
                date: b.session_date,
                status: b.status,
                bookedAt: new Date(b.created_at).toLocaleDateString("en-IN"),
              }));
              exportToCSV(data, "cross-branch-bookings");
            }}>
              <BarChart3 className="size-3.5" /> Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Member</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">From Gym</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">To Gym</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Class</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No cross-branch class bookings yet.</td></tr>
                ) : bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0 transition-all hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-bold">{b.member_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.from_gym_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.to_gym_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.class_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.session_date}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        b.status === "booked" ? "bg-blue-100 text-blue-700" :
                        b.status === "checked_in" ? "bg-green-100 text-green-700" :
                        b.status === "attended" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
