"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback } from "react";
import { BarChart3, Package, Users, X, Loader2, Check, AlertTriangle, RefreshCw, Plus, Eye, ArrowUpDown, Ban, Play, Clock, CreditCard, Receipt, History, Shield, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { RequestQueueClient } from "./request-queue-client";
import { syncEntitlementsAction, syncUsageLimitsAction } from "@/features/subscription/super-admin-actions";
import {
  upgradePlanAction, downgradePlanAction, cancelSubscriptionAction,
  reactivateSubscriptionAction, extendTrialAction, convertTrialAction,
} from "@/features/super-admin/actions/subscription-enterprise-actions";

type Data = {
  error: string | null;
  organizations: any[];
  packages: any[];
  subscriptions: any[];
  invoicesByOrg: Record<string, any[]>;
  eventsByOrg: Record<string, any[]>;
};

const PAGE_SIZES = [25, 50, 100];
const PackageManagementClient = dynamic(() => import("./package-management-client").then((m) => m.PackageManagementClient), { ssr: false });

export function SubscriptionsClient({ data }: { data: Data }) {
  const [activeTab, setActiveTab] = useState<"overview" | "packages" | "requests">("overview");
  const [drawerOrgData, setDrawerOrgData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Compute stats
  const activeSubs = data.subscriptions.filter((s: any) => s.status === "active").length;
  const trialSubs = data.subscriptions.filter((s: any) => s.status === "trial").length;
  const expiredSubs = data.subscriptions.filter((s: any) => s.status === "expired" || s.status === "suspended" || s.status === "cancelled").length;
  const unassigned = data.organizations.length - data.subscriptions.length;

  const totalMonthlyRevenue = data.subscriptions.reduce((sum: number, s: any) => {
    if (s.status !== "active") return sum;
    const pkg = data.packages.find((p: any) => p.id === s.package_id);
    return sum + (s.price_override ?? pkg?.price ?? 0);
  }, 0);

  const totalInvoices = Object.values(data.invoicesByOrg).flat().length;
  const pendingInvoices = Object.values(data.invoicesByOrg).flat().filter((i: any) => i.status === "issued" && !i.paid_at).length;
  const failedEvents = Object.values(data.eventsByOrg).flat().filter((e: any) => e.event_type?.includes("failed") || e.event_type?.includes("error")).length;

  // Filter + paginate
  const filteredOrgs = useMemo(() => {
    let list = data.organizations;
    if (search) { const q = search.toLowerCase(); list = list.filter((o: any) => o.name.toLowerCase().includes(q)); }
    if (filterStatus !== "all") {
      list = list.filter((o: any) => { const s = data.subscriptions.find((x: any) => x.organization_id === o.id); return filterStatus === "unassigned" ? !s : s?.status === filterStatus; });
    }
    if (filterPlan !== "all") {
      list = list.filter((o: any) => { const s = data.subscriptions.find((x: any) => x.organization_id === o.id); const p = s ? data.packages.find((pk: any) => pk.id === s.package_id) : null; return p?.slug === filterPlan; });
    }
    return list;
  }, [data.organizations, data.subscriptions, data.packages, search, filterStatus, filterPlan]);

  const pageCount = Math.ceil(filteredOrgs.length / pageSize);
  const pagedOrgs = filteredOrgs.slice(page * pageSize, (page + 1) * pageSize);

  const handleAction = useCallback(async (actionFn: any, input: any, label: string, successMsg: string) => {
    setActionLoading(label);
    const result = await actionFn(input);
    showToast(result.status === "success" ? successMsg : result.message || "Action failed", result.status === "success" ? "success" : "error");
    setActionLoading(null);
    if (result.status === "success" && drawerOrgData?.org?.id) {
      handleSyncEntitlements(drawerOrgData.org.id);
    }
  }, [drawerOrgData]);

  const handleSyncEntitlements = async (orgId: string) => {
    setActionLoading(`sync-${orgId}`);
    await syncEntitlementsAction(orgId);
    await syncUsageLimitsAction(orgId);
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
        <h1 className="text-3xl font-black md:text-4xl">Subscription Management</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Enterprise subscription lifecycle, billing, and operations</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {[
          { key: "overview" as const, label: "Operations", icon: BarChart3 },
          { key: "packages" as const, label: "Packages", icon: Package },
          { key: "requests" as const, label: "Requests", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition", activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setActiveTab(tab.key)} role="tab" aria-selected={activeTab === tab.key} type="button">
              <Icon className="size-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Revenue Health Dashboard */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Monthly Revenue (MRR)" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalMonthlyRevenue / 100))}`} detail={`${activeSubs} active subscriptions`} status="good" />
            <StatCard label="Annual Run Rate (ARR)" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalMonthlyRevenue * 12 / 100))}`} detail={`${trialSubs} in trial`} status={trialSubs > 0 ? "watch" : "good"} />
            <StatCard label="Invoices" value={String(totalInvoices)} detail={`${pendingInvoices} pending payment`} status={pendingInvoices > 0 ? "watch" : "good"} />
            <StatCard label="Unassigned" value={String(unassigned)} detail={`${failedEvents} failed events`} status={unassigned > 0 || failedEvents > 0 ? "risk" : "good"} />
          </div>

          {/* Organization table with pagination */}
          <div className="rounded-xl border border-border bg-background">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">Organizations ({filteredOrgs.length})</h2>
                  <p className="text-xs text-muted-foreground mt-1">Page {page + 1} of {pageCount || 1} · {pageSize} per page</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search..." className="h-9 w-40 text-xs" />
                  <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                  <select value={filterPlan} onChange={(e) => { setFilterPlan(e.target.value); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
                    <option value="all">All Plans</option>
                    {data.packages.map((p: any) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                  </select>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
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
                    <th className="px-5 py-3">Trial</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedOrgs.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No organizations match your filters</td></tr>
                  ) : pagedOrgs.map((org: any) => {
                    const orgSub = data.subscriptions.find((s: any) => s.organization_id === org.id);
                    const pkg = orgSub ? data.packages.find((p: any) => p.id === orgSub.package_id) : null;
                    const trialEnd = orgSub?.trial_ends_at ? new Date(orgSub.trial_ends_at) : null;
                    const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : null;
                    return (
                      <tr key={org.id} className="border-b border-border hover:bg-accent/5 transition-colors">
                        <td className="px-5 py-3">
                          <button onClick={() => setDrawerOrgData({ org, sub: orgSub, pkg })} className="font-semibold hover:text-primary text-left" type="button">
                            {org.name}
                          </button>
                          {!org.billing_email && orgSub && <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">No billing email</span>}
                        </td>
                        <td className="px-5 py-3">
                          {pkg ? <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{pkg.name}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs capitalize">{orgSub?.billing_period ?? "—"}</td>
                        <td className="px-5 py-3"><StatusBadge status={orgSub?.status ?? "unassigned"} /></td>
                        <td className="px-5 py-3 text-xs text-muted-foreground" suppressHydrationWarning>
                          {orgSub?.next_billing_date ? new Date(orgSub.next_billing_date).toLocaleDateString("en-IN") : orgSub?.expires_at ? new Date(orgSub.expires_at).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {trialDaysLeft !== null ? (
                            <span className={cn("font-semibold", trialDaysLeft <= 3 ? "text-red-600" : "text-blue-600")}>{trialDaysLeft}d left</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <button onClick={() => setDrawerOrgData({ org, sub: orgSub, pkg })} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10" type="button" aria-label="Open"><Eye className="size-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 hover:bg-accent/10" type="button">Prev</button>
                  {Array.from({ length: Math.min(pageCount, 5) }).map((_, i) => {
                    const start = Math.max(0, Math.min(page - 2, pageCount - 5));
                    const p = start + i;
                    if (p >= pageCount) return null;
                    return <button key={p} onClick={() => setPage(p)} className={cn("rounded-md border px-3 py-1.5 text-xs font-semibold", p === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent/10")} type="button">{p + 1}</button>;
                  })}
                  <button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 hover:bg-accent/10" type="button">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "packages" && <PackageManagementClient data={data} />}
      {activeTab === "requests" && <RequestQueueClient />}

      {/* ═══════════════════════════════════════ */}
      {/* SUBSCRIPTION DRAWER — FULL OPERATIONS  */}
      {/* ═══════════════════════════════════════ */}
      {drawerOrgData && (
        <SubscriptionDrawer
          data={data}
          drawerOrg={drawerOrgData}
          onClose={() => setDrawerOrgData(null)}
          onAction={handleAction}
          onSync={handleSyncEntitlements}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  SUBSCRIPTION DRAWER                    */
/* ════════════════════════════════════════ */

function SubscriptionDrawer({ data, drawerOrg, onClose, onAction, onSync, actionLoading }: {
  data: Data; drawerOrg: { org: any; sub: any; pkg: any }; onClose: () => void;
  onAction: (fn: any, input: any, label: string, msg: string) => void; onSync: (orgId: string) => void; actionLoading: string | null;
}) {
  const { org, sub, pkg } = drawerOrg;
  const [tab, setTab] = useState<"overview" | "invoices" | "events">("overview");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  const invoices = (data.invoicesByOrg[org.id] ?? []) as any[];
  const events = (data.eventsByOrg[org.id] ?? []) as any[];

  const execWithConfirm = async (actionFn: any, input: any, label: string, msg: string) => {
    if (!confirmReason.trim()) return;
    setConfirmLoading(true);
    await onAction(actionFn, { ...input, reason: confirmReason, adminNote: confirmReason }, label, msg);
    setConfirmLoading(false);
    setConfirmAction(null);
    setConfirmReason("");
  };

  const requiresReason = (action: string) => setConfirmAction(action);

  const renderConfirmModal = () => {
    if (!confirmAction) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!confirmLoading) setConfirmAction(null); }}>
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-full bg-amber-50 p-2"><Shield className="size-5 text-amber-600" /></div>
            <div>
              <h3 className="text-lg font-black">Confirm {confirmAction}</h3>
              <p className="text-sm text-muted-foreground">This action will be recorded in the audit log.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-black uppercase text-muted-foreground">Reason <span className="text-red-500">*</span></label>
              <Textarea value={confirmReason} onChange={(e) => setConfirmReason(e.target.value)} rows={2} placeholder="Provide a reason for this action..." className="mt-1" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => { setConfirmAction(null); setConfirmReason(""); }} disabled={confirmLoading}>Cancel</Button>
              <Button type="button" variant="primary" onClick={() => execWithConfirm(
                confirmAction === "upgrade" ? upgradePlanAction :
                confirmAction === "downgrade" ? downgradePlanAction :
                confirmAction === "cancel" ? cancelSubscriptionAction :
                confirmAction === "reactivate" ? reactivateSubscriptionAction :
                confirmAction === "extend_trial" ? extendTrialAction :
                convertTrialAction,
                confirmAction === "cancel" ? { subscriptionId: sub?.id, organizationId: org.id } :
                confirmAction === "reactivate" ? { subscriptionId: sub?.id, organizationId: org.id } :
                confirmAction === "extend_trial" ? { subscriptionId: sub?.id, organizationId: org.id, additionalDays: 14 } :
                confirmAction === "convert_trial" ? { subscriptionId: sub?.id, organizationId: org.id, billingPeriod: "monthly" } :
                { subscriptionId: sub?.id, organizationId: org.id, targetPackageId: pkg?.id },
                confirmAction, `${confirmAction} successful`
              )} disabled={!confirmReason.trim() || confirmLoading} className="gap-2">
                {confirmLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                {confirmLoading ? "Processing..." : `Confirm ${confirmAction}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface border-l border-border shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-black">{org.name}</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {pkg ? <span className="font-semibold text-indigo-600">{pkg.name}</span> : <span className="text-gray-500">No plan</span>}
              {sub && <StatusBadge status={sub.status} />}
              {sub?.billing_period && <span className="capitalize">· {sub.billing_period}</span>}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent/10" type="button"><X className="size-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-accent/5 px-5">
          {(["overview", "invoices", "events"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5", tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} type="button">
              {t === "overview" && <CreditCard className="size-3.5" />}
              {t === "invoices" && <Receipt className="size-3.5" />}
              {t === "events" && <History className="size-3.5" />}
              {t === "overview" ? "Overview" : t === "invoices" ? `Invoices (${invoices.length})` : `Events (${events.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="p-5 space-y-5">
            {/* Plan Details */}
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <p className="text-xs font-black uppercase text-muted-foreground">Subscription Details</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Detail label="Plan" value={pkg?.name ?? "—"} />
                <Detail label="Status" value={sub?.status ?? "—"} />
                <Detail label="Billing Cycle" value={sub?.billing_period ? sub.billing_period.charAt(0).toUpperCase() + sub.billing_period.slice(1) : "—"} />
                <Detail label="Price" value={sub ? `₹${Intl.NumberFormat("en-IN").format(Math.round((sub.price_override ?? pkg?.price ?? 0) / 100))}/mo` : "—"} />
                <Detail label="Started" value={sub?.started_at ? new Date(sub.started_at).toLocaleDateString("en-IN") : "—"} />
                <Detail label="Next Billing" value={sub?.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString("en-IN") : sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"} />
                {sub?.trial_ends_at && <Detail label="Trial Ends" value={new Date(sub.trial_ends_at).toLocaleDateString("en-IN")} />}
                {sub?.cancelled_at && <Detail label="Cancelled" value={new Date(sub.cancelled_at).toLocaleDateString("en-IN")} />}
              </div>
              {!org.billing_email && sub && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>Missing billing email — invoicing disabled</span>
                </div>
              )}
              {sub?.notes && <p className="text-xs text-muted-foreground">Notes: {sub.notes}</p>}
            </div>

            {/* Lifecycle Actions */}
            {sub && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <p className="text-xs font-black uppercase text-muted-foreground">Lifecycle Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <ActionBtn icon={<RefreshCw className="size-3" />} label="Sync Entitlements" onClick={() => onSync(org.id)} loading={actionLoading === `sync-${org.id}`} />
                  {sub.status === "active" && <ActionBtn icon={<Ban className="size-3" />} label="Cancel" onClick={() => requiresReason("cancel")} loading={false} />}
                  {(sub.status === "cancelled" || sub.status === "expired") && <ActionBtn icon={<Play className="size-3" />} label="Reactivate" onClick={() => requiresReason("reactivate")} loading={false} />}
                  {sub.status === "trial" && <ActionBtn icon={<Clock className="size-3" />} label="Extend Trial" onClick={() => requiresReason("extend_trial")} loading={false} />}
                  {sub.status === "trial" && <ActionBtn icon={<Check className="size-3" />} label="Convert to Paid" onClick={() => requiresReason("convert_trial")} loading={false} />}
                  {sub.status === "active" && (
                    <button onClick={() => requiresReason("upgrade")} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 px-3 py-2 text-xs font-semibold hover:bg-primary/20" type="button">
                      <ArrowUpDown className="size-3" /> Upgrade Plan
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {tab === "invoices" && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Invoices & Payments</p>
            {invoices.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No invoices yet</div>
            ) : invoices.map((inv: any) => (
              <div key={inv.id} className="rounded-lg border border-border bg-background p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{inv.invoice_number ?? "—"}</span>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border", inv.paid_at ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                    {inv.paid_at ? "Paid" : inv.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>₹{Intl.NumberFormat("en-IN").format(Math.round((inv.total_amount ?? 0) / 100))} {inv.currency}</span>
                  <span suppressHydrationWarning>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("en-IN") : "—"} · Due {inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN") : "—"}</span>
                </div>
                {inv.razorpay_order_id && <p className="text-[10px] text-muted-foreground font-mono truncate">Order: {inv.razorpay_order_id}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Events / Audit Tab */}
        {tab === "events" && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Audit Timeline</p>
            {events.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No events recorded</div>
            ) : events.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-3">
                <div className={cn("mt-1 size-2 rounded-full shrink-0", ev.event_type?.includes("failed") || ev.event_type?.includes("error") ? "bg-red-500" : ev.event_type?.includes("created") || ev.event_type?.includes("approved") || ev.event_type?.includes("succeeded") ? "bg-green-500" : "bg-blue-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{ev.event_type ?? "event"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{ev.reason ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground" suppressHydrationWarning>{ev.created_at ? new Date(ev.created_at).toLocaleString("en-IN") : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderConfirmModal()}
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  HELPERS                                 */
/* ════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "border-green-200 bg-green-50 text-green-700",
    trial: "border-blue-200 bg-blue-50 text-blue-700",
    expired: "border-red-200 bg-red-50 text-red-700",
    suspended: "border-orange-200 bg-orange-50 text-orange-800",
    cancelled: "border-slate-200 bg-slate-50 text-slate-700",
    unassigned: "border-gray-200 bg-gray-50 text-gray-500",
  };
  return <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + (colors[status?.toLowerCase()] ?? "border-border bg-surface-muted text-muted-foreground")}>{status ?? "unknown"}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground text-[11px]">{label}</span><p className="font-semibold text-sm">{value}</p></div>;
}

function ActionBtn({ icon, label, onClick, loading }: { icon: React.ReactNode; label: string; onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-accent/10 disabled:opacity-50" type="button">
      {loading ? <Loader2 className="size-3 animate-spin" /> : icon} {label}
    </button>
  );
}
