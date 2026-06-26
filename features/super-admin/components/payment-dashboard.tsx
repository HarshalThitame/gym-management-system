"use client";

import { useState, useMemo } from "react";
import { CreditCard, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Search, FileText, Copy, RefreshCw, BarChart3, Ban, Eye, ExternalLink, CalendarPlus, PauseCircle, Play, RotateCcw, RefreshCw as RetryIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/features/billing/lib/money";
import { retrySubscriptionPaymentAction, extendGracePeriodAction, suspendSubscriptionForNonPaymentAction, reactivateAfterPaymentAction } from "@/features/super-admin/actions/dunning-actions";

type PaymentDashboardProps = {
  organizations: any[];
  packages: any[];
  subscriptions: any[];
  invoicesByOrg: Record<string, any[]>;
  eventsByOrg: Record<string, any[]>;
};

const PAGE_SIZES = [25, 50, 100];

/* ─── Normalize MRR ─── */
function computeMrr(price: number, period: string): number {
  if (!price) return 0;
  const divisors: Record<string, number> = { monthly: 1, quarterly: 3, half_yearly: 6, annual: 12, yearly: 12 };
  return Math.round(price / (divisors[period] || 1));
}

export function PaymentDashboard({ organizations, packages, subscriptions, invoicesByOrg, eventsByOrg }: PaymentDashboardProps) {
  const [tab, setTab] = useState<"overview" | "invoices" | "webhooks" | "dunning" | "reconciliation" | "risks">("overview");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [dunningModal, setDunningModal] = useState<{ type: string; invoice: any } | null>(null);
  const [dunningLoading, setDunningLoading] = useState<string | null>(null);

  // Compute all invoices flat list
  const allInvoices = useMemo(() => Object.values(invoicesByOrg).flat(), [invoicesByOrg]);
  const allEvents = useMemo(() => Object.values(eventsByOrg).flat(), [eventsByOrg]);
  const webhookEvents = useMemo(() => allEvents.filter((e: any) => e.event_type?.includes("webhook") || e.metadata?.source === "webhook"), [allEvents]);

  // Dunning metrics
  const dunningCases = allInvoices.filter((i: any) => i.dunning_status && i.dunning_status !== "none");
  const dunningFailed = allInvoices.filter((i: any) => i.dunning_status === "payment_failed");
  const dunningOverdue = allInvoices.filter((i: any) => i.dunning_status === "overdue");
  const dunningGrace = allInvoices.filter((i: any) => i.dunning_status === "grace_period");
  const dunningSuspended = allInvoices.filter((i: any) => i.dunning_status === "suspended");
  const dunningTotalAmount = dunningCases.reduce((s: number, i: any) => s + (i.total_amount ?? i.subtotal_amount ?? 0), 0);

  // Metrics
  const paidInvoices = allInvoices.filter((i: any) => i.status === "paid");
  const pendingInvoices = allInvoices.filter((i: any) => i.status === "issued" || i.status === "pending");
  const failedInvoices = allInvoices.filter((i: any) => i.status === "failed");
  const overdueInvoices = allInvoices.filter((i: any) => (i.status === "issued" || i.status === "pending") && i.due_at && new Date(i.due_at) < new Date());
  const totalPaid = paidInvoices.reduce((s: number, i: any) => s + (i.total_amount ?? i.subtotal_amount ?? 0), 0);
  const totalPending = pendingInvoices.reduce((s: number, i: any) => s + (i.total_amount ?? i.subtotal_amount ?? 0), 0);
  const totalFailed = failedInvoices.reduce((s: number, i: any) => s + (i.total_amount ?? i.subtotal_amount ?? 0), 0);

  // MRR/ARR from active subscriptions (normalized)
  const activeSubs = subscriptions.filter((s: any) => s.status === "active");
  const mrr = activeSubs.reduce((sum: number, s: any) => {
    const pkg = packages.find((p: any) => p.id === s.package_id);
    const price = s.price_override ?? pkg?.price ?? 0;
    const period = s.billing_period || pkg?.billing_period || "monthly";
    return sum + computeMrr(price, period);
  }, 0);

  // Webhook health
  const successfulWebhooks = webhookEvents.filter((e: any) => e.status === "processed" || e.event_type === "webhook_processed").length;
  const failedWebhooks = webhookEvents.filter((e: any) => e.event_type?.includes("failed") || e.status === "failed").length;
  const lastWebhook = webhookEvents.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let list = allInvoices;
    if (search) { const q = search.toLowerCase(); list = list.filter((i: any) => i.invoice_number?.toLowerCase().includes(q) || i.razorpay_order_id?.toLowerCase().includes(q) || i.razorpay_payment_id?.toLowerCase().includes(q)); }
    if (statusFilter !== "all") list = list.filter((i: any) => i.status === statusFilter);
    return list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allInvoices, search, statusFilter]);

  const pageCount = Math.ceil(filteredInvoices.length / pageSize);
  const pagedInvoices = filteredInvoices.slice(page * pageSize, (page + 1) * pageSize);

  // Risks
  const risks = useMemo(() => {
    const r: { org: any; issue: string; severity: "risk" | "watch"; ref: string }[] = [];
    organizations.forEach((org: any) => {
      const s = subscriptions.find((x: any) => x.organization_id === org.id);
      const invs = invoicesByOrg[org.id] || [];
      const overdue = invs.filter((i: any) => (i.status === "issued" || i.status === "pending") && i.due_at && new Date(i.due_at) < new Date());
      overdue.forEach((inv: any) => r.push({ org, issue: "Overdue invoice", severity: "risk", ref: inv.invoice_number || inv.id }));
      if (!org.billing_email && s) r.push({ org, issue: "Missing billing email", severity: "risk", ref: "" });
      invs.filter((i: any) => i.status === "failed").forEach((inv: any) => r.push({ org, issue: "Failed payment", severity: "risk", ref: inv.invoice_number || inv.id }));
      const expiredTrial = s?.trial_ends_at && new Date(s.trial_ends_at) < new Date();
      if (expiredTrial && s?.status === "trial") r.push({ org, issue: "Trial expired, no payment", severity: "risk", ref: "" });
    });
    return r;
  }, [organizations, subscriptions, invoicesByOrg]);

  function getOrgName(orgId: string) {
    return organizations.find((o: any) => o.id === orgId)?.name ?? orgId.slice(0, 8);
  }

  function getPkgName(pkgId: string) {
    return packages.find((p: any) => p.id === pkgId)?.name ?? pkgId.slice(0, 8);
  }

  const copyToClipboard = (val: string) => { navigator.clipboard.writeText(val); showToast("Copied!", "success"); };

  /* ═══ RENDER ═══ */
  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {([{ key: "overview" as const, label: "Revenue & Metrics" }, { key: "invoices" as const, label: `Invoices (${allInvoices.length})` }, { key: "dunning" as const, label: `Dunning (${dunningCases.length})` }, { key: "reconciliation" as const, label: "Reconciliation" }, { key: "webhooks" as const, label: `Webhooks (${webhookEvents.length})` }, { key: "risks" as const, label: `Risks (${risks.length})` }]).map((t) => (
          <button key={t.key} className={cn("whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition", tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setTab(t.key)} role="tab" type="button">{t.label}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW / METRICS ═══ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Monthly Revenue (MRR)" value={formatCurrency(mrr)} detail={`From ${activeSubs.length} active subscriptions`} status="good" />
            <StatCard label="Annual Run Rate (ARR)" value={formatCurrency(mrr * 12)} detail="MRR × 12" status="good" />
            <StatCard label="Paid Invoices" value={String(paidInvoices.length)} detail={`${formatCurrency(totalPaid)} total collected`} status="good" />
            <StatCard label="Pending" value={String(pendingInvoices.length)} detail={`${formatCurrency(totalPending)} awaiting payment`} status={pendingInvoices.length > 0 ? "watch" : "good"} />
            <StatCard label="Failed Payments" value={String(failedInvoices.length)} detail={`${formatCurrency(totalFailed)} failed`} status={failedInvoices.length > 0 ? "risk" : "good"} />
            <StatCard label="Overdue" value={String(overdueInvoices.length)} detail="Past due date" status={overdueInvoices.length > 0 ? "risk" : "good"} />
            <StatCard label="Webhook Health" value={String(successfulWebhooks)} detail={`${failedWebhooks} failed · Last: ${lastWebhook ? new Date(lastWebhook.created_at).toLocaleDateString("en-IN") : "N/A"}`} status={failedWebhooks > 0 ? "watch" : "good"} />
            <StatCard label="Upcoming Renewals" value={String(subscriptions.filter((s: any) => s.next_billing_date && new Date(s.next_billing_date) > new Date() && new Date(s.next_billing_date).getTime() - Date.now() < 30 * 86400000).length)} detail="Within 30 days" status="good" />
          </div>

          {/* Dunning Cards */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
            <h3 className="text-sm font-black text-red-800 mb-3">Dunning & Overdue Operations</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-red-200 bg-white p-3"><p className="text-xs font-black uppercase text-red-600">Active Dunning</p><p className="text-xl font-black mt-1">{dunningCases.length}</p></div>
              <div className="rounded-lg border border-amber-200 bg-white p-3"><p className="text-xs font-black uppercase text-amber-600">Overdue</p><p className="text-xl font-black mt-1">{dunningOverdue.length}</p></div>
              <div className="rounded-lg border border-orange-200 bg-white p-3"><p className="text-xs font-black uppercase text-orange-600">Grace Period</p><p className="text-xl font-black mt-1">{dunningGrace.length}</p></div>
              <div className="rounded-lg border border-red-200 bg-white p-3"><p className="text-xs font-black uppercase text-red-600">Suspended</p><p className="text-xl font-black mt-1">{dunningSuspended.length}</p></div>
              <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs font-black uppercase text-gray-600">Total Dunning Amount</p><p className="text-xl font-black mt-1">{formatCurrency(dunningTotalAmount)}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INVOICES TABLE ═══ */}
      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search invoice, order, payment ID..." className="h-9 w-72 text-xs" />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="issued">Issued</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="overdue">Overdue</option>
            </select>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filteredInvoices.length} invoices</span>
          </div>

          <div className="rounded-xl border border-border bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Env</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Razorpay ID</th><th className="px-4 py-3">Due</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {pagedInvoices.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No invoices match your filters</td></tr> :
                pagedInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-accent/5">
                    <td className="px-4 py-3 font-semibold text-xs">{inv.invoice_number ?? inv.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{getOrgName(inv.organization_id)}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{formatCurrency(inv.total_amount ?? inv.subtotal_amount ?? 0)}</td>
                    <td className="px-4 py-3"><span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border", (inv.provider_environment ?? "test") === "live" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700")}>{inv.provider_environment ?? "test"}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {inv.razorpay_order_id && <button onClick={() => copyToClipboard(inv.razorpay_order_id)} className="text-[10px] font-mono text-muted-foreground truncate max-w-[100px] hover:text-foreground" type="button" title="Copy order ID">{inv.razorpay_order_id.slice(0, 16)}...</button>}
                        {!inv.razorpay_order_id && <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground" suppressHydrationWarning>{inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3"><button onClick={() => setSelectedInvoice(inv)} className="rounded-md p-1 text-muted-foreground hover:bg-accent/10" type="button"><Eye className="size-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 hover:bg-accent/10" type="button">Prev</button>
                <button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 hover:bg-accent/10" type="button">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ DUNNING ═══ */}
      {tab === "dunning" && (
        <div className="space-y-4">
          {/* Dunning Summary KPIs */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Active Dunning Cases</p><p className="text-2xl font-black mt-1">{dunningCases.length}</p></div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 border-l-4 border-l-red-500"><p className="text-xs font-black uppercase text-red-700">Past Grace Period</p><p className="text-2xl font-black mt-1 text-red-700">{dunningOverdue.length}</p></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 border-l-4 border-l-amber-500"><p className="text-xs font-black uppercase text-amber-700">Pending Retry Today</p><p className="text-2xl font-black mt-1 text-amber-700">{dunningCases.filter((i: any) => i.dunning_next_retry_at && new Date(i.dunning_next_retry_at) <= new Date()).length}</p></div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 border-l-4 border-l-green-500"><p className="text-xs font-black uppercase text-green-700">Recently Resolved</p><p className="text-2xl font-black mt-1 text-green-700">{allInvoices.filter((i: any) => i.dunning_status === "resolved" || i.dunning_status === "waived").length}</p></div>
          </div>

          {/* Dunning Case Cards */}
          <div className="space-y-3">
            {dunningCases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-12 text-center"><p className="text-sm text-muted-foreground">No dunning cases</p></div>
            ) : dunningCases.slice(0, 50).map((inv: any) => {
              const attempts = inv.dunning_attempts ?? 0;
              const isGrace = inv.dunning_status === "grace_period";
              const isFailed = inv.dunning_status === "payment_failed" || inv.dunning_status === "retry_scheduled";
              const isSuspended = inv.dunning_status === "suspended";
              const borderColor = isSuspended ? "border-l-red-500" : isGrace ? "border-l-green-500" : "border-l-amber-500";
              return (
                <div key={inv.id} className={`rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 border-l-4 ${borderColor} transition-all hover:shadow-md`}>
                  <div className="flex items-start justify-between">
                    <div>
                          <div className="text-sm font-black">{getOrgName(inv.organization_id)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {(inv.subscription_id ? getPkgName(subscriptions.find((s: any) => s.id === inv.subscription_id)?.package_id) : "") && <span>{getPkgName(subscriptions.find((s: any) => s.id === inv.subscription_id)?.package_id)} · </span>}
                            Invoice {inv.invoice_number ?? inv.id.slice(0, 8)} · Attempt {attempts}/3
                            {inv.dunning_next_retry_at && <span> · Next retry: {new Date(inv.dunning_next_retry_at).toLocaleDateString("en-IN")}</span>}
                            {inv.dunning_last_attempt_at && <span> · {Math.floor((Date.now() - new Date(inv.dunning_last_attempt_at).getTime()) / 86400000)}d since last attempt</span>}
                          </div>
                          <div className="mt-0.5 text-xs font-black text-destructive">{formatCurrency(inv.total_amount ?? inv.subtotal_amount ?? 0)} overdue</div>
                          {inv.dunning_last_failure_reason && <div className="mt-0.5 text-[10px] text-muted-foreground">{inv.dunning_last_failure_reason}</div>}
                          {inv.dunning_grace_period_ends_at && (
                            <div className="mt-0.5 text-[10px]">
                              <span className={new Date(inv.dunning_grace_period_ends_at) < new Date() ? "text-red-600 font-bold" : "text-amber-600"}>
                                Grace ends: {new Date(inv.dunning_grace_period_ends_at).toLocaleDateString("en-IN")}
                              </span>
                            </div>
                          )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isSuspended && (
                        <button onClick={async () => {
                          setDunningLoading(`retry-${inv.id}`);
                          const sub = subscriptions.find((s: any) => s.organization_id === inv.organization_id);
                          const result = await retrySubscriptionPaymentAction({ invoiceId: inv.id, subscriptionId: sub?.id ?? "", organizationId: inv.organization_id });
                          if (result.status === "success") {
                            const orderId = result.message?.replace("Retry order created: ", "") || "";
                            showToast(`Payment retry initiated. Order: ${orderId}`, "success");
                          } else {
                            showToast(result.message || "Retry failed", "error");
                          }
                          setDunningLoading(null);
                        }} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted transition-all grid place-items-center" title="Retry Payment" type="button">
                          {dunningLoading === `retry-${inv.id}` ? <Loader2 className="size-4 animate-spin" /> : <RetryIcon className="size-4" />}
                        </button>
                      )}
                      <button onClick={() => setDunningModal({ type: "extend_grace", invoice: inv })} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted transition-all grid place-items-center" title="Extend Grace Period" type="button">
                        <CalendarPlus className="size-4" />
                      </button>
                      {!isSuspended && (
                        <button onClick={() => setDunningModal({ type: "suspend", invoice: inv })} className="size-8 rounded-md border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 text-destructive transition-all grid place-items-center" title="Suspend for Non-Payment" type="button">
                          <PauseCircle className="size-4" />
                        </button>
                      )}
                      {isSuspended && (
                        <button onClick={() => setDunningModal({ type: "reactivate", invoice: inv })} className="size-8 rounded-md border border-border bg-background hover:bg-green-50 hover:border-green-300 text-green-600 transition-all grid place-items-center" title="Reactivate After Payment" type="button">
                          <Play className="size-4" />
                        </button>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ml-1 ${isSuspended ? "border-red-200 bg-red-50 text-red-700" : isGrace ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        {isSuspended ? "Suspended" : isGrace ? "Grace" : attempts >= 3 ? "Max Retries" : attempts > 0 ? `Retry ${attempts}` : "Failed"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ RECONCILIATION ═══ */}
      {tab === "reconciliation" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="text-xs font-black uppercase text-green-700">Matched</p><p className="text-2xl font-black mt-1 text-green-700">{paidInvoices.length}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Pending Review</p><p className="text-2xl font-black mt-1 text-amber-700">{pendingInvoices.length}</p></div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-700">Mismatch / Failed</p><p className="text-2xl font-black mt-1 text-red-700">{failedInvoices.length + overdueInvoices.length}</p></div>
          </div>

          <div className="rounded-xl border border-border bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Org</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Order ID</th><th className="px-4 py-3">Recon</th>
              </tr></thead>
              <tbody>
                {allInvoices.slice(0, 50).length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No invoices</td></tr> :
                allInvoices.slice(0, 50).map((inv: any) => {
                  const isMatched = inv.paid_at && inv.razorpay_payment_id;
                  const isUnmatched = inv.razorpay_order_id && !inv.paid_at;
                  return (
                    <tr key={inv.id} className="border-b border-border hover:bg-accent/5">
                      <td className="px-4 py-3 text-xs">{inv.invoice_number ?? inv.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-xs">{getOrgName(inv.organization_id)}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{formatCurrency(inv.total_amount ?? inv.subtotal_amount ?? 0)}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3"><StatusBadge status={inv.paid_at ? "paid" : inv.status} /></td>
                      <td className="px-4 py-3 text-[10px] font-mono">{inv.razorpay_order_id?.slice(0, 16) ?? "—"}</td>
                      <td className="px-4 py-3">
                        {isMatched ? <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">Matched</span> :
                         isUnmatched ? <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">Unmatched</span> :
                         <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">Pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ WEBHOOK HEALTH ═══ */}
      {tab === "webhooks" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs font-black uppercase text-muted-foreground">Total Webhooks</p><p className="text-2xl font-black mt-1">{webhookEvents.length}</p></div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="text-xs font-black uppercase text-green-700">Processed</p><p className="text-2xl font-black mt-1 text-green-700">{successfulWebhooks}</p></div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-700">Failed</p><p className="text-2xl font-black mt-1 text-red-700">{failedWebhooks}</p></div>
          </div>

          <div className="rounded-xl border border-border bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Event</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Error</th><th className="px-4 py-3">Date</th>
              </tr></thead>
              <tbody>
                {webhookEvents.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No webhook events received</td></tr> :
                webhookEvents.slice(0, 50).map((ev: any) => (
                  <tr key={ev.id} className="border-b border-border hover:bg-accent/5">
                    <td className="px-4 py-3 text-xs font-mono">{ev.event_id?.slice(0, 20) ?? ev.id.slice(0, 12)}</td>
                    <td className="px-4 py-3 text-xs">{ev.event_type ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={ev.status ?? ev.processing_status ?? "unknown"} /></td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground max-w-[200px] truncate">{ev.error_message ?? ev.processing_error ?? "—"}</td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground" suppressHydrationWarning>{ev.created_at ? new Date(ev.created_at).toLocaleString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ RISK QUEUE ═══ */}
      {tab === "risks" && (
        <div className="space-y-3">
          {risks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No payment risks detected</div>
          ) : risks.slice(0, 50).map((r, i) => (
            <div key={i} className={cn("rounded-lg border p-3 flex items-start gap-3", r.severity === "risk" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
              {r.severity === "risk" ? <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" /> : <Clock className="size-4 shrink-0 mt-0.5 text-amber-600" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{r.org.name}</p>
                <p className="text-xs text-muted-foreground">{r.issue}{r.ref ? ` · ${r.ref}` : ""}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", r.severity === "risk" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{r.severity}</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ DUNNING MODALS ═══ */}
      {dunningModal?.type === "extend_grace" && (
        <DunningExtendGraceModal
          invoice={dunningModal.invoice}
          organizations={organizations}
          subscriptions={subscriptions}
          onClose={() => setDunningModal(null)}
          onSuccess={() => { showToast("Grace period extended", "success"); setDunningModal(null); }}
        />
      )}
      {dunningModal?.type === "suspend" && (
        <DunningSuspendModal
          invoice={dunningModal.invoice}
          organizations={organizations}
          subscriptions={subscriptions}
          onClose={() => setDunningModal(null)}
          onSuccess={() => { showToast("Subscription suspended", "success"); setDunningModal(null); }}
        />
      )}
      {dunningModal?.type === "reactivate" && (
        <DunningReactivateModal
          invoice={dunningModal.invoice}
          organizations={organizations}
          subscriptions={subscriptions}
          onClose={() => setDunningModal(null)}
          onSuccess={() => { showToast("Subscription reactivated", "success"); setDunningModal(null); }}
        />
      )}

      {/* ═══ INVOICE DETAIL DRAWER ═══ */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelectedInvoice(null)}>
          <div className="w-full max-w-md bg-surface border-l border-border shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Invoice Details</h2>
              <button onClick={() => setSelectedInvoice(null)} className="rounded-md p-1 hover:bg-accent/10" type="button"><XClose className="size-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-border bg-background p-4 space-y-2 text-sm">
                <Row label="Invoice" value={selectedInvoice.invoice_number ?? "—"} />
                <Row label="Organization" value={getOrgName(selectedInvoice.organization_id)} />
                <Row label="Status" value={selectedInvoice.status} />
                <Row label="Subtotal" value={formatCurrency(selectedInvoice.subtotal_amount ?? 0)} />
                {selectedInvoice.tax_amount > 0 && <Row label="Tax" value={formatCurrency(selectedInvoice.tax_amount)} />}
                <Row label="Total" value={formatCurrency(selectedInvoice.total_amount ?? selectedInvoice.subtotal_amount ?? 0)} />
                <Row label="Currency" value={selectedInvoice.currency ?? "INR"} />
                <Row label="Billing Period" value={`${selectedInvoice.billing_period_start ? new Date(selectedInvoice.billing_period_start).toLocaleDateString("en-IN") : "—"} → ${selectedInvoice.billing_period_end ? new Date(selectedInvoice.billing_period_end).toLocaleDateString("en-IN") : "—"}`} />
                <Row label="Due" value={selectedInvoice.due_at ? new Date(selectedInvoice.due_at).toLocaleDateString("en-IN") : "—"} />
                <Row label="Paid" value={selectedInvoice.paid_at ? new Date(selectedInvoice.paid_at).toLocaleDateString("en-IN") : "—"} />
                <Row label="Razorpay Order" value={selectedInvoice.razorpay_order_id ?? "—"} />
                <Row label="Razorpay Payment" value={selectedInvoice.razorpay_payment_id ?? "—"} />
                <Row label="Billing Cycle" value={selectedInvoice.billing_cycle ?? "—"} />
                <Row label="Provider" value={selectedInvoice.provider ?? "razorpay"} />
                <Row label="Environment" value={selectedInvoice.provider_environment ?? "test"} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ DUNNING MODAL COMPONENTS ═══ */

function DunningExtendGraceModal({ invoice, organizations, subscriptions, onClose, onSuccess }: {
  invoice: any; organizations: any[]; subscriptions: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [newGraceDate, setNewGraceDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState("");
  const orgName = organizations.find((o: any) => o.id === invoice.organization_id)?.name ?? invoice.organization_id.slice(0, 8);

  const handleSubmit = async () => {
    if (!newGraceDate || !reason.trim()) { showToast("Date and reason required", "error"); return; }
    setLoading(true);
    const sub = subscriptions.find((s: any) => s.organization_id === invoice.organization_id);
    const result = await extendGracePeriodAction({
      subscriptionId: sub?.id ?? "", invoiceId: invoice.id, organizationId: invoice.organization_id,
      newGraceEndDate: new Date(newGraceDate).toISOString(), reason: reason.trim(),
    });
    setLoading(false);
    if (result.status === "success") onSuccess(); else showToast(result.message || "Failed", "error");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">Extend Grace Period</h3>
        <p className="text-sm text-muted-foreground mb-4">{orgName} · Invoice {invoice.invoice_number ?? invoice.id.slice(0, 8)}</p>
        <div className="space-y-3">
          <div><label className="text-xs font-black uppercase text-muted-foreground">New Grace End Date</label><input type="date" value={newGraceDate} onChange={(e) => setNewGraceDate(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" /></div>
          <div><label className="text-xs font-black uppercase text-muted-foreground">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 h-20 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Reason for extension..." /></div>
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!newGraceDate || !reason.trim() || loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : null}Extend</Button></div>
        </div>
      </div>
    </div>
  );
}

function DunningSuspendModal({ invoice, organizations, subscriptions, onClose, onSuccess }: {
  invoice: any; organizations: any[]; subscriptions: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const orgName = organizations.find((o: any) => o.id === invoice.organization_id)?.name ?? invoice.organization_id.slice(0, 8);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) { showToast("Reason must be at least 10 characters", "error"); return; }
    if (confirmText !== "SUSPEND") { showToast('Type "SUSPEND" to confirm', "error"); return; }
    setLoading(true);
    const sub = subscriptions.find((s: any) => s.organization_id === invoice.organization_id);
    const result = await suspendSubscriptionForNonPaymentAction({
      subscriptionId: sub?.id ?? "", invoiceId: invoice.id, organizationId: invoice.organization_id, reason: reason.trim(),
    });
    setLoading(false);
    if (result.status === "success") onSuccess(); else showToast(result.message || "Failed", "error");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-red-200 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4"><div className="rounded-full bg-red-50 p-2"><AlertTriangle className="size-5 text-red-600" /></div><div><h3 className="text-lg font-black">Suspend for Non-Payment</h3><p className="text-xs text-muted-foreground">This will block all organization users</p></div></div>
        <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4"><p className="text-xs text-red-800 font-semibold">Suspending will block all organization users until the payment is resolved and the subscription is reactivated.</p></div>
        <div className="space-y-3">
          <p className="text-xs font-semibold">{orgName} · {formatCurrency(invoice.total_amount ?? invoice.subtotal_amount ?? 0)} overdue</p>
          <div><label className="text-xs font-black uppercase text-muted-foreground">Reason (min 10 chars)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 h-20 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Why is this being suspended?" /></div>
          <div><label className="text-xs font-black uppercase text-muted-foreground">Type &quot;SUSPEND&quot; to confirm</label><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="SUSPEND" /></div>
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="destructive" onClick={handleSubmit} disabled={reason.trim().length < 10 || confirmText !== "SUSPEND" || loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <PauseCircle className="size-4" />}Suspend</Button></div>
        </div>
      </div>
    </div>
  );
}

function DunningReactivateModal({ invoice, organizations, subscriptions, onClose, onSuccess }: {
  invoice: any; organizations: any[]; subscriptions: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const orgName = organizations.find((o: any) => o.id === invoice.organization_id)?.name ?? invoice.organization_id.slice(0, 8);

  const handleSubmit = async () => {
    if (!reason.trim()) { showToast("Reason is required", "error"); return; }
    if (confirmText !== "REACTIVATE") { showToast('Type "REACTIVATE" to confirm', "error"); return; }
    setLoading(true);
    const sub = subscriptions.find((s: any) => s.organization_id === invoice.organization_id);
    const result = await reactivateAfterPaymentAction({
      subscriptionId: sub?.id ?? "", invoiceId: invoice.id, organizationId: invoice.organization_id, reason: reason.trim(),
    });
    setLoading(false);
    if (result.status === "success") onSuccess(); else showToast(result.message || "Failed", "error");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-green-200 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4"><div className="rounded-full bg-green-50 p-2"><Play className="size-5 text-green-600" /></div><div><h3 className="text-lg font-black">Reactivate After Payment</h3><p className="text-xs text-muted-foreground">Restore access after payment resolution</p></div></div>
        <div className="space-y-3">
          <p className="text-xs font-semibold">{orgName} · Currently suspended</p>
          <div><label className="text-xs font-black uppercase text-muted-foreground">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 h-20 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Reason for reactivation..." /></div>
          <div><label className="text-xs font-black uppercase text-muted-foreground">Type &quot;REACTIVATE&quot; to confirm</label><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="REACTIVATE" /></div>
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={handleSubmit} disabled={!reason.trim() || confirmText !== "REACTIVATE" || loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}Reactivate</Button></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function StatusBadgeDK({ status }: { status: string }) {
  const colors: Record<string, string> = {
    payment_failed: "border-red-200 bg-red-50 text-red-700",
    overdue: "border-red-200 bg-red-50 text-red-700",
    retry_scheduled: "border-blue-200 bg-blue-50 text-blue-700",
    grace_period: "border-amber-200 bg-amber-50 text-amber-700",
    suspended: "border-orange-200 bg-orange-50 text-orange-800",
    resolved: "border-green-200 bg-green-50 text-green-700",
    waived: "border-gray-200 bg-gray-50 text-gray-500",
    none: "border-gray-200 bg-gray-50 text-gray-500",
  };
  return <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold " + (colors[status] ?? "border-border bg-surface-muted text-muted-foreground")}>{status ?? "unknown"}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "border-green-200 bg-green-50 text-green-700",
    issued: "border-blue-200 bg-blue-50 text-blue-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    failed: "border-red-200 bg-red-50 text-red-700",
    overdue: "border-red-200 bg-red-50 text-red-700",
    processed: "border-green-200 bg-green-50 text-green-700",
    processing: "border-blue-200 bg-blue-50 text-blue-700",
    success: "border-green-200 bg-green-50 text-green-700",
    active: "border-green-200 bg-green-50 text-green-700",
    cancelled: "border-gray-200 bg-gray-50 text-gray-500",
  };
  return <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold " + (colors[status?.toLowerCase()] ?? "border-border bg-surface-muted text-muted-foreground")}>{status ?? "unknown"}</span>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-start gap-2"><span className="min-w-28 text-muted-foreground text-xs">{label}:</span><span className="font-semibold text-xs break-all">{value}</span></div>; }

function XClose(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
