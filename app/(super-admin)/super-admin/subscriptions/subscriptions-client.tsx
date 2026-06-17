"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";
import { useState, useActionState, useEffect, useCallback } from "react";
import { BarChart3, Package, Users, ArrowUpDown, X, Loader2, Check, AlertTriangle, ExternalLink, Trash2, RefreshCw, Clock, Plus, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { RequestQueueClient } from "./request-queue-client";
import { syncEntitlementsAction, syncUsageLimitsAction } from "@/features/subscription/super-admin-actions";
import { assignPackageAction, updateSubscriptionStatusAction } from "@/features/super-admin/actions/subscription-actions";

type Data = {
  error: string | null;
  organizations: any[];
  packages: any[];
  subscriptions: any[];
};

const PackageManagementClient = dynamic(
  () => import("./package-management-client").then((m) => m.PackageManagementClient),
  { ssr: false }
);

export function SubscriptionsClient({ data }: { data: Data }) {
  const [activeTab, setActiveTab] = useState<"overview" | "packages" | "requests">("overview");
  const [drawerOrg, setDrawerOrg] = useState<any | null>(null);
  const [assignModal, setAssignModal] = useState<any | null>(null);
  const [assignPkgId, setAssignPkgId] = useState("");
  const [assignStatus, setAssignStatus] = useState("active");
  const [assignNotes, setAssignNotes] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");

  const activeSubs = data.subscriptions.filter((s: any) => s.status === "active").length;
  const trialSubs = data.subscriptions.filter((s: any) => s.status === "trial").length;
  const expiredSubs = data.subscriptions.filter((s: any) => s.status === "expired" || s.status === "suspended" || s.status === "cancelled").length;
  const unassigned = data.organizations.length - data.subscriptions.length;

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: BarChart3 },
    { key: "packages" as const, label: "Package Management", icon: Package },
    { key: "requests" as const, label: "Request Queue", icon: Users },
  ];

  const handleAssignPlan = async () => {
    if (!drawerOrg || !assignPkgId) return;
    setActionLoading("assign");
    const result = await assignPackageAction({
      organizationId: drawerOrg.id,
      packageId: assignPkgId,
      status: assignStatus,
      notes: assignNotes || null,
    });
    if (result.status === "success") {
      showToast("Plan assigned successfully", "success");
      setAssignModal(null);
      setAssignPkgId("");
      setAssignNotes("");
    } else {
      showToast(result.message || "Failed to assign plan", "error");
    }
    setActionLoading(null);
  };

  const handleSyncEntitlements = async (orgId: string) => {
    setActionLoading(`sync-${orgId}`);
    const result = await syncEntitlementsAction(orgId);
    showToast(result.ok ? "Entitlements synced" : result.error ?? "Sync failed", result.ok ? "success" : "error");
    setActionLoading(null);
  };

  const handleSyncLimits = async (orgId: string) => {
    setActionLoading(`limits-${orgId}`);
    const result = await syncUsageLimitsAction(orgId);
    showToast(result.ok ? "Limits synced" : result.error ?? "Sync failed", result.ok ? "success" : "error");
    setActionLoading(null);
  };

  // Filter organizations
  const filteredOrgs = data.organizations.filter((org: any) => {
    if (search && !org.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all") {
      const orgSub = data.subscriptions.find((s: any) => s.organization_id === org.id);
      if (!orgSub && filterStatus !== "unassigned") return false;
      if (orgSub && orgSub.status !== filterStatus) return false;
      if (!orgSub && filterStatus === "unassigned") return true;
    }
    if (filterPlan !== "all") {
      const orgSub = data.subscriptions.find((s: any) => s.organization_id === org.id);
      const pkg = orgSub ? data.packages.find((p: any) => p.id === orgSub.package_id) : null;
      if (!pkg || pkg.slug !== filterPlan) return false;
    }
    return true;
  });

  const orgSubscriptions = data.subscriptions;
  const orgPackages = data.packages;

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
        <h1 className="text-3xl font-black md:text-4xl">Subscription Management</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage SaaS packages, organization subscriptions, feature entitlements, and upgrade requests
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              type="button"
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Organizations" value={String(data.organizations.length)} detail={`${activeSubs} active · ${trialSubs} trial · ${expiredSubs} expired`} status={unassigned > 0 ? "watch" : "good"} />
            <StatCard label="Active Subscriptions" value={String(activeSubs)} detail={`${trialSubs} in trial · ${expiredSubs} expired/suspended`} status={activeSubs > 0 ? "good" : "risk"} />
            <StatCard label="Packages" value={String(data.packages.length)} detail={`${data.packages.filter((p: any) => p.is_active).length} active`} />
            <StatCard label="Unassigned" value={String(unassigned)} detail="Organizations without a plan" status={unassigned > 0 ? "risk" : "good"} />
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-background p-5">
            <h2 className="text-lg font-black">Quick Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => setActiveTab("packages")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90" type="button"><Package className="size-4" /> Manage Packages</button>
              <button onClick={() => setActiveTab("requests")} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition-all hover:bg-accent/10" type="button"><Users className="size-4" /> View Upgrade Requests</button>
            </div>
          </div>

          {/* Organization subscription list */}
          <div className="rounded-xl border border-border bg-background">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">Organization Subscriptions</h2>
                  <p className="text-xs text-muted-foreground mt-1">{filteredOrgs.length} of {data.organizations.length} organizations</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 w-40 rounded-md border border-border bg-surface px-3 text-xs" />
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                  <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
                    <option value="all">All Plans</option>
                    {data.packages.map((p: any) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Package</th>
                    <th className="px-5 py-3">Billing</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Next Billing</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                        {search || filterStatus !== "all" || filterPlan !== "all"
                          ? "No organizations match your filters"
                          : "No organizations found"}
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org: any) => {
                      const orgSub = orgSubscriptions.find((s: any) => s.organization_id === org.id);
                      const pkg = orgSub ? orgPackages.find((p: any) => p.id === orgSub.package_id) : null;
                      const billingCycle = orgSub?.billing_period ?? null;
                      return (
                        <tr key={org.id} className="border-b border-border hover:bg-accent/5 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDrawerOrg({ org, sub: orgSub, pkg })}
                                className="font-semibold hover:text-primary text-left"
                                type="button"
                              >
                                {org.name}
                              </button>
                              {!org.billing_email && orgSub && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                                  No email
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {pkg ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{pkg.name}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">No plan</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {billingCycle ? (
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize">
                                {billingCycle === "annual" ? "Annual" : billingCycle === "monthly" ? "Monthly" : billingCycle}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3"><StatusBadge status={orgSub?.status ?? "unassigned"} /></td>
                          <td className="px-5 py-3 text-muted-foreground text-xs" suppressHydrationWarning>
                            {orgSub?.next_billing_date ? new Date(orgSub.next_billing_date).toLocaleDateString("en-IN") : orgSub?.expires_at ? new Date(orgSub.expires_at).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setDrawerOrg({ org, sub: orgSub, pkg })}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                                type="button"
                                aria-label="View details"
                              >
                                <Eye className="size-4" />
                              </button>
                              {orgSub && (
                                <>
                                  <button
                                    onClick={() => handleSyncEntitlements(org.id)}
                                    disabled={actionLoading === `sync-${org.id}`}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 disabled:opacity-50"
                                    type="button"
                                    aria-label="Sync features"
                                  >
                                    {actionLoading === `sync-${org.id}` ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                  </button>
                                  <button
                                    onClick={() => { setAssignModal(org); setDrawerOrg({ org, sub: orgSub, pkg }); }}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                                    type="button"
                                    aria-label="Change plan"
                                  >
                                    <ArrowUpDown className="size-4" />
                                  </button>
                                </>
                              )}
                              {!orgSub && (
                                <button
                                  onClick={() => { setAssignModal(org); setDrawerOrg({ org, sub: null, pkg: null }); }}
                                  className="rounded-md p-1.5 text-primary hover:bg-primary/10"
                                  type="button"
                                  aria-label="Assign plan"
                                >
                                  <Plus className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === "packages" && <PackageManagementClient data={data} />}

      {/* Requests Tab */}
      {activeTab === "requests" && <RequestQueueClient />}

      {/* ─── Organization Subscription Drawer ─── */}
      {drawerOrg && !assignModal && (
        <OrgSubscriptionDrawer
          orgData={drawerOrg}
          packages={data.packages}
          onClose={() => setDrawerOrg(null)}
          onSync={handleSyncEntitlements}
          onSyncLimits={handleSyncLimits}
          actionLoading={actionLoading}
        />
      )}

      {/* ─── Assign Plan Modal ─── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!actionLoading) setAssignModal(null); }}>
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">{drawerOrg?.sub ? "Change Plan" : "Assign Plan"}</h2>
              <button onClick={() => setAssignModal(null)} disabled={!!actionLoading} className="rounded-md p-1.5 hover:bg-accent/10" type="button"><X className="size-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{assignModal.name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Package</label>
                <select value={assignPkgId} onChange={(e) => setAssignPkgId(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm mt-1">
                  <option value="">Select package...</option>
                  {data.packages.filter((p: any) => p.is_active).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((p.price ?? 0) / 100))}/mo</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Status</label>
                <select value={assignStatus} onChange={(e) => setAssignStatus(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm mt-1">
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Notes</label>
                <Textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} className="mt-1" placeholder="Admin notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setAssignModal(null)} disabled={!!actionLoading}>Cancel</Button>
                <Button type="button" variant="primary" onClick={handleAssignPlan} disabled={!assignPkgId || !!actionLoading} className="gap-2">
                  {actionLoading === "assign" ? <Loader2 className="size-4 animate-spin" /> : null}
                  {actionLoading === "assign" ? "Assigning..." : "Assign Plan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Organization Subscription Drawer ─── */

function OrgSubscriptionDrawer({ orgData, packages, onClose, onSync, onSyncLimits, actionLoading }: {
  orgData: { org: any; sub: any; pkg: any };
  packages: any[];
  onClose: () => void;
  onSync: (orgId: string) => void;
  onSyncLimits: (orgId: string) => void;
  actionLoading: string | null;
}) {
  const { org, sub, pkg } = orgData;
  const [activeTab, setActiveTab] = useState<"overview" | "info">("overview");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface border-l border-border shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-black">{org.name}</h2>
            <p className="text-xs text-muted-foreground">Organization Subscription</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent/10" type="button"><X className="size-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-accent/5 px-5">
          {(["overview", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("px-4 py-3 text-xs font-bold border-b-2 transition", activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground")}
              type="button"
            >
              {tab === "overview" ? "Overview & Actions" : "Subscription Info"}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="p-5 space-y-5">
            {/* Plan Info */}
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-muted-foreground">Current Plan</span>
                <StatusBadge status={sub?.status ?? "unassigned"} />
              </div>
              <p className="text-xl font-black">{pkg?.name ?? "No Plan"}</p>
              {pkg && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Billing:</span> <span className="font-semibold capitalize">{sub?.billing_period ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Price:</span> <span className="font-semibold">₹{Intl.NumberFormat("en-IN").format(Math.round((sub?.price_override ?? pkg?.price ?? 0) / 100))}/mo</span></div>
                  <div><span className="text-muted-foreground">Started:</span> <span className="font-semibold" suppressHydrationWarning>{sub?.started_at ? new Date(sub.started_at).toLocaleDateString("en-IN") : "—"}</span></div>
                  <div><span className="text-muted-foreground">Next:</span> <span className="font-semibold" suppressHydrationWarning>{sub?.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString("en-IN") : sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"}</span></div>
                </div>
              )}
            </div>

            {/* Actions */}
            {sub && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <p className="text-xs font-black uppercase text-muted-foreground">Lifecycle Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSync(org.id)}
                    disabled={actionLoading === `sync-${org.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-accent/10 disabled:opacity-50"
                    type="button"
                  >
                    {actionLoading === `sync-${org.id}` ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    Sync Features
                  </button>
                  <button
                    onClick={() => onSyncLimits(org.id)}
                    disabled={actionLoading === `limits-${org.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-accent/10 disabled:opacity-50"
                    type="button"
                  >
                    {actionLoading === `limits-${org.id}` ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    Sync Limits
                  </button>
                </div>
              </div>
            )}

            {/* Missing billing email warning */}
            {!org.billing_email && sub && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Missing billing email</p>
                  <p className="text-[11px] text-amber-700">Set a billing contact to enable invoicing and payment notifications.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "info" && sub && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Subscription Details</p>
            <div className="rounded-lg border border-border bg-background p-4 space-y-2 text-sm">
              <Row label="Subscription ID" value={sub.id} />
              <Row label="Organization ID" value={org.id} />
              <Row label="Status" value={sub.status} />
              <Row label="Billing Period" value={sub.billing_period ?? "—"} />
              <Row label="Price Override" value={sub.price_override != null ? `₹${Intl.NumberFormat("en-IN").format(Math.round(sub.price_override / 100))}` : "None"} />
              <Row label="Start Date" value={sub.started_at ? new Date(sub.started_at).toLocaleDateString("en-IN") : "—"} />
              <Row label="Expires At" value={sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"} />
              <Row label="Next Billing" value={sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString("en-IN") : "—"} />
              <Row label="Trial Ends" value={sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString("en-IN") : "—"} />
              <Row label="Last Billing" value={sub.last_billing_date ? new Date(sub.last_billing_date).toLocaleDateString("en-IN") : "—"} />
              <Row label="Cancelled At" value={sub.cancelled_at ? new Date(sub.cancelled_at).toLocaleDateString("en-IN") : "—"} />
              <Row label="Notes" value={sub.notes ?? "—"} />
            </div>
          </div>
        )}

        {activeTab === "info" && !sub && (
          <div className="p-5 text-center text-muted-foreground text-sm py-12">
            No subscription assigned. Use <strong>Change Plan</strong> to assign one.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Status Badge ─── */

function StatusBadge({ status, suppressHydrationWarning }: { status: string; suppressHydrationWarning?: boolean }) {
  const colors: Record<string, string> = {
    active: "border-green-200 bg-green-50 text-green-700",
    trial: "border-blue-200 bg-blue-50 text-blue-700",
    expired: "border-red-200 bg-red-50 text-red-700",
    suspended: "border-orange-200 bg-orange-50 text-orange-800",
    cancelled: "border-slate-200 bg-slate-50 text-slate-700",
    inactive: "border-gray-200 bg-gray-50 text-gray-700",
    unassigned: "border-gray-200 bg-gray-50 text-gray-500",
  };
  const normalized = status?.toLowerCase() ?? "inactive";
  return (
    <span
      className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + (colors[normalized] ?? "border-border bg-surface-muted text-muted-foreground")}
      suppressHydrationWarning={suppressHydrationWarning}
    >
      {normalized}
    </span>
  );
}

/* ─── Row Helper ─── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-32 font-semibold text-muted-foreground">{label}:</span>
      <span className="font-mono text-xs break-all">{value}</span>
    </div>
  );
}
