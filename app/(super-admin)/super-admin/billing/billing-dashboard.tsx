"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Banknote,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/features/billing/lib/money";
import { cn } from "@/lib/utils";
import type { BillingMetricsSummary } from "@/features/billing/types/billing-extended";

type BillingDashboardProps = {
  summary: BillingMetricsSummary;
  invoices: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  refunds: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  creditNotes: Array<Record<string, unknown>>;
  writeOffs: Array<Record<string, unknown>>;
  disputes: Array<Record<string, unknown>>;
  reconciliation: Array<Record<string, unknown>>;
  revenueRecognition: Array<Record<string, unknown>>;
  subscriptionInvoices: Array<Record<string, unknown>>;
  subscriptionPayments: Array<Record<string, unknown>>;
  subscriptionMetrics: { totalInvoicedMonth: number; totalCollectedMonth: number; totalOutstanding: number; invoiceCount: number };
};

type TabId = "overview" | "invoices" | "payments" | "refunds" | "credit_notes" | "write_offs" | "disputes" | "reconciliation" | "revenue" | "subscription";

const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "refunds", label: "Refunds", icon: RotateCcw },
  { id: "credit_notes", label: "Credit Notes", icon: Receipt },
  { id: "write_offs", label: "Write-Offs", icon: Ban },
  { id: "disputes", label: "Disputes", icon: Shield },
  { id: "reconciliation", label: "Reconciliation", icon: Scale },
  { id: "revenue", label: "Revenue Recognition", icon: Landmark },
  { id: "subscription", label: "Subscription", icon: Banknote },
];

