"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";

type AnalyticsIntelligenceProps = {
  dashboard: OrganizationOwnerDashboard;
};

const CHART_COLORS = ["#111315", "#16a34a", "#0891b2", "#f59e0b", "#dc2626", "#8b5cf6", "#ec4899", "#14b8a6"];

export function AnalyticsIntelligence({ dashboard }: AnalyticsIntelligenceProps) {
  const [tab, setTab] = useState<"revenue" | "cohort" | "churn">("revenue");

  const revenueTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of dashboard.branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(m.revenue_amount ?? 0));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, revenue]) => ({ date, revenue }));
  }, [dashboard.branchMetrics]);

  const memberTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of dashboard.branchMetrics) {
      if (!m.metric_date) continue;
      const month = m.metric_date.slice(0, 7);
      byMonth.set(month, Math.max(byMonth.get(month) ?? 0, Number(m.active_members ?? 0)));
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, members]) => ({ date, members }));
  }, [dashboard.branchMetrics]);

  const planDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plan of dashboard.membershipPlans) {
      counts.set(plan.plan_type, (counts.get(plan.plan_type) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [dashboard.membershipPlans]);

  const branchRevenue = useMemo(() => {
    return dashboard.branches.map((b) => {
      const rev = dashboard.branchMetrics.filter((m) => m.branch_id === b.id).reduce((s, m) => s + Number(m.revenue_amount ?? 0), 0);
      return { name: b.name, revenue: rev };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [dashboard.branches, dashboard.branchMetrics]);

  // Churn prediction: estimate at-risk members (inactive > 60 days)
  const churnPrediction = useMemo(() => {
    const now = Date.now();
    return dashboard.members.filter((m) => {
      if (m.status !== "active") return false;
      if (!m.joined_at) return false;
      const daysSinceJoin = (now - new Date(m.joined_at).getTime()) / 86400000;
      return daysSinceJoin > 90 && !m.assigned_trainer_id;
    });
  }, [dashboard.members]);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["revenue", "cohort", "churn"] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            type="button"
          >
            {t === "revenue" ? "Revenue Intelligence" : t === "cohort" ? "Cohort Analysis" : "Churn Prediction"}
          </button>
        ))}
      </div>

      {/* Revenue Intelligence */}
      {tab === "revenue" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><h3 className="text-xl font-black">Revenue Trend (12 months)</h3></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  <Tooltip />
                  <Line dataKey="revenue" stroke="#111315" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-xl font-black">Revenue by Branch</h3></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchRevenue} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} tickLine={false} width={100} />
                  <Tooltip />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {branchRevenue.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-xl font-black">Plan Distribution</h3></CardHeader>
            <CardContent className="h-64">
              {planDistribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No plan data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {planDistribution.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-xl font-black">Member Growth</h3></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memberTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  <Tooltip />
                  <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Cohort Analysis */}
      {tab === "cohort" ? (
        <Card>
          <CardHeader><h3 className="text-xl font-black">Member Retention by Signup Month</h3></CardHeader>
          <CardContent>
            {memberTrend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Not enough data for cohort analysis yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Active Members</th>
                      <th className="px-3 py-2">Growth</th>
                      <th className="px-3 py-2">Retention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {memberTrend.slice(-12).map((row, i, arr) => {
                      const prev = arr[i - 1]?.members ?? 0;
                      const growth = prev > 0 ? ((row.members - prev) / prev * 100).toFixed(1) : "—";
                      const retention = prev > 0 ? Math.min(100, Math.round((row.members / prev) * 100)) : 100;
                      return (
                        <tr key={row.date} className="hover:bg-surface-muted/50">
                          <td className="px-3 py-2 font-bold">{row.date}</td>
                          <td className="px-3 py-2">{formatCompactNumber(row.members)}</td>
                          <td className={`px-3 py-2 font-semibold ${typeof growth === "string" && !isNaN(Number(growth)) && Number(growth) > 0 ? "text-green-600" : "text-red-600"}`}>
                            {typeof growth === "string" ? (Number(growth) > 0 ? `+${growth}%` : `${growth}%`) : growth}
                          </td>
                          <td className="px-3 py-2">{retention}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Churn Prediction */}
      {tab === "churn" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black">At-Risk Members</h3>
                <p className="text-sm text-muted-foreground">Active members with no trainer assigned and inactive for &gt;90 days</p>
              </div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">{churnPrediction.length} at risk</span>
            </div>
          </CardHeader>
          <CardContent>
            {churnPrediction.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No members currently at risk. Great retention!</p>
            ) : (
              <div className="space-y-3">
                {churnPrediction.slice(0, 20).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <div>
                      <p className="text-sm font-bold">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.phone} · Joined {m.joined_at ? new Date(m.joined_at).toLocaleDateString("en-IN") : "N/A"}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">High risk</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
