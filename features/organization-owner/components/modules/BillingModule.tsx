"use client";

import { useMemo, useState } from "react";
import { ArrowDown, Banknote, CreditCard, Download, Eye, ReceiptText, TrendingUp } from "lucide-react";
import { LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type BillingEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function BillingEnterpriseModule({ dashboard, moduleData }: BillingEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "payments">("overview");
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);

  const subscriptions = (moduleData?.items ?? dashboard.subscriptions) as typeof dashboard.subscriptions;
  const payments = dashboard.payments;

  // ── KPIs ──
  const activeSubs = subscriptions.filter((s) => s.status === "active" || s.status === "trial").length;
  const paidPayments = payments.filter((p) => p.status === "paid");
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalPending = payments.filter((p) => p.status === "pending" || p.status === "processing").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalFailed = payments.filter((p) => p.status === "failed").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const avgTransaction = paidPayments.length > 0 ? totalPaid / paidPayments.length : 0;
  const latestSub = subscriptions[subscriptions.length - 1];

  // ── Monthly payment trend ──
  const paymentTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const p of paidPayments) {
      const m = p.created_at.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + Number(p.amount ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, amount]) => ({ date, amount }));
  }, [paidPayments]);

  // ── Payment method distribution ──
  const methodDist = useMemo(() => {
    const byMethod = new Map<string, number>();
    for (const p of paidPayments) {
      const method = p.method || "Unknown";
      byMethod.set(method, (byMethod.get(method) ?? 0) + Number(p.amount ?? 0));
    }
    return Array.from(byMethod.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [paidPayments]);

  // MoM comparison
  const currentMonth = paymentTrend[paymentTrend.length - 1]?.amount ?? 0;
  const prevMonth = paymentTrend[paymentTrend.length - 2]?.amount ?? 0;
  const momChange = prevMonth > 0 ? Math.round(((currentMonth - prevMonth) / prevMonth) * 100) : 0;

  // ── Subscription items ──
  const subItems = subscriptions.map((s) => {
    const planPrice = paidPayments.filter((p) => p.status === "paid").reduce((total) => total + 1, 0);
    return {
      id: s.id,
      title: formatEnterpriseLabel(s.plan_tier),
      subtitle: `Status: ${s.status}`,
      meta: `Starts: ${s.starts_on ? new Date(s.starts_on).toLocaleDateString("en-IN") : "N/A"} · Renews: ${s.renews_on ? new Date(s.renews_on).toLocaleDateString("en-IN") : "Not scheduled"}`,
      badge: s.status,
      badgeVariant: (s.status === "active" ? "success" : s.status === "trial" ? "info" : "warning") as "success" | "info" | "warning",
      sections: [
        { label: "Plan", value: formatEnterpriseLabel(s.plan_tier) },
        { label: "Status", value: s.status },
        { label: "Starts", value: s.starts_on ? new Date(s.starts_on).toLocaleDateString("en-IN") : "—" },
        { label: "Renews", value: s.renews_on ? new Date(s.renews_on).toLocaleDateString("en-IN") : "—" },
      ],
      actions: []
    };
  });

  // ── Payment items (for payments tab) ──
  const paymentItems = payments.slice(0, 200).map((p) => {
    const member = p.member_id ? dashboard.members.find((m) => m.id === p.member_id) : null;
    const gym = p.gym_id ? dashboard.gyms.find((g) => g.id === p.gym_id) : null;
    return {
      id: p.id,
      title: p.payment_number,
      subtitle: member?.full_name ?? "Unknown",
      meta: `${gym?.name ?? "—"} · ${formatEnterpriseLabel(p.payment_type)} · ${p.method ?? "—"} · ${new Date(p.created_at).toLocaleDateString("en-IN")}`,
      badge: p.status,
      badgeVariant: (p.status === "paid" ? "success" : p.status === "failed" ? "error" : "warning") as "success" | "error" | "warning",
      sections: [
        { label: "Amount", value: formatCurrency(Number(p.amount ?? 0), p.currency) },
        { label: "Method", value: p.method ?? "—" },
        { label: "Type", value: formatEnterpriseLabel(p.payment_type) },
        { label: "Date", value: new Date(p.created_at).toLocaleDateString("en-IN") },
      ],
      actions: [{ label: "Details", onClick: () => setDetailItem(p as unknown as Record<string, unknown>), variant: "secondary" as const, icon: <Eye className="size-3.5" /> }]
    };
  });

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total revenue collected" icon={<CreditCard className="size-5" />} label="Total Collected" value={formatCurrency(totalPaid)} />
        <StatCard detail="Month-over-month revenue change" icon={momChange >= 0 ? <TrendingUp className="size-5" /> : <ArrowDown className="size-5" />} label="MoM Change" status={momChange >= 0 ? "good" : "risk"} value={`${momChange >= 0 ? "+" : ""}${momChange}%`} />
        <StatCard detail="Average transaction value" icon={<TrendingUp className="size-5" />} label="Avg Transaction" value={formatCurrency(avgTransaction)} />
        <StatCard detail="Active subscription count" icon={<ReceiptText className="size-5" />} label="Active Subs" value={String(activeSubs)} />
        <StatCard detail="Pending/processing payments" icon={<Banknote className="size-5" />} label="Outstanding" status={totalPending > 0 ? "watch" : "good"} value={formatCurrency(totalPending)} />
        <StatCard detail="Total failed payment amount" icon={<CreditCard className="size-5" />} label="Failed" status={totalFailed > 0 ? "risk" : "good"} value={formatCurrency(totalFailed)} />
        <StatCard detail="Successful transactions" icon={<CreditCard className="size-5" />} label="Paid Count" value={formatCompactNumber(paidPayments.length)} />
        <StatCard detail="Total subscriptions" icon={<ReceiptText className="size-5" />} label="Subscriptions" value={String(subscriptions.length)} />
      </section>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["overview", "invoices", "payments"] as const).map((tab) => (
          <button key={tab} className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab} type="button">
            {tab === "overview" ? "Overview" : tab === "invoices" ? "Subscriptions" : "Payments"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {activeTab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Payment Trend */}
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Revenue</p><h3 className="text-2xl font-black">Payment Trend</h3></CardHeader>
            <CardContent className="h-64">
              {paymentTrend.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">No payment data yet.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paymentTrend}>
                    <Tooltip />
                    <Line dataKey="amount" stroke="#111315" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Methods</p><h3 className="text-2xl font-black">Payment Methods</h3></CardHeader>
            <CardContent>
              {methodDist.length === 0 ? <p className="pt-8 text-center text-sm text-muted-foreground">No payment methods yet.</p> : (
                <div className="space-y-4">
                  {methodDist.map((m, i) => {
                    const pct = totalPaid > 0 ? Math.round((m.amount / totalPaid) * 100) : 0;
                    const colors = ["#111315", "#16a34a", "#0891b2", "#f59e0b", "#8b5cf6"];
                    return (
                      <div key={m.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold">{m.name}</span>
                          <span className="font-semibold text-muted-foreground">{formatCurrency(m.amount)} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Subscription Summary */}
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Subscription</p><h3 className="text-2xl font-black">Active Plan</h3></CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? <p className="pt-4 text-sm text-muted-foreground">No active subscription.</p> : (
                <div className="space-y-4">
                  {subscriptions.filter((s) => s.status === "active" || s.status === "trial").slice(0, 1).map((s) => (
                    <div key={s.id}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold capitalize">{s.plan_tier}</span>
                        <EnterpriseStatusBadge status={s.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-md bg-surface-muted p-3">
                          <p className="text-xs text-muted-foreground">Started</p>
                          <p className="text-lg font-bold">{s.starts_on ? new Date(s.starts_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</p>
                        </div>
                        <div className="rounded-md bg-surface-muted p-3">
                          <p className="text-xs text-muted-foreground">Renewal</p>
                          <p className="text-lg font-bold">{s.renews_on ? new Date(s.renews_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Info */}
          <Card>
            <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Business</p><h3 className="text-2xl font-black">Billing Info</h3></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div><p className="text-sm font-bold">Billing Email</p><p className="text-xs text-muted-foreground">Invoices sent to this address</p></div>
                <p className="text-sm font-bold">{dashboard.organization.billing_email ?? "Not set"}</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div><p className="text-sm font-bold">GST Number</p><p className="text-xs text-muted-foreground">Tax registration</p></div>
                <p className="text-sm font-bold">{((dashboard.organization.settings as Record<string, unknown>)?.gstNumber as string) ?? "—"}</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div><p className="text-sm font-bold">Currency</p><p className="text-xs text-muted-foreground">Default billing currency</p></div>
                <p className="text-sm font-bold">INR</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: INVOICES / SUBSCRIPTIONS ═══ */}
      {activeTab === "invoices" ? (
        <DataList
          headerTitle="Subscriptions"
          items={subItems}
          totalItems={subscriptions.length}
          totalPages={Math.ceil(subscriptions.length / 12)}
          currentPage={currentPage}
          onPageChange={(p) => navigate({ page: p })}
          pageSize={filters.pageSize ?? 12}
        />
      ) : null}

      {/* ═══ TAB: PAYMENTS ═══ */}
      {activeTab === "payments" ? (
        <DataList
          selectable
          bulkActions={[
            { label: "Export CSV", onClick: (ids) => {
              const data = payments.filter((p) => ids.includes(p.id)).map((p) => ({
                number: p.payment_number, amount: p.amount, currency: p.currency,
                type: p.payment_type, method: p.method, status: p.status, date: p.created_at,
                member: dashboard.members.find((m) => m.id === p.member_id)?.full_name,
              }));
              exportToCSV(data, "billing-payments");
            }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
          ]}
          headerTitle="Payments"
          items={paymentItems}
          totalItems={payments.length}
          totalPages={Math.ceil(payments.length / 12)}
          currentPage={currentPage}
          onPageChange={(p) => navigate({ page: p })}
          pageSize={filters.pageSize ?? 12}
        />
      ) : null}
    </div>
  );
}