export function BillingDashboard(props: BillingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const dataKey = activeTab === "invoices" ? props.invoices
    : activeTab === "payments" ? props.payments
    : activeTab === "refunds" ? props.refunds
    : activeTab === "credit_notes" ? props.creditNotes
    : activeTab === "write_offs" ? props.writeOffs
    : activeTab === "disputes" ? props.disputes
    : activeTab === "reconciliation" ? props.reconciliation
    : activeTab === "revenue" ? props.revenueRecognition
    : activeTab === "subscription" ? props.subscriptionInvoices
    : [];

  const filtered = searchQuery
    ? dataKey.filter((row) =>
        Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : dataKey;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Finance</p>
          <h1 className="mt-2 text-3xl font-black">Billing & Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise billing management, reconciliation, and financial operations
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.print()} aria-label="Export billing data">
          <Download className="mr-2 size-4" />
          Export
        </Button>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="Collected (MTD)"
          value={formatCurrency(props.summary.totalCollectedMonth)}
          icon={<TrendingUp className="size-4 text-green-600" />}
        />
        <KpiCard
          label="Invoiced (MTD)"
          value={formatCurrency(props.summary.totalInvoicedMonth)}
          icon={<FileText className="size-4 text-accent" />}
        />
        <KpiCard
          label="Refunded (MTD)"
          value={formatCurrency(props.summary.totalRefundedMonth)}
          icon={<RotateCcw className="size-4 text-orange-600" />}
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(props.summary.totalOutstanding)}
          icon={<AlertTriangle className="size-4 text-red-600" />}
          urgent={props.summary.totalOutstanding > 0}
        />
        <KpiCard
          label="Open Disputes"
          value={String(props.summary.openDisputesCount)}
          icon={<Shield className="size-4 text-amber-600" />}
          urgent={props.summary.openDisputesCount > 0}
        />
        <KpiCard
          label="MoM Growth"
          value={`${props.summary.monthOverMonthGrowth >= 0 ? "+" : ""}${props.summary.monthOverMonthGrowth}%`}
          icon={props.summary.monthOverMonthGrowth >= 0 ? <TrendingUp className="size-4 text-green-600" /> : <TrendingDown className="size-4 text-red-600" />}
          trend={props.summary.monthOverMonthGrowth >= 0 ? "up" : "down"}
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Written Off" value={formatCurrency(props.summary.totalWrittenOff)} icon={<Ban className="size-4 text-muted-foreground" />} />
        <KpiCard label="Credit Notes Issued" value={String(props.summary.creditNotesIssued)} icon={<Receipt className="size-4 text-muted-foreground" />} />
        <KpiCard label="Pending Reconciliation" value={String(props.summary.pendingReconciliationCount)} icon={<Scale className="size-4 text-muted-foreground" />} urgent={props.summary.pendingReconciliationCount > 0} />
        <KpiCard label="Credit Notes Applied" value={String(props.summary.creditNotesApplied)} icon={<Receipt className="size-4 text-green-600" />} />
      </div>

      {/* Tab Navigation */}
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollContainerRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
            className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md backdrop-blur sm:flex"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide rounded-lg bg-surface-muted p-1"
          role="tablist"
          aria-label="Billing sections"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => { setActiveTab(tab.id); setCurrentPage(1); setSearchQuery(""); }}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap min-h-11",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scrollContainerRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md backdrop-blur sm:flex"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      {/* Search + Pagination Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder={`Search ${activeTab.replace("_", " ")}...`}
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm shadow-sm"
            aria-label={`Search ${activeTab.replace("_", " ")}`}
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          {totalPages > 1 && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <button onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} className="disabled:opacity-30 min-h-11 min-w-11 flex items-center justify-center rounded-md hover:bg-surface-muted" aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </button>
              <span>Page {safePage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} className="disabled:opacity-30 min-h-11 min-w-11 flex items-center justify-center rounded-md hover:bg-surface-muted" aria-label="Next page">
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab {...props} />}
      {activeTab === "invoices" && <GenericTable title="Invoices" data={paginated} statusKey="status" amountKey="total_amount" dateKey="created_at" identifierKey="invoice_number" />}
      {activeTab === "payments" && <GenericTable title="Payments" data={paginated} statusKey="status" amountKey="amount" dateKey="created_at" identifierKey="payment_number" />}
      {activeTab === "refunds" && <GenericTable title="Refunds" data={paginated} statusKey="status" amountKey="amount" dateKey="created_at" identifierKey="id" />}
      {activeTab === "credit_notes" && <GenericTable title="Credit Notes" data={paginated} statusKey="status" amountKey="amount" dateKey="created_at" identifierKey="credit_note_number" />}
      {activeTab === "write_offs" && <GenericTable title="Write-Offs" data={paginated} statusKey="status" amountKey="amount" dateKey="created_at" identifierKey="id" />}
      {activeTab === "disputes" && <GenericTable title="Disputes" data={paginated} statusKey="status" amountKey="amount" dateKey="created_at" identifierKey="id" />}
      {activeTab === "reconciliation" && <GenericTable title="Reconciliation" data={paginated} statusKey="status" amountKey="difference" dateKey="date" identifierKey="id" />}
      {activeTab === "revenue" && <RevenueRecognitionTable data={paginated} />}
      {activeTab === "subscription" && <SubscriptionTab {...props} />}
    </div>
  );
}

function KpiCard({ label, value, icon, urgent, trend }: { label: string; value: string; icon: React.ReactNode; urgent?: boolean; trend?: "up" | "down" }) {
  return (
    <Card className={cn(urgent && "ring-1 ring-red-300 dark:ring-red-800")}>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-lg font-black sm:text-xl md:text-2xl", trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function OverviewTab(props: BillingDashboardProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-black">Recent Transactions</h2>
        </CardHeader>
        <CardContent>
          {props.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
              <Banknote className="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-bold text-muted-foreground">No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="hidden w-full text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {props.transactions.slice(0, 10).map((tx, i) => (
                    <tr key={(tx.id as string) ?? i} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold">{(tx.transaction_type as string ?? "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-black">{formatCurrency(tx.amount as number)}</td>
                      <td className="px-4 py-3"><DirectionBadge direction={tx.direction as string} /></td>
                      <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{(tx.description as string) ?? ""}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(tx.created_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-2 md:hidden">
                {props.transactions.slice(0, 10).map((tx, i) => (
                  <div key={(tx.id as string) ?? i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{(tx.transaction_type as string ?? "").replace(/_/g, " ")}</span>
                      <DirectionBadge direction={tx.direction as string} />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-black">{formatCurrency(tx.amount as number)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(tx.created_at as string)}</span>
                    </div>
                    {(tx.description as string | undefined) && <p className="mt-1 text-xs text-muted-foreground truncate">{(tx.description as string)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-black">Credit Notes</h2>
          </CardHeader>
          <CardContent>
            {props.creditNotes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No credit notes issued.</p>
            ) : (
              <div className="space-y-2">
                {props.creditNotes.slice(0, 5).map((cn, i) => (
                  <div key={(cn.id as string) ?? i} className="flex items-center justify-between rounded-md bg-surface-muted p-2.5">
                    <div>
                      <p className="text-sm font-bold">{(cn.credit_note_number as string) ?? (cn.id as string)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(cn.created_at as string)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">{formatCurrency(cn.amount as number)}</p>
                      <StatusBadge status={cn.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-black">Open Disputes</h2>
          </CardHeader>
          <CardContent>
            {props.disputes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No open disputes.</p>
            ) : (
              <div className="space-y-2">
                {props.disputes.slice(0, 5).map((d, i) => (
                  <div key={(d.id as string) ?? i} className="flex items-center justify-between rounded-md bg-surface-muted p-2.5">
                    <div>
                      <p className="text-sm font-bold capitalize">{(d.reason as string ?? "").replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.created_at as string)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">{formatCurrency(d.amount as number)}</p>
                      <StatusBadge status={d.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-black">Reconciliation</h2>
          </CardHeader>
          <CardContent>
            {props.reconciliation.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">All entries reconciled.</p>
            ) : (
              <div className="space-y-2">
                {props.reconciliation.slice(0, 5).map((r, i) => (
                  <div key={(r.id as string) ?? i} className="flex items-center justify-between rounded-md bg-surface-muted p-2.5">
                    <div>
                      <p className="text-sm font-bold">{formatDate(r.date as string)}</p>
                      <p className="text-xs text-muted-foreground">{(r.provider as string) ?? "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-black", (r.difference as number) !== 0 ? "text-red-600" : "text-green-600")}>
                        {formatCurrency(r.difference as number)}
                      </p>
                      <StatusBadge status={r.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SubscriptionTab(props: BillingDashboardProps) {
  const metrics = props.subscriptionMetrics;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Subscriptions Invoiced (MTD)" value={formatCurrency(metrics.totalInvoicedMonth)} icon={<FileText className="size-4 text-accent" />} />
        <KpiCard label="Subscriptions Collected (MTD)" value={formatCurrency(metrics.totalCollectedMonth)} icon={<TrendingUp className="size-4 text-green-600" />} />
        <KpiCard label="Subscription Outstanding" value={formatCurrency(metrics.totalOutstanding)} icon={<AlertTriangle className="size-4 text-red-600" />} urgent={metrics.totalOutstanding > 0} />
        <KpiCard label="Invoices Generated" value={String(metrics.invoiceCount)} icon={<Banknote className="size-4 text-muted-foreground" />} />
      </div>

      <GenericTable title="Subscription Invoices" data={props.subscriptionInvoices} statusKey="status" amountKey="total_amount" dateKey="created_at" identifierKey="invoice_number" />
    </div>
  );
}

function RevenueRecognitionTable({ data }: { data: Array<Record<string, unknown>> }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
            <Landmark className="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-bold text-muted-foreground">No revenue recognition entries yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Revenue will be recognized as invoices are paid.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-black">Revenue Recognition</h2>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="hidden w-full text-left text-sm sm:table">
            <thead>
              <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Recognized</th>
                <th className="px-4 py-3">Deferred</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((entry, i) => (
                <tr key={(entry.id as string) ?? i} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3 font-bold">{(entry.period_start as string ?? "").slice(0, 10)} → {(entry.period_end as string ?? "").slice(0, 10)}</td>
                  <td className="px-4 py-3 font-black text-green-600">{formatCurrency(entry.recognized_amount as number)}</td>
                  <td className="px-4 py-3 font-black text-amber-600">{formatCurrency(entry.deferred_amount as number)}</td>
                  <td className="px-4 py-3"><StatusBadge status={entry.status as string} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(entry.recognized_date as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-2 sm:hidden">
            {data.map((entry, i) => (
              <div key={(entry.id as string) ?? i} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Period</span>
                  <StatusBadge status={entry.status as string} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{(entry.period_start as string ?? "").slice(0, 10)} → {(entry.period_end as string ?? "").slice(0, 10)}</p>
                <div className="mt-2 flex justify-between">
                  <span className="font-black text-green-600">{formatCurrency(entry.recognized_amount as number)} recognized</span>
                  <span className="font-black text-amber-600">{formatCurrency(entry.deferred_amount as number)} deferred</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GenericTable({ title, data, statusKey, amountKey, dateKey, identifierKey }: {
  title: string;
  data: Array<Record<string, unknown>>;
  statusKey: string;
  amountKey: string;
  dateKey: string;
  identifierKey: string;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
            <FileText className="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-bold text-muted-foreground">No {title.toLowerCase()} found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const keys = Object.keys(data[0] ?? {}).filter((k) => !["id", "metadata", "request_payload", "response_payload", "provider_signature"].includes(k));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-black">{title} ({data.length})</h2>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="hidden w-full text-left text-sm sm:table">
            <thead>
              <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                {keys.filter((k) => ![identifierKey, statusKey, amountKey, dateKey, "created_at", "updated_at"].includes(k)).slice(0, 3).map((k) => (
                  <th key={k} className="px-4 py-3">{k.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row, i) => (
                <tr key={(row.id as string) ?? i} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{(row[identifierKey] as string ?? row.id as string ?? "").slice(0, 16)}</td>
                  <td className="px-4 py-3"><StatusBadge status={row[statusKey] as string} /></td>
                  <td className="px-4 py-3 font-black">{formatCurrency(row[amountKey] as number)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(row[dateKey] as string)}</td>
                  {keys.filter((k) => ![identifierKey, statusKey, amountKey, dateKey, "created_at", "updated_at"].includes(k)).slice(0, 3).map((k) => (
                    <td key={k} className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{(row[k] as string ?? "")?.toString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-2 sm:hidden">
            {data.map((row, i) => (
              <div key={(row.id as string) ?? i} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">{(row[identifierKey] as string ?? row.id as string ?? "").slice(0, 12)}</span>
                  <StatusBadge status={row[statusKey] as string} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-black">{formatCurrency(row[amountKey] as number)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(row[dateKey] as string)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {keys.filter((k) => ![identifierKey, statusKey, amountKey, dateKey, "created_at", "updated_at"].includes(k)).slice(0, 2).map((k) => `${k.replace(/_/g, " ")}: ${(row[k] as string ?? "")?.toString()}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <Badge variant="neutral">Unknown</Badge>;
  const s = status.toLowerCase();
  const variant = s === "paid" || s === "processed" || s === "applied" || s === "fully_applied" || s === "approved" || s === "won" || s === "recognized" || s === "matched" || s === "resolved" ? "success"
    : s === "pending" || s === "draft" || s === "issued" || s === "opened" || s === "under_review" || s === "pending_approval" ? "warning"
    : s === "failed" || s === "cancelled" || s === "rejected" || s === "lost" || s === "unmatched" || s === "flagged" ? "error"
    : "neutral";
  return <Badge variant={variant as "success" | "warning" | "error" | "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

function DirectionBadge({ direction }: { direction: string }) {
  if (!direction) return null;
  const isCredit = direction === "credit";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold", isCredit ? "text-green-600" : "text-red-600")}>
      {isCredit ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {direction}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return "—";
  }
}
