"use client";

import type { ReactNode } from "react";
import { CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { OrganizationDetailData } from "../../services/organization-management-service";

export function OrgBillingTab({ data }: { data: OrganizationDetailData }) {
  const payments = data.recentPayments || [];
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthPayments = payments.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const currentMonthRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const thisYearPayments = payments.filter((p) => new Date(p.created_at).getFullYear() === currentYear);
  const thisYearRevenue = thisYearPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const avgPaymentValue = payments.length > 0 ? totalRevenue / payments.length : 0;

  const monthlyData: Record<string, { month: string; revenue: number; count: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthlyData[key] = { month: label, revenue: 0, count: 0 };
  }
  for (const p of payments) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[key]) {
      monthlyData[key].revenue += Number(p.amount || 0);
      monthlyData[key].count += 1;
    }
  }
  const chartData = Object.values(monthlyData);

  const gymRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
  for (const p of payments) {
    const gymId = String((p as Record<string, unknown>).gym_id || "unknown");
    if (!gymRevenue[gymId]) {
      const gym = data.gyms.find((g) => g.id === gymId);
      gymRevenue[gymId] = { name: gym?.name ?? "Unknown Gym", revenue: 0, count: 0 };
    }
    gymRevenue[gymId].revenue += Number(p.amount || 0);
    gymRevenue[gymId].count += 1;
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevenueKpiCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <RevenueKpiCard label="Current Month Revenue" value={formatCurrency(currentMonthRevenue)} />
        <RevenueKpiCard label="Average Payment Value" value={formatCurrency(avgPaymentValue)} />
        <RevenueKpiCard label="Revenue This Year" value={formatCurrency(thisYearRevenue)} />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Revenue Trend (Last 12 Months)</h3>
        </CardHeader>
        <CardContent>
          {chartData.some((d) => d.revenue > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#888" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#888" />
                  <Tooltip
                    contentStyle={{ fontSize: 13 }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">No revenue data available for chart rendering.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <InfoCard title="Subscription" icon={<CreditCard className="size-5" />}>
          <Line label="Package" value={data.record.subscription.packageName ?? "Unassigned"} />
          <Line label="Status" value={data.record.subscription.status ? formatEnterpriseLabel(data.record.subscription.status) : "Unassigned"} />
          <Line label="Started" value={formatDate(data.record.subscription.startedAt)} />
          <Line label="Expires" value={data.record.subscription.expiresAt ? formatDate(data.record.subscription.expiresAt) : "Never"} />
          <Line label="Member limit" value={limitLabel(data.record.subscription.maxMembers)} />
          <Line label="Branch limit" value={limitLabel(data.record.subscription.maxBranches)} />
        </InfoCard>

        {Object.keys(gymRevenue).length > 1 && (
          <Card>
            <CardHeader>
              <h3 className="text-xl font-black">Revenue by Gym</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.values(gymRevenue).map((gym) => (
                <div key={gym.name} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">{gym.name}</p>
                    <p className="text-sm font-black">{formatCurrency(gym.revenue)}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{gym.count} payment(s)</span>
                    <span>·</span>
                    <span>{totalRevenue > 0 ? `${((gym.revenue / totalRevenue) * 100).toFixed(1)}%` : "0%"}</span>
                  </div>
                  {totalRevenue > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(gym.revenue / totalRevenue) * 100}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h3 className="text-xl font-black">Recent Payments</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length > 0 ? payments.map((payment) => (
              <div className="rounded-md border border-border bg-background p-4" key={payment.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{payment.payment_number}</p>
                  <EnterpriseStatusBadge status={payment.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(Number(payment.amount), payment.currency)} · {formatEnterpriseLabel(payment.method)} · {formatDateTime(payment.created_at)}</p>
              </div>
            )) : (
              <p className="text-sm font-semibold text-muted-foreground">No payments were found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RevenueKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs reveal-up">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function InfoCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xl font-black">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-black">{value}</span>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function limitLabel(value: number | null) {
  if (value === null) return "Not configured";
  return value === -1 ? "Unlimited" : formatCompactNumber(value);
}