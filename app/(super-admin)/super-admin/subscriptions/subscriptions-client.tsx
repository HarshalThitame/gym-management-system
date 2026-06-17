"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { BarChart3, Package, Users, X, Loader2, Check, AlertTriangle, RefreshCw, Plus, Eye, ArrowUpDown, Ban, Play, Clock, CreditCard, Receipt, History, Shield, Trash2, Calendar, Puzzle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { RequestQueueClient } from "./request-queue-client";
import { PaymentDashboard } from "@/features/super-admin/components/payment-dashboard";
import { syncEntitlementsAction, syncUsageLimitsAction } from "@/features/subscription/super-admin-actions";
import {
  upgradePlanAction, downgradePlanAction, cancelSubscriptionAction,
  reactivateSubscriptionAction, extendTrialAction, convertTrialAction,
  assignAddonAction, removeAddonAction, scheduleChangeAction, cancelScheduledChangeAction,
  overrideSubscriptionPriceAction,
} from "@/features/super-admin/actions/subscription-enterprise-actions";

type Data = { error: string | null; organizations: any[]; packages: any[]; subscriptions: any[]; invoicesByOrg: Record<string, any[]>; eventsByOrg: Record<string, any[]>; availableAddons: any[]; subAddonsBySub: Record<string, any[]>; schedChangesBySub: Record<string, any[]>; };
const PAGE_SIZES = [25, 50, 100];
const PackageManagementClient = dynamic(() => import("./package-management-client").then((m) => m.PackageManagementClient), { ssr: false });

export function SubscriptionsClient({ data }: { data: Data }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "packages" | "requests" | "payments">("overview");
  const [drawerOrgData, setDrawerOrgData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeSubs = data.subscriptions.filter((s: any) => s.status === "active").length;
  const trialSubs = data.subscriptions.filter((s: any) => s.status === "trial").length;
  const expiredSubs = data.subscriptions.filter((s: any) => s.status === "expired" || s.status === "suspended" || s.status === "cancelled").length;
  const unassigned = data.organizations.length - data.subscriptions.length;

  // Normalize MRR by billing period
  const computeMrr = (price: number, period: string) => {
    if (!price) return 0;
    const divisors: Record<string, number> = { monthly: 1, annual: 12 };
    return Math.round(price / (divisors[period] || 1));
  };

  const totalMonthlyRevenue = data.subscriptions.reduce((sum: number, s: any) => {
    if (s.status !== "active") return sum;
    const pkg = data.packages.find((p: any) => p.id === s.package_id);
    const price = s.price_override ?? pkg?.price ?? 0;
    const period = s.billing_period || pkg?.billing_period || "monthly";
    return sum + computeMrr(price, period);
  }, 0);

  const totalInvoices = Object.values(data.invoicesByOrg).flat().length;
  const pendingInvoices = Object.values(data.invoicesByOrg).flat().filter((i: any) => i.status === "issued" && !i.paid_at).length;
  const overdueInvoices = Object.values(data.invoicesByOrg).flat().filter((i: any) => i.status === "issued" && !i.paid_at && i.due_at && new Date(i.due_at) < new Date()).length;
  const failedEvents = Object.values(data.eventsByOrg).flat().filter((e: any) => e.event_type?.includes("failed") || e.event_type?.includes("error")).length;

  const triggeredSync = useCallback(async (orgId: string) => {
    setActionLoading(`sync-${orgId}`);
    const [eRes, lRes] = await Promise.all([syncEntitlementsAction(orgId), syncUsageLimitsAction(orgId)]);
    if (!eRes.ok || !lRes.ok) showToast("Sync completed with errors", "info");
    else showToast("Entitlements synced", "success");
    setActionLoading(null);
  }, []);

  const execAction = useCallback(async (fn: any, input: any, label: string, successMsg: string) => {
    setActionLoading(label);
    const result = await fn(input);
    if (result.status === "success") {
      showToast(successMsg, "success");
      router.refresh();
      if (drawerOrgData?.org?.id) triggeredSync(drawerOrgData.org.id);
    } else {
      showToast(result.message || result.error || "Action failed", "error");
    }
    setActionLoading(null);
    setRefreshKey(k => k + 1);
  }, [drawerOrgData, router, triggeredSync]);

  const filteredOrgs = useMemo(() => {
    let list = data.organizations;
    if (search) { const q = search.toLowerCase(); list = list.filter((o: any) => o.name.toLowerCase().includes(q)); }
    if (filterStatus !== "all") list = list.filter((o: any) => { const s = data.subscriptions.find((x: any) => x.organization_id === o.id); return filterStatus === "unassigned" ? !s : s?.status === filterStatus; });
    if (filterPlan !== "all") list = list.filter((o: any) => { const s = data.subscriptions.find((x: any) => x.organization_id === o.id); const p = s ? data.packages.find((pk: any) => pk.id === s.package_id) : null; return p?.slug === filterPlan; });
    return list;
  }, [data, search, filterStatus, filterPlan]);

  const pageCount = Math.ceil(filteredOrgs.length / pageSize);
  const pagedOrgs = filteredOrgs.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
        <h1 className="text-3xl font-black md:text-4xl">Subscription Management</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Enterprise subscription lifecycle, billing, and operations</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {[{ key: "overview" as const, label: "Operations", icon: BarChart3 }, { key: "packages" as const, label: "Packages", icon: Package }, { key: "payments" as const, label: "Payments", icon: DollarSign }, { key: "requests" as const, label: "Requests", icon: Users }].map((tab) => {
          const Icon = tab.icon;
          return (<button key={tab.key} className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition", activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setActiveTab(tab.key)} role="tab" type="button"><Icon className="size-4" />{tab.label}</button>);
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Monthly Revenue (MRR)" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalMonthlyRevenue / 100))}`} detail={`${activeSubs} active subscriptions`} status="good" />
            <StatCard label="Annual Run Rate (ARR)" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalMonthlyRevenue * 12 / 100))}`} detail={`${trialSubs} in trial`} status={trialSubs > 0 ? "watch" : "good"} />
            <StatCard label="Invoices" value={String(totalInvoices)} detail={`${pendingInvoices} pending · ${overdueInvoices} overdue`} status={overdueInvoices > 0 ? "risk" : pendingInvoices > 0 ? "watch" : "good"} />
            <StatCard label="Unassigned" value={String(unassigned)} detail={`${failedEvents} failed events`} status={unassigned > 0 || failedEvents > 0 ? "risk" : "good"} />
          </div>

          {/* Subscription Health Risks */}
          {(() => {
            const risks: { org: any; issue: string; severity: "risk" | "watch" }[] = [];
            data.organizations.forEach((org: any) => {
              const s = data.subscriptions.find((x: any) => x.organization_id === org.id);
              if (!s) return;
              if (!org.billing_email) risks.push({ org, issue: "Missing billing email", severity: "risk" });
              const tEnd = s.trial_ends_at ? new Date(s.trial_ends_at) : null;
              if (tEnd && tEnd.getTime() < Date.now()) risks.push({ org, issue: "Trial expired", severity: "risk" });
              else if (tEnd && tEnd.getTime() - Date.now() < 7 * 86400000) risks.push({ org, issue: "Trial expiring soon", severity: "watch" });
              const invs = data.invoicesByOrg[org.id] || [];
              if (invs.filter((i: any) => i.status === "issued" && !i.paid_at && i.due_at && new Date(i.due_at) < new Date()).length > 0) risks.push({ org, issue: "Overdue invoice", severity: "risk" });
            });
            if (risks.length === 0) return null;
            return (<div className="rounded-xl border border-red-200 bg-red-50/50 p-4"><div className="flex items-center gap-2 mb-2"><AlertTriangle className="size-4 text-red-600" /><h2 className="text-sm font-black text-red-800">Risks ({risks.length})</h2></div><div className="flex flex-wrap gap-2">{risks.slice(0, 6).map((r, i) => (<button key={i} onClick={() => { const sub = data.subscriptions.find((x: any) => x.organization_id === r.org.id); setDrawerOrgData({ org: r.org, sub, pkg: sub ? data.packages.find((p: any) => p.id === sub.package_id) : null }); }} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", r.severity === "risk" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700")} type="button">{r.org.name}: {r.issue}</button>))}{risks.length > 6 && <span className="text-xs text-muted-foreground self-center">+{risks.length - 6} more</span>}</div></div>);
          })()}

          <div className="rounded-xl border border-border bg-background">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-lg font-black">Organizations ({filteredOrgs.length})</h2><p className="text-xs text-muted-foreground mt-1">Page {page + 1} of {pageCount || 1}</p></div>
                <div className="flex flex-wrap gap-2">
                  <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search..." className="h-9 w-40 text-xs" />
                  <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">{["all", "active", "trial", "expired", "suspended", "cancelled", "unassigned"].map(s => <option key={s} value={s}>{s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select>
                  <select value={filterPlan} onChange={(e) => { setFilterPlan(e.target.value); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs"><option value="all">All Plans</option>{data.packages.map((p: any) => <option key={p.id} value={p.slug}>{p.name}</option>)}</select>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">{PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}</select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Package</th><th className="px-5 py-3">Billing</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Next</th><th className="px-5 py-3">Trial</th><th className="px-5 py-3"></th></tr></thead>
              <tbody>{pagedOrgs.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No matches</td></tr> : pagedOrgs.map((org: any) => { const orgSub = data.subscriptions.find((s: any) => s.organization_id === org.id); const pkg = orgSub ? data.packages.find((p: any) => p.id === orgSub.package_id) : null; const tEnd = orgSub?.trial_ends_at ? new Date(orgSub.trial_ends_at) : null; const tLeft = tEnd ? Math.max(0, Math.ceil((tEnd.getTime() - Date.now()) / 86400000)) : null; return (<tr key={org.id} className="border-b border-border hover:bg-accent/5"><td className="px-5 py-3"><button onClick={() => setDrawerOrgData({ org, sub: orgSub, pkg })} className="font-semibold hover:text-primary text-left" type="button">{org.name}</button>{!org.billing_email && orgSub && <span className="ml-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">No email</span>}</td><td className="px-5 py-3">{pkg ? <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{pkg.name}</span> : <span className="text-muted-foreground text-xs">—</span>}</td><td className="px-5 py-3 text-xs capitalize">{orgSub?.billing_period ?? "—"}</td><td className="px-5 py-3"><StatusBadge status={orgSub?.status ?? "unassigned"} /></td><td className="px-5 py-3 text-xs text-muted-foreground" suppressHydrationWarning>{orgSub?.next_billing_date ? new Date(orgSub.next_billing_date).toLocaleDateString("en-IN") : orgSub?.expires_at ? new Date(orgSub.expires_at).toLocaleDateString("en-IN") : "—"}</td><td className="px-5 py-3 text-xs">{tLeft !== null ? <span className={cn("font-semibold", tLeft <= 3 ? "text-red-600" : "text-blue-600")}>{tLeft}d</span> : <span className="text-muted-foreground">—</span>}</td><td className="px-5 py-3"><button onClick={() => setDrawerOrgData({ org, sub: orgSub, pkg })} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10" type="button"><Eye className="size-4" /></button></td></tr>); })}</tbody></table></div>
            {pageCount > 1 && (<div className="flex items-center justify-between border-t border-border px-5 py-3"><span className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</span><div className="flex gap-1"><button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 hover:bg-accent/10" type="button">Prev</button>{Array.from({ length: Math.min(pageCount, 5) }).map((_, i) => { const start = Math.max(0, Math.min(page - 2, pageCount - 5)); const p = start + i; if (p >= pageCount) return null; return <button key={p} onClick={() => setPage(p)} className={cn("rounded-md border px-3 py-1.5 text-xs font-semibold", p === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent/10")} type="button">{p + 1}</button>;})}<button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 hover:bg-accent/10" type="button">Next</button></div></div>)}
          </div>
        </div>
      )}

      {activeTab === "packages" && <PackageManagementClient data={data} />}
      {activeTab === "requests" && <RequestQueueClient />}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <PaymentDashboard
          organizations={data.organizations}
          packages={data.packages}
          subscriptions={data.subscriptions}
          invoicesByOrg={data.invoicesByOrg}
          eventsByOrg={data.eventsByOrg}
        />
      )}

      {/* ═══ SUBSCRIPTION DRAWER ═══ */}
      {drawerOrgData && (
        <SubscriptionDrawer
          data={data} drawerOrg={drawerOrgData} packages={data.packages}
          onClose={() => setDrawerOrgData(null)}
          execAction={execAction} triggeredSync={triggeredSync}
          actionLoading={actionLoading} refreshKey={refreshKey}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  SUBSCRIPTION DRAWER                    */
/* ════════════════════════════════════════ */

function SubscriptionDrawer({ data, drawerOrg, onClose, execAction, triggeredSync, actionLoading, packages, refreshKey }: {
  data: Data; drawerOrg: any; onClose: () => void;
  execAction: (fn: any, input: any, label: string, msg: string) => void;
  triggeredSync: (orgId: string) => void; actionLoading: string | null; packages: any[]; refreshKey: number;
}) {
  const { org, sub, pkg } = drawerOrg;
  const [tab, setTab] = useState<"overview" | "invoices" | "events" | "addons" | "scheduled">("overview");
  const [modal, setModal] = useState<any>(null);
  const invoices = (data.invoicesByOrg[org.id] ?? []) as any[];
  const events = (data.eventsByOrg[org.id] ?? []) as any[];
  const availableAddons = (pkg?.id ? data.availableAddons.filter((addon: any) => addon.package_id === pkg.id && addon.is_active) : []) as any[];
  const assignedAddons = (sub?.id ? data.subAddonsBySub[sub.id] ?? [] : []) as any[];
  const scheduledChanges = (sub?.id ? data.schedChangesBySub[sub.id] ?? [] : []) as any[];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface border-l border-border shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div><h2 className="text-lg font-black">{org.name}</h2><p className="text-xs text-muted-foreground flex items-center gap-2">{pkg ? <span className="font-semibold text-indigo-600">{pkg.name}</span> : <span className="text-gray-500">No plan</span>}{sub && <StatusBadge status={sub.status} />}{sub?.billing_period && <span className="capitalize">· {sub.billing_period}</span>}</p></div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent/10" type="button"><X className="size-5" /></button>
        </div>

        <div className="flex border-b border-border bg-accent/5 px-5">
          {[{ id: "overview", label: "Overview", icon: CreditCard }, { id: "invoices", label: `Invoices (${invoices.length})`, icon: Receipt }, { id: "addons", label: "Add-ons", icon: Puzzle }, { id: "scheduled", label: "Scheduled", icon: Calendar }, { id: "events", label: "Events", icon: History }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={cn("px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} type="button"><t.icon className="size-3.5" />{t.label}</button>
          ))}
        </div>

        {/* ─── OVERVIEW ─── */}
        {tab === "overview" && (
          <div className="p-5 space-y-5" key={refreshKey}>
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <p className="text-xs font-black uppercase text-muted-foreground">Subscription Details</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Detail label="Plan" value={pkg?.name ?? "—"} /><Detail label="Status" value={sub?.status ?? "—"} />
                <Detail label="Billing Cycle" value={sub?.billing_period ? sub.billing_period.charAt(0).toUpperCase() + sub.billing_period.slice(1) : "—"} />
                <Detail label="Price" value={sub ? `₹${Intl.NumberFormat("en-IN").format(Math.round((sub.price_override ?? pkg?.price ?? 0) / 100))}/mo` : "—"} />
                <Detail label="Started" value={sub?.started_at ? new Date(sub.started_at).toLocaleDateString("en-IN") : "—"} />
                <Detail label="Next Billing" value={sub?.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString("en-IN") : sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"} />
                {sub?.trial_ends_at && <Detail label="Trial Ends" value={`${new Date(sub.trial_ends_at).toLocaleDateString("en-IN")}${new Date(sub.trial_ends_at) > new Date() ? ` (${Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000)}d left)` : " (expired)"}`} />}
                {sub?.cancelled_at && <Detail label="Cancelled" value={new Date(sub.cancelled_at).toLocaleDateString("en-IN")} />}
              </div>
              {!org.billing_email && sub && <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800"><AlertTriangle className="size-3.5 shrink-0 mt-0.5" /><span>Missing billing email — invoicing disabled</span></div>}
              {sub?.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">Notes: {sub.notes}</p>}
            </div>

            {sub && (
              <>
                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <p className="text-xs font-black uppercase text-muted-foreground">Plan Change</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ActionBtn icon={<ArrowUpDown className="size-3" />} label="Change Plan" onClick={() => setModal({ type: "change_plan" })} loading={false} />
                    <ActionBtn icon={<Calendar className="size-3" />} label="Schedule Change" onClick={() => setModal({ type: "schedule" })} loading={false} />
                    <ActionBtn icon={<CreditCard className="size-3" />} label="Override Price" onClick={() => setModal({ type: "override_price" })} loading={false} />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <p className="text-xs font-black uppercase text-muted-foreground">Lifecycle</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ActionBtn icon={<RefreshCw className="size-3" />} label="Sync Entitlements" onClick={() => triggeredSync(org.id)} loading={actionLoading === `sync-${org.id}`} />
                    {sub.status === "active" && <ActionBtn icon={<Ban className="size-3" />} label="Cancel" onClick={() => setModal({ type: "cancel" })} loading={false} />}
                    {(sub.status === "cancelled" || sub.status === "expired") && <ActionBtn icon={<Play className="size-3" />} label="Reactivate" onClick={() => setModal({ type: "reactivate" })} loading={false} />}
                    {sub.status === "trial" && <ActionBtn icon={<Clock className="size-3" />} label="Extend Trial" onClick={() => setModal({ type: "extend_trial" })} loading={false} />}
                    {sub.status === "trial" && <ActionBtn icon={<Check className="size-3" />} label="Convert to Paid" onClick={() => setModal({ type: "convert_trial" })} loading={false} />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── INVOICES ─── */}
        {tab === "invoices" && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Invoices & Payments</p>
            {invoices.length === 0 ? <div className="py-12 text-center text-muted-foreground text-sm">No invoices yet</div>
            : invoices.map((inv: any) => (
              <div key={inv.id} className="rounded-lg border border-border bg-background p-3 space-y-1.5">
                <div className="flex items-center justify-between"><span className="text-xs font-bold">{inv.invoice_number ?? "—"}</span><span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border", inv.paid_at ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{inv.paid_at ? "Paid" : inv.status}</span></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>₹{Intl.NumberFormat("en-IN").format(Math.round((inv.total_amount ?? inv.subtotal_amount ?? 0) / 100))} {inv.currency}</span><span suppressHydrationWarning>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("en-IN") : "—"} · Due {inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN") : "—"}</span></div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">{inv.tax_amount > 0 && <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-blue-700">GST</span>}{inv.razorpay_order_id && <span className="font-mono text-muted-foreground truncate max-w-[200px]">Order: {inv.razorpay_order_id}</span>}{!inv.paid_at && inv.due_at && new Date(inv.due_at) < new Date() && <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-red-700">Overdue</span>}</div>
              </div>
            ))}
          </div>
        )}

        {/* ─── ADD-ONS ─── */}
        {tab === "addons" && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-muted-foreground">Add-ons ({assignedAddons.length})</p><button onClick={() => setModal({ type: "assign_addon" })} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold hover:bg-primary/20" type="button"><Plus className="size-3" /> Assign</button></div>
            {!sub ? <div className="py-8 text-center text-muted-foreground text-sm">Assign a plan first</div> : assignedAddons.length === 0 && availableAddons.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">No add-ons configured for this package.</div> : (
              <div className="space-y-2">
                {assignedAddons.map((sa: any) => {
                  const addon = availableAddons.find((a: any) => a.id === sa.addon_id);
                  return (
                    <div key={sa.id} className="rounded-lg border border-border bg-background p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold">{addon?.name ?? sa.addon_id}</p>
                        <p className="text-[10px] text-muted-foreground">Qty: {sa.quantity} · ₹{Intl.NumberFormat("en-IN").format(Math.round((sa.unit_price ?? 0) / 100))}/mo</p>
                      </div>
                      <button onClick={() => setModal({ type: "remove_addon", assignedAddon: sa, addon })} className="rounded-md p-1 text-muted-foreground hover:text-red-600" type="button" aria-label="Remove"><Trash2 className="size-3.5" /></button>
                    </div>
                  );
                })}
                {availableAddons.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Available Add-ons</p>
                    {availableAddons.filter((a: any) => a.is_active !== false && !assignedAddons.find((s: any) => s.addon_id === a.id)).map((addon: any) => (
                      <div key={addon.id} className="flex items-center justify-between rounded-md border border-dashed border-border bg-surface-muted/30 p-2 text-xs">
                        <span>{addon.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((addon.unit_price ?? 0) / 100))}/mo</span>
                        <button onClick={() => setModal({ type: "assign_addon" })} className="text-primary underline" type="button">Assign</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── SCHEDULED ─── */}
        {tab === "scheduled" && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Scheduled Changes ({scheduledChanges.length})</p>
            {scheduledChanges.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">No scheduled changes. Use Schedule Change in Overview to create one.</div>
            ) : scheduledChanges.map((sc: any) => {
              const fromPkg = packages.find((p: any) => p.id === sc.from_package_id);
              const toPkg = packages.find((p: any) => p.id === sc.to_package_id);
              return (
                <div key={sc.id} className="rounded-lg border border-border bg-background p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border", sc.status === "pending" ? "bg-blue-50 text-blue-700 border-blue-200" : sc.status === "applied" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200")}>{sc.status}</span>
                    <span className="text-[10px] font-bold capitalize">{sc.change_type}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>{fromPkg?.name ?? "—"} → {toPkg?.name ?? "—"}</span>
                    <span className="text-muted-foreground" suppressHydrationWarning>{sc.effective_date ? new Date(sc.effective_date).toLocaleDateString("en-IN") : "—"}</span>
                  </div>
                  {sc.reason && <p className="text-[10px] text-muted-foreground">{sc.reason}</p>}
                  {sc.status === "pending" && (
                    <button onClick={() => setModal({ type: "cancel_scheduled", change: sc })} className="text-[10px] text-red-600 underline" type="button">Cancel</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── EVENTS ─── */}
        {tab === "events" && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Audit Timeline</p>
            {events.length === 0 ? <div className="py-12 text-center text-muted-foreground text-sm">No events recorded</div>
            : events.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-3">
                <div className={cn("mt-1 size-2 rounded-full shrink-0", ev.event_type?.includes("failed") || ev.event_type?.includes("error") ? "bg-red-500" : ev.event_type?.includes("created") || ev.event_type?.includes("approved") || ev.event_type?.includes("succeeded") ? "bg-green-500" : "bg-blue-500")} />
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold">{ev.event_type ?? "event"}</p><p className="text-[11px] text-muted-foreground truncate">{ev.reason ?? ev.actor_id ? `Actor: ${ev.actor_id}` : "—"}</p><p className="text-[10px] text-muted-foreground" suppressHydrationWarning>{ev.created_at ? new Date(ev.created_at).toLocaleString("en-IN") : "—"}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ MODALS ═══ */}
      {modal?.type === "change_plan" && sub && <ChangePlanModal sub={sub} pkg={pkg} packages={packages} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "cancel" && sub && <CancelModal sub={sub} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "reactivate" && sub && <ReactivateModal sub={sub} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "extend_trial" && sub && <ExtendTrialModal sub={sub} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "convert_trial" && sub && <ConvertTrialModal sub={sub} packages={packages} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "override_price" && sub && <OverridePriceModal sub={sub} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "schedule" && sub && <ScheduleModal sub={sub} pkg={pkg} packages={packages} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "assign_addon" && sub && <AssignAddonModal sub={sub} orgId={org.id} availableAddons={availableAddons} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "remove_addon" && sub && <RemoveAddonModal assignedAddon={modal.assignedAddon} addon={modal.addon} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
      {modal?.type === "cancel_scheduled" && sub && <CancelScheduledModal change={modal.change} orgId={org.id} onClose={() => setModal(null)} execAction={execAction} actionLoading={actionLoading} />}
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  ACTION MODALS — MFA + Reason + Audit   */
/* ════════════════════════════════════════ */

function ChangePlanModal({ sub, pkg, packages, orgId, onClose, execAction, actionLoading }: any) {
  const [targetId, setTargetId] = useState(""); const [reason, setReason] = useState("");
  const targetPkg = packages.find((p: any) => p.id === targetId);
  const isDowngrade = targetPkg && pkg && targetPkg.sort_order < pkg.sort_order;
  const handleSubmit = () => { if (!targetId) return; showToast("Change submitted", "success"); execAction(isDowngrade ? downgradePlanAction : upgradePlanAction, { subscriptionId: sub.id, newPackageId: targetId, reason: reason || undefined }, "change_plan", `Changed to ${targetPkg?.name}`); onClose(); };
  const higherPlans = packages.filter((p: any) => p.is_active && p.id !== pkg?.id && p.sort_order > (pkg?.sort_order ?? 0));
  const lowerPlans = packages.filter((p: any) => p.is_active && p.id !== pkg?.id && p.sort_order < (pkg?.sort_order ?? 999));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-black">{isDowngrade ? "Downgrade" : "Change Plan"}</h3><button onClick={onClose} className="rounded-md p-1 hover:bg-accent/10" type="button"><X className="size-4" /></button></div>
        <p className="text-sm text-muted-foreground mb-4">Current: <span className="font-bold">{pkg?.name}</span></p>
        <div className="space-y-3">
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
            <option value="">Select target...</option>
            {higherPlans.map((p: any) => <option key={p.id} value={p.id}>↑ {p.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((p.price ?? 0) / 100))}/mo</option>)}
            {lowerPlans.length > 0 && <option disabled>───</option>}
            {lowerPlans.map((p: any) => <option key={p.id} value={p.id}>↓ {p.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((p.price ?? 0) / 100))}/mo</option>)}
          </select>
          {isDowngrade && <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-start gap-2"><AlertTriangle className="size-3.5 shrink-0 mt-0.5" />Downgrade may remove access to features in the current plan.</div>}
          {targetPkg && <div className="rounded-md bg-accent/5 p-2 text-xs space-y-1"><p><span className="font-semibold">New:</span> {targetPkg.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((targetPkg.price ?? 0) / 100))}/mo</p>{targetPkg._limits?.max_members > 0 && <p><span className="font-semibold">Members:</span> {targetPkg._limits?.max_members === -1 ? "Unlimited" : targetPkg._limits?.max_members}</p>}</div>}
          <div><label className="text-xs font-black uppercase text-muted-foreground">Reason</label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Optional reason..." /></div>
          <InlineMfaStepUp compact />
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!targetId || !!actionLoading} className="gap-2">{actionLoading === "change_plan" ? <Loader2 className="size-4 animate-spin" /> : null}{isDowngrade ? "Downgrade" : "Upgrade"}</Button></div>
        </div>
      </div>
    </div>
  );
}

function CancelModal({ sub, orgId, onClose, execAction, actionLoading }: any) {
  const [reason, setReason] = useState(""); const [stepUpEmail, setStepUpEmail] = useState(""); const [cancelType, setCancelType] = useState<"immediate" | "end_of_period">("end_of_period"); const [retention, setRetention] = useState(90); const [mfaDone, setMfaDone] = useState(false);
  const handleSubmit = () => { if (reason.length < 10 || !stepUpEmail) return; execAction(cancelSubscriptionAction, { subscriptionId: sub.id, organizationId: orgId, cancelType, reason, dataRetentionDays: retention, stepUpEmail }, "cancel", "Cancelled"); onClose(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-red-200 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4"><div className="rounded-full bg-red-50 p-2"><Ban className="size-5 text-red-600" /></div><div><h3 className="text-lg font-black">Cancel Subscription</h3><p className="text-xs text-muted-foreground">Step-up verification + reason required</p></div></div>
        <div className="space-y-3">
          <select value={cancelType} onChange={(e) => setCancelType(e.target.value as any)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"><option value="end_of_period">End of billing period</option><option value="immediate">Immediate</option></select>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Reason (min 10 chars)..." />
          <input type="number" value={retention} onChange={(e) => setRetention(Number(e.target.value))} min={0} max={365} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Data retention days" />
          <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Super Admin email (step-up)" />
          {!mfaDone && <InlineMfaStepUp compact />}
          <button onClick={() => setMfaDone(true)} className="text-xs text-primary underline" type="button">MFA verified, continue</button>
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="destructive" onClick={handleSubmit} disabled={reason.length < 10 || !stepUpEmail || !mfaDone || !!actionLoading} className="gap-2">{actionLoading === "cancel" ? <Loader2 className="size-4 animate-spin" /> : null}Cancel</Button></div>
        </div>
      </div>
    </div>
  );
}

function ReactivateModal({ sub, orgId, onClose, execAction, actionLoading }: any) {
  const [reason, setReason] = useState(""); const [stepUpEmail, setStepUpEmail] = useState(""); const [mfaDone, setMfaDone] = useState(false);
  const handleSubmit = () => { if (!stepUpEmail) return; execAction(reactivateSubscriptionAction, { subscriptionId: sub.id, organizationId: orgId, stepUpEmail, reason: reason || undefined }, "reactivate", "Reactivated"); onClose(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-green-200 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4"><div className="rounded-full bg-green-50 p-2"><Play className="size-5 text-green-600" /></div><div><h3 className="text-lg font-black">Reactivate</h3></div></div>
        <div className="space-y-3">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Reason" />
          <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Super Admin email" />
          {!mfaDone && <InlineMfaStepUp compact />}
          <button onClick={() => setMfaDone(true)} className="text-xs text-primary underline" type="button">MFA verified</button>
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!stepUpEmail || !mfaDone || !!actionLoading} className="gap-2">{actionLoading === "reactivate" ? <Loader2 className="size-4 animate-spin" /> : null}Reactivate</Button></div>
        </div>
      </div>
    </div>
  );
}

function ExtendTrialModal({ sub, orgId, onClose, execAction, actionLoading }: any) {
  const currentEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
  const defaultEnd = new Date(currentEnd); defaultEnd.setDate(defaultEnd.getDate() + 14);
  const [newEndDate, setNewEndDate] = useState(defaultEnd.toISOString().slice(0, 10)); const [reason, setReason] = useState("");
  const handleSubmit = () => { execAction(extendTrialAction, { subscriptionId: sub.id, organizationId: orgId, newTrialEndDate: new Date(newEndDate).toISOString(), reason: reason || undefined }, "extend_trial", "Trial extended"); onClose(); };
  const addedDays = Math.round((new Date(newEndDate).getTime() - currentEnd.getTime()) / 86400000);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-1">Extend Trial</h3><p className="text-sm text-muted-foreground mb-4">Current end: {currentEnd.toLocaleDateString("en-IN")}</p>
        <div className="space-y-3">
          <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" />
          {addedDays > 0 && <p className="text-xs text-green-600 font-semibold">+{addedDays} day{addedDays !== 1 ? "s" : ""}</p>}
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Reason" />
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!newEndDate || !!actionLoading} className="gap-2">{actionLoading === "extend_trial" ? <Loader2 className="size-4 animate-spin" /> : null}Extend</Button></div>
        </div>
      </div>
    </div>
  );
}

function ConvertTrialModal({ sub, packages, onClose, execAction, actionLoading }: any) {
  const [pkgId, setPkgId] = useState("");
  const handleSubmit = () => { if (!pkgId) return; execAction(convertTrialAction, { subscriptionId: sub.id, packageId: pkgId }, "convert_trial", "Converted"); onClose(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">Convert to Paid</h3>
        <select value={pkgId} onChange={(e) => setPkgId(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
          <option value="">Select package...</option>{packages.filter((p: any) => p.is_active).map((p: any) => <option key={p.id} value={p.id}>{p.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((p.price ?? 0) / 100))}/mo</option>)}
        </select>
        <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!pkgId || !!actionLoading} className="gap-2">{actionLoading === "convert_trial" ? <Loader2 className="size-4 animate-spin" /> : null}Convert</Button></div>
      </div>
    </div>
  );
}

function OverridePriceModal({ sub, orgId, onClose, execAction, actionLoading }: any) {
  const [price, setPrice] = useState(sub?.price_override ?? ""); const [reason, setReason] = useState(""); const [stepUpEmail, setStepUpEmail] = useState("");
  const handleSubmit = () => {
    if (!price || reason.trim().length < 10 || !stepUpEmail) return;
    execAction(overrideSubscriptionPriceAction, { subscriptionId: sub.id, organizationId: orgId, overrideAmount: Number(price), currency: "INR", reason, stepUpEmail }, "override_price", "Price updated");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-1">Override Price</h3><p className="text-sm text-muted-foreground mb-4">Current: ₹{Intl.NumberFormat("en-IN").format(Math.round((sub.price_override ?? 0) / 100))}/mo</p>
        <div className="space-y-3">
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="New price in paise" />
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Reason for override (min 10 chars)" />
          <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Super Admin email (step-up)" />
          <InlineMfaStepUp compact />
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!price || reason.trim().length < 10 || !stepUpEmail || !!actionLoading} className="gap-2">{actionLoading === "override_price" ? <Loader2 className="size-4 animate-spin" /> : null}Override</Button></div>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ sub, pkg, packages, orgId, onClose, execAction, actionLoading }: any) {
  const [targetId, setTargetId] = useState(""); const [effectiveDate, setEffectiveDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); }); const [reason, setReason] = useState("");
  const targetPkg = packages.find((p: any) => p.id === targetId);
  const handleSubmit = () => { if (!targetId || !effectiveDate) return; const isUpgrade = targetPkg?.sort_order > (pkg?.sort_order ?? 0); execAction(scheduleChangeAction, { subscriptionId: sub.id, organizationId: orgId, fromPackageId: pkg?.id, toPackageId: targetId, changeType: isUpgrade ? "upgrade" : "downgrade", effectiveDate: new Date(effectiveDate).toISOString(), reason: reason || undefined }, "schedule", `Scheduled for ${new Date(effectiveDate).toLocaleDateString("en-IN")}`); onClose(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">Schedule Plan Change</h3><p className="text-sm text-muted-foreground mb-4">Current: {pkg?.name}</p>
        <div className="space-y-3">
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"><option value="">Select target...</option>{packages.filter((p: any) => p.is_active && p.id !== pkg?.id).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" />
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Reason" />
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!targetId || !effectiveDate || !!actionLoading} className="gap-2">{actionLoading === "schedule" ? <Loader2 className="size-4 animate-spin" /> : null}Schedule</Button></div>
        </div>
      </div>
    </div>
  );
}

function AssignAddonModal({ sub, orgId, availableAddons, onClose, execAction, actionLoading }: any) {
  const [addonId, setAddonId] = useState(availableAddons?.[0]?.id ?? ""); const [qty, setQty] = useState(1); const [reason, setReason] = useState("");
  const selectedAddon = availableAddons?.find((a: any) => a.id === addonId);
  const handleSubmit = () => {
    if (!addonId || reason.trim().length < 5) return;
    execAction(assignAddonAction, { subscriptionId: sub.id, organizationId: orgId, addonId, quantity: qty, reason }, "assign_addon", "Add-on assigned");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">Assign Add-on</h3>
        <div className="space-y-3">
          {availableAddons?.filter((a: any) => a.is_active !== false).length > 0 ? (
            <select value={addonId} onChange={(e) => setAddonId(e.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
              {availableAddons.filter((a: any) => a.is_active !== false).map((a: any) => <option key={a.id} value={a.id}>{a.name} — ₹{Intl.NumberFormat("en-IN").format(Math.round((a.unit_price ?? 0) / 100))}/mo{a.max_quantity > 0 ? ` (max ${a.max_quantity})` : ""}</option>)}
            </select>
          ) : <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No active add-ons are configured for this package.</div>}
          {selectedAddon?.max_quantity > 0 && <p className="text-xs text-muted-foreground">Max quantity: {selectedAddon.max_quantity}{selectedAddon.description ? ` · ${selectedAddon.description}` : ""}</p>}
          <div className="flex items-center gap-3"><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} min={1} max={selectedAddon?.max_quantity || 999} className="h-11 w-24 rounded-md border border-border bg-surface px-3 text-sm" /><span className="text-xs text-muted-foreground">× ₹{Intl.NumberFormat("en-IN").format(Math.round((selectedAddon?.unit_price ?? 0) / 100))} = ₹{Intl.NumberFormat("en-IN").format(Math.round((selectedAddon?.unit_price ?? 0) * qty / 100))}/mo</span></div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Reason for assigning add-on" />
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!addonId || reason.trim().length < 5 || !!actionLoading} className="gap-2">{actionLoading === "assign_addon" ? <Loader2 className="size-4 animate-spin" /> : null}Assign</Button></div>
        </div>
      </div>
    </div>
  );
}

function RemoveAddonModal({ assignedAddon, addon, orgId, onClose, execAction, actionLoading }: any) {
  const [reason, setReason] = useState("");
  const handleSubmit = () => {
    if (!assignedAddon?.id || reason.trim().length < 5) return;
    execAction(removeAddonAction, { assignedAddonId: assignedAddon.id, organizationId: orgId, reason }, "remove_addon", "Add-on removed");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-1">Remove Add-on</h3>
        <p className="text-sm text-muted-foreground mb-4">{addon?.name ?? assignedAddon?.addon_id ?? "Selected add-on"} · Qty {assignedAddon?.quantity ?? 0}</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1" placeholder="Reason for removing add-on" />
        <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="destructive" onClick={handleSubmit} disabled={reason.trim().length < 5 || !!actionLoading} className="gap-2">{actionLoading === "remove_addon" ? <Loader2 className="size-4 animate-spin" /> : null}Remove</Button></div>
      </div>
    </div>
  );
}

function CancelScheduledModal({ change, orgId, onClose, execAction, actionLoading }: any) {
  const [reason, setReason] = useState("");
  const handleSubmit = () => {
    if (!change?.id || reason.trim().length < 5) return;
    execAction(cancelScheduledChangeAction, { changeId: change.id, organizationId: orgId, reason }, "cancel_scheduled", "Scheduled change cancelled");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-1">Cancel Scheduled Change</h3>
        <p className="text-sm text-muted-foreground mb-4">This will cancel the pending {change?.change_type ?? "plan"} change.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1" placeholder="Reason for cancellation" />
        <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Back</Button><Button type="button" variant="destructive" onClick={handleSubmit} disabled={reason.trim().length < 5 || !!actionLoading} className="gap-2">{actionLoading === "cancel_scheduled" ? <Loader2 className="size-4 animate-spin" /> : null}Cancel Change</Button></div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  HELPERS                                 */
/* ════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: "border-green-200 bg-green-50 text-green-700", trial: "border-blue-200 bg-blue-50 text-blue-700", expired: "border-red-200 bg-red-50 text-red-700", suspended: "border-orange-200 bg-orange-50 text-orange-800", cancelled: "border-slate-200 bg-slate-50 text-slate-700", unassigned: "border-gray-200 bg-gray-50 text-gray-500" };
  return <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + (colors[status?.toLowerCase()] ?? "border-border bg-surface-muted text-muted-foreground")}>{status ?? "unknown"}</span>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><span className="text-muted-foreground text-[11px]">{label}</span><p className="font-semibold text-sm">{value}</p></div>; }

function ActionBtn({ icon, label, onClick, loading }: { icon: React.ReactNode; label: string; onClick: () => void; loading: boolean }) {
  return <button onClick={onClick} disabled={loading} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-accent/10 disabled:opacity-50" type="button">{loading ? <Loader2 className="size-3 animate-spin" /> : icon}{label}</button>;
}
