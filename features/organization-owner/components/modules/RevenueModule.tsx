"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Banknote, BarChart3, CreditCard, Download, Eye, PieChart as PieChartIcon, ReceiptText, TrendingUp, GitBranch } from "lucide-react";

import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCurrency, formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { useHasFeature } from "@/features/organization-owner/entitlements/entitlement-provider";
import { RevenueSplitPanel } from "@/features/organization-owner/components/modules/RevenueSplitPanel";
import type { Database } from "@/types/database";

type RevenueEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

const CHART_COLORS = ["#16a34a", "#f59e0b", "#dc2626", "#6b7280", "#0891b2", "#8b5cf6"];

export function RevenueEnterpriseModule({ dashboard, moduleData }: RevenueEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [detailPayment, setDetailPayment] = useState<PaymentRow | null>(null);
  const [chartTab, setChartTab] = useState<"trend" | "gym" | "status">("trend");
  const [revenueTab, setRevenueTab] = useState<"overview" | "split">("overview");
  const hasBranchRevenueSplit = useHasFeature("branch_revenue_split");

  const payments = (moduleData?.items ?? dashboard.payments) as typeof dashboard.payments;

  const handleApply = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, status: f.status, dateFrom: f.dateFrom, dateTo: f.dateTo });
  }, [navigate]);

  // ── KPIs ──
  const paid = payments.filter((p) => p.status === "paid");
  const pending = payments.filter((p) => p.status === "pending");
  const failed = payments.filter((p) => p.status === "failed");
  const refunded = payments.filter((p) => p.status === "refunded");
  const totalCollected = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalPending = pending.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalFailed = failed.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalRefunded = refunded.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const avgTransaction = paid.length > 0 ? totalCollected / paid.length : 0;
  const outstanding = totalPending + (payments.filter((p) => p.status === "processing").reduce((s, p) => s + Number(p.amount ?? 0), 0));

  // ── Revenue by Month ──
  const revenueByMonth = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const p of paid) {
      const month = p.created_at.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(p.amount ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, revenue]) => ({ date, revenue }));
  }, [paid]);

  // ── Revenue by Gym ──
  const revenueByGym = useMemo(() => {
    const byGym = new Map<string, number>();
    for (const p of paid) {
      const gym = dashboard.gyms.find((g) => g.id === p.gym_id);
      const name = gym?.name ?? "Unknown";
      byGym.set(name, (byGym.get(name) ?? 0) + Number(p.amount ?? 0));
    }
    return Array.from(byGym.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [paid, dashboard.gyms]);

  // ── Payment Status Distribution ──
  const statusDist = useMemo(() => [
    { name: "Paid", value: paid.length, amount: totalCollected },
    { name: "Pending", value: pending.length, amount: totalPending },
    { name: "Failed", value: failed.length, amount: totalFailed },
    { name: "Refunded", value: refunded.length, amount: totalRefunded },
  ].filter((s) => s.value > 0), [paid, pending, failed, refunded, totalCollected, totalPending, totalFailed, totalRefunded]);

  // ── Payment Method Breakdown ──
  const methodDist = useMemo(() => {
    const byMethod = new Map<string, number>();
    for (const p of paid) {
      byMethod.set(p.method || "Unknown", (byMethod.get(p.method || "Unknown") ?? 0) + Number(p.amount ?? 0));
    }
    return Array.from(byMethod.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [paid]);

  // Last month comparison
  const thisMonthTotal = revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0;
  const lastMonthTotal = revenueByMonth[revenueByMonth.length - 2]?.revenue ?? 0;
  const monthOverMonth = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;

  const items = payments.map((p) => {
    const member = dashboard.members.find((m) => m.id === p.member_id);
    const gym = dashboard.gyms.find((g) => g.id === p.gym_id);
    return {
      id: p.id,
      title: p.payment_number,
      subtitle: member?.full_name ?? "Unknown member",
      meta: `${gym?.name ?? "—"} · ${formatEnterpriseLabel(p.payment_type)} · ${p.method ?? "—"} · ${new Date(p.created_at).toLocaleDateString("en-IN")}`,
      badge: p.status,
      badgeVariant: (p.status === "paid" ? "success" : p.status === "failed" ? "error" : p.status === "refunded" ? "neutral" : "warning") as "success" | "error" | "neutral" | "warning",
      status: p.status,
      sections: [
        { label: "Amount", value: formatCurrency(Number(p.amount ?? 0), p.currency) },
        { label: "Member", value: member?.full_name ?? "—" },
        { label: "Type", value: formatEnterpriseLabel(p.payment_type) },
        { label: "Method", value: p.method ?? "—" },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailPayment(p), variant: "secondary" as const, icon: <Eye className="size-3.5" /> }
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? payments.length;

  return (
    <div className="space-y-6">
      {hasBranchRevenueSplit && (
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${revenueTab === "overview" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setRevenueTab("overview")} type="button"
          >
            Overview
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${revenueTab === "split" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setRevenueTab("split")} type="button"
          >
            <GitBranch className="size-3.5 mr-1 inline" />
            Revenue Split
          </button>
        </div>
      )}

      {revenueTab === "split" ? (
        <RevenueSplitPanel dashboard={dashboard} />
      ) : (
        <>
          {/* ═══ KPI GRID ═══ */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total collected revenue" icon={<CreditCard className="size-5" />} label="Collected" value={formatCurrency(totalCollected)} />
        <StatCard detail="Month-over-month revenue change" icon={monthOverMonth >= 0 ? <ArrowUp className="size-5" /> : <ArrowDown className="size-5" />} label="MoM Change" status={monthOverMonth >= 0 ? "good" : "risk"} value={`${monthOverMonth >= 0 ? "+" : ""}${monthOverMonth}%`} />
        <StatCard detail="Average transaction value" icon={<TrendingUp className="size-5" />} label="Avg Transaction" value={formatCurrency(avgTransaction)} />
        <StatCard detail="Total failed payment amount" icon={<BarChart3 className="size-5" />} label="Failed" status={failed.length > 0 ? "risk" : "good"} value={formatCurrency(totalFailed)} />
        <StatCard detail="Pending and processing payments" icon={<ReceiptText className="size-5" />} label="Outstanding" status={outstanding > 0 ? "watch" : "good"} value={formatCurrency(outstanding)} />
        <StatCard detail="Total refunded amount" icon={<Banknote className="size-5" />} label="Refunded" value={formatCurrency(totalRefunded)} />
        <StatCard detail="Successful transactions" icon={<CreditCard className="size-5" />} label="Paid Transactions" value={formatCompactNumber(paid.length)} />
        <StatCard detail="Failed transaction count" icon={<CreditCard className="size-5" />} label="Failed Count" status={failed.length > 0 ? "risk" : "good"} value={formatCompactNumber(failed.length)} />
      </section>

      {/* ═══ CHARTS ═══ */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Revenue</p><h3 className="text-2xl font-black">Revenue Trend</h3></div>
              <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
                <button className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${chartTab === "trend" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setChartTab("trend")} type="button">Trend</button>
                <button className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${chartTab === "gym" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setChartTab("gym")} type="button">By Gym</button>
                <button className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${chartTab === "status" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setChartTab("status")} type="button">Status</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartTab === "trend" ? (
              revenueByMonth.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No revenue data yet.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueByMonth}>
                      <Tooltip formatter={function(v: any) { return [formatCurrency(v), "Revenue"]; } as any} />
                      <Line dataKey="revenue" stroke="#111315" strokeWidth={2} dot={{ r: 3, fill: "#111315" }} type="monotone" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : chartTab === "gym" ? (
              revenueByGym.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No gym revenue data yet.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByGym}>
                      <Tooltip formatter={function(v: any) { return [formatCurrency(v), "Revenue"]; } as any} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {revenueByGym.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                      </Bar>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              <div className="flex items-center gap-8">
                <div className="h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                        {statusDist.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                      </Pie>
                      <Tooltip formatter={function(v: any) { return [formatCompactNumber(v), "Transactions"]; } as any} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {statusDist.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <span className="size-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <div><p className="text-sm font-bold">{s.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(s.amount)} · {formatCompactNumber(s.value)} txns</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Distribution */}
        <Card>
          <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Methods</p><h3 className="text-2xl font-black">Payment Methods</h3></CardHeader>
          <CardContent className="space-y-4">
            {methodDist.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payment method data yet.</p>
            ) : methodDist.map((m, i) => {
              const pct = totalCollected > 0 ? Math.round((m.amount / totalCollected) * 100) : 0;
              return (
                <div key={m.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">{m.name}</span>
                    <span className="font-semibold text-muted-foreground">{formatCurrency(m.amount)} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ═══ FILTERS + DATA LIST ═══ */}
      <FilterBar
        filterGroups={[{ key: "status", label: "Status", options: [
          { value: "paid", label: "Paid" }, { value: "pending", label: "Pending" },
          { value: "failed", label: "Failed" }, { value: "refunded", label: "Refunded" }, { value: "processing", label: "Processing" }
        ]}]}
        searchPlaceholder="Search by payment number, member name, or gym..."
        onApply={handleApply}
        activeFilters={filters as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => {
            const data = payments.filter((p) => ids.includes(p.id)).map((p) => ({
              number: p.payment_number, member: dashboard.members.find((m) => m.id === p.member_id)?.full_name,
              amount: p.amount, currency: p.currency, type: p.payment_type, method: p.method, status: p.status, date: p.created_at
            }));
            exportToCSV(data, "payments-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(payments.map((p) => ({
          number: p.payment_number, amount: p.amount, currency: p.currency, type: p.payment_type,
          method: p.method, status: p.status, date: p.created_at, member_id: p.member_id, gym_id: p.gym_id
        })), "all-payments")}
        headerTitle="Payments"
        items={items}
        totalItems={totalItems}
        totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />

          {/* ═══ DETAIL PANEL ═══ */}
          {detailPayment ? <PaymentDetailPanel payment={detailPayment} dashboard={dashboard} onClose={() => setDetailPayment(null)} /> : null}
        </>
      )}
    </div>
  );
}

function PaymentDetailPanel({ payment, dashboard, onClose }: { payment: PaymentRow; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const member = dashboard.members.find((m) => m.id === payment.member_id);
  const gym = dashboard.gyms.find((g) => g.id === payment.gym_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Payment details">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{payment.payment_number}</h2>
              <EnterpriseStatusBadge status={payment.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{new Date(payment.created_at).toLocaleString("en-IN")}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><CreditCard className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Payment Info</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Amount</p><p className="text-xl font-black">{formatCurrency(Number(payment.amount ?? 0), payment.currency)}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={payment.status} /></div>
              <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{formatEnterpriseLabel(payment.payment_type)}</p></div>
              <div><p className="text-xs text-muted-foreground">Method</p><p className="text-sm font-bold">{payment.method ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-bold">{new Date(payment.created_at).toLocaleString("en-IN")}</p></div>
              <div><p className="text-xs text-muted-foreground">Currency</p><p className="text-sm font-bold">{payment.currency}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Member</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-bold">{member?.full_name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Code</p><p className="text-sm font-bold">{member?.member_code ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-bold">{member?.phone ?? "—"}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Gym</h3></CardHeader>
            <CardContent><p className="text-sm font-bold">{gym?.name ?? "—"}</p></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

