"use client";

import { useState, useMemo } from "react";
import { CreditCard, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Search, FileText, Copy, RefreshCw, BarChart3, Ban, Eye, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";

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
  const divisors: Record<string, number> = { monthly: 1, annual: 12, quarterly: 3, half_yearly: 6 };
  return Math.round(price / (divisors[period] || 1));
}

export function PaymentDashboard({ organizations, packages, subscriptions, invoicesByOrg, eventsByOrg }: PaymentDashboardProps) {
  const [tab, setTab] = useState<"overview" | "invoices" | "webhooks" | "risks">("overview");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Compute all invoices flat list
  const allInvoices = useMemo(() => Object.values(invoicesByOrg).flat(), [invoicesByOrg]);
  const allEvents = useMemo(() => Object.values(eventsByOrg).flat(), [eventsByOrg]);
  const webhookEvents = useMemo(() => allEvents.filter((e: any) => e.event_type?.includes("webhook") || e.metadata?.source === "webhook"), [allEvents]);

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
        {([{ key: "overview" as const, label: "Revenue & Metrics" }, { key: "invoices" as const, label: `Invoices (${allInvoices.length})` }, { key: "webhooks" as const, label: `Webhooks (${webhookEvents.length})` }, { key: "risks" as const, label: `Risks (${risks.length})` }]).map((t) => (
          <button key={t.key} className={cn("whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition", tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setTab(t.key)} role="tab" type="button">{t.label}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW / METRICS ═══ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Monthly Revenue (MRR)" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(mrr / 100))}`} detail={`From ${activeSubs.length} active subscriptions`} status="good" />
            <StatCard label="Annual Run Rate (ARR)" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(mrr * 12 / 100))}`} detail="MRR × 12" status="good" />
            <StatCard label="Paid Invoices" value={String(paidInvoices.length)} detail={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalPaid / 100))} total collected`} status="good" />
            <StatCard label="Pending" value={String(pendingInvoices.length)} detail={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalPending / 100))} awaiting payment`} status={pendingInvoices.length > 0 ? "watch" : "good"} />
            <StatCard label="Failed Payments" value={String(failedInvoices.length)} detail={`₹${Intl.NumberFormat("en-IN").format(Math.round(totalFailed / 100))} failed`} status={failedInvoices.length > 0 ? "risk" : "good"} />
            <StatCard label="Overdue" value={String(overdueInvoices.length)} detail="Past due date" status={overdueInvoices.length > 0 ? "risk" : "good"} />
            <StatCard label="Webhook Health" value={String(successfulWebhooks)} detail={`${failedWebhooks} failed · Last: ${lastWebhook ? new Date(lastWebhook.created_at).toLocaleDateString("en-IN") : "N/A"}`} status={failedWebhooks > 0 ? "watch" : "good"} />
            <StatCard label="Upcoming Renewals" value={String(subscriptions.filter((s: any) => s.next_billing_date && new Date(s.next_billing_date) > new Date() && new Date(s.next_billing_date).getTime() - Date.now() < 30 * 86400000).length)} detail="Within 30 days" status="good" />
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
                <th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Razorpay ID</th><th className="px-4 py-3">Due</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {pagedInvoices.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No invoices match your filters</td></tr> :
                pagedInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-accent/5">
                    <td className="px-4 py-3 font-semibold text-xs">{inv.invoice_number ?? inv.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{getOrgName(inv.organization_id)}</td>
                    <td className="px-4 py-3 text-xs font-semibold">₹{Intl.NumberFormat("en-IN").format(Math.round((inv.total_amount ?? inv.subtotal_amount ?? 0) / 100))}</td>
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
                <Row label="Subtotal" value={`₹${Intl.NumberFormat("en-IN").format(Math.round((selectedInvoice.subtotal_amount ?? 0) / 100))}`} />
                {selectedInvoice.tax_amount > 0 && <Row label="Tax" value={`₹${Intl.NumberFormat("en-IN").format(Math.round(selectedInvoice.tax_amount / 100))}`} />}
                <Row label="Total" value={`₹${Intl.NumberFormat("en-IN").format(Math.round((selectedInvoice.total_amount ?? selectedInvoice.subtotal_amount ?? 0) / 100))}`} />
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

/* ─── Helpers ─── */

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
