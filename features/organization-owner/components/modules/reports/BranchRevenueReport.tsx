"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { downloadCSV } from "@/features/organization-owner/lib/csv-export";
import { Button } from "@/components/ui/button";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import type { BranchRevenueComparison, BranchRevenueTimeSeries } from "@/features/organization-owner/services/report-service";

type ReportData = { branches: BranchRevenueComparison[]; timeSeries: BranchRevenueTimeSeries[] };

const PRESET_RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

type Props = { organizationId: string; hasFeature: boolean };

function LockedMessage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-lg font-semibold text-muted-foreground">Branch Revenue Comparison</p>
        <p className="text-sm text-muted-foreground">Branch revenue comparison report requires an upgrade.</p>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = ["#111315", "#16a34a", "#0891b2", "#f59e0b", "#dc2626", "#8b5cf6", "#ec4899", "#14b8a6"];

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function BranchRevenueReport({ organizationId: _organizationId, hasFeature }: Props) {
  void _organizationId;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => formatISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [dateTo, setDateTo] = useState(() => formatISODate(new Date()));
  const [preset, setPreset] = useState("30d");

  const applyPreset = useCallback((days: number, label: string) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    setDateFrom(formatISODate(from));
    setDateTo(formatISODate(to));
    setPreset(label);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/reports?type=branch_revenue&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        setError(err.error ?? "Failed to load data");
        setLoading(false);
        return;
      }
      setData((await res.json()) as ReportData);
    } catch {
      setError("Failed to load branch revenue data.");
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (hasFeature) fetchData(); }, [hasFeature, fetchData]);

  const stats = useMemo(() => {
    if (!data || data.branches.length === 0) return { totalRevenue: "0", topBranch: "—", avgRevenuePerMember: "0" };
    const totalRevenue = data.branches.reduce((s, b) => s + b.totalRevenue, 0);
    const topBranch = data.branches[0]?.branchName ?? "—";
    const avgRpm = data.branches.length > 0
      ? Math.round(data.branches.reduce((s, b) => s + b.revenuePerMember, 0) / data.branches.length)
      : 0;
    return {
      totalRevenue: formatCurrency(totalRevenue),
      topBranch,
      avgRevenuePerMember: formatCurrency(avgRpm),
    };
  }, [data]);

  const trendData = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, Record<string, number>>();
    for (const t of data.timeSeries) {
      if (!byDate.has(t.date)) byDate.set(t.date, {});
      byDate.get(t.date)![t.branchName] = t.revenue;
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [data]);

  const lineChartBranches = useMemo(() => data ? data.branches.slice(0, 5).map((b) => b.branchName) : [], [data]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    downloadCSV(
      ["Gym", "Total Revenue", "Avg Members", "Attendance", "Revenue/Member"],
      data.branches.map((b) => [b.branchName, String(b.totalRevenue), String(b.memberCount), String(b.attendanceCount), String(b.revenuePerMember)]),
      "gym-revenue-report"
    );
  }, [data]);

  if (!hasFeature) return <LockedMessage />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        {PRESET_RANGES.map((r) => (
          <Button key={r.label} variant={preset === r.label ? "primary" : "outline"} size="sm" onClick={() => applyPreset(r.days, r.label)} type="button">
            {r.label}
          </Button>
        ))}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted-foreground">From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted-foreground">To</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
        </div>
        <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={!data || data.branches.length === 0}>
          Export CSV
        </Button>
      </div>

      {loading ? <ChartSkeleton className="h-64" /> : error ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{error}</CardContent></Card>
      ) : !data || data.branches.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No branch revenue data for this period.</CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard detail="Combined revenue in period" label="Total Revenue" value={stats.totalRevenue} />
            <StatCard detail="Highest-grossing branch" label="Top Branch" value={stats.topBranch} />
            <StatCard detail="Average revenue per member" label="Rev / Member" value={stats.avgRevenuePerMember} />
          </section>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Revenue by Branch</h3><p className="text-sm text-muted-foreground">Total revenue comparison</p></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.branches.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="branchName" tick={{ fontSize: 10 }} tickLine={false} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), "Revenue"]} />
                  <Bar dataKey="totalRevenue" radius={[6, 6, 0, 0]}>
                    {data.branches.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {trendData.length > 1 ? (
            <Card>
              <CardHeader><h3 className="text-2xl font-black">Revenue Trend by Branch</h3><p className="text-sm text-muted-foreground">Daily revenue over time</p></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} />
                    <Tooltip formatter={(value) => [formatCurrency(value as number), ""]} />
                    <Legend />
                    {lineChartBranches.map((bn, i) => (
                      <Line key={bn} type="monotone" dataKey={bn} stroke={CHART_COLORS[i % CHART_COLORS.length]!} strokeWidth={2} dot={{ r: 2 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Branch Revenue Details</h3></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Avg Members</th>
                      <th className="px-4 py-3 text-right">Attendance</th>
                      <th className="px-4 py-3 text-right">Rev / Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.branches.map((b) => (
                      <tr key={b.branchId} className="border-b border-border/50 hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-medium">{b.branchName}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(b.totalRevenue)}</td>
                        <td className="px-4 py-3 text-right">{b.memberCount}</td>
                        <td className="px-4 py-3 text-right">{b.attendanceCount}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(b.revenuePerMember)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
