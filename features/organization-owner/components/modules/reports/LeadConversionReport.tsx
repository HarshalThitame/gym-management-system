"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { downloadCSV } from "@/features/organization-owner/lib/csv-export";
import { Button } from "@/components/ui/button";
import type { LeadFunnelStage, LeadSourceBreakdown } from "@/features/organization-owner/services/report-service";

type ReportData = { funnel: LeadFunnelStage[]; sourceBreakdown: LeadSourceBreakdown[]; totalLeads: number; conversionRate: number; avgDaysToConvert: number | null };

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
        <p className="text-lg font-semibold text-muted-foreground">Lead Conversion Report</p>
        <p className="text-sm text-muted-foreground">Lead conversion report requires an upgrade.</p>
      </CardContent>
    </Card>
  );
}

const FUNNEL_COLORS = ["#8b5cf6", "#6366f1", "#0891b2", "#16a34a", "#f59e0b", "#dc2626"];

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function LeadConversionReport({ organizationId: _organizationId, hasFeature }: Props) {
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
      const res = await fetch(`/api/analytics/reports?type=lead_conversion&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        setError(err.error ?? "Failed to load data");
        setLoading(false);
        return;
      }
      setData((await res.json()) as ReportData);
    } catch {
      setError("Failed to load lead conversion data.");
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (hasFeature) fetchData(); }, [hasFeature, fetchData]);

  const stats = useMemo(() => {
    if (!data) return { totalLeads: 0, conversionRate: "0%", avgDays: "—" };
    return {
      totalLeads: data.totalLeads,
      conversionRate: `${data.conversionRate}%`,
      avgDays: data.avgDaysToConvert != null ? `${data.avgDaysToConvert} days` : "—",
    };
  }, [data]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    downloadCSV(
      ["Source", "Total Leads", "Won", "Conversion Rate"],
      data.sourceBreakdown.map((s) => [s.source, String(s.total), String(s.won), `${s.conversionRate}%`]),
      "lead-conversion-report"
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
        <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={!data || data.totalLeads === 0}>
          Export CSV
        </Button>
      </div>

      {loading ? <ChartSkeleton className="h-64" /> : error ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{error}</CardContent></Card>
      ) : !data || data.totalLeads === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No leads found for this period.</CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard detail="Leads created in period" label="Total Leads" value={String(stats.totalLeads)} />
            <StatCard detail="Win conversion rate" label="Conversion Rate" value={stats.conversionRate} />
            <StatCard detail="Average time from lead to won" label="Avg. Days to Convert" value={stats.avgDays} />
          </section>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Lead Funnel</h3><p className="text-sm text-muted-foreground">Lead count at each stage with conversion %</p></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.funnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(value, name, props) => {
                      const conv = (props.payload as LeadFunnelStage).conversionFromPrevious;
                      const convLabel = conv != null ? ` (${conv}% from prev)` : "";
                      return [`${value}${convLabel}`, "Count"];
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.funnel.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]!} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
            <div className="px-6 pb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {data.funnel.map((s) =>
                s.conversionFromPrevious != null ? (
                  <span key={s.stage}>
                    <span className="font-semibold text-foreground">{s.stage}</span>: {s.count} ({s.conversionFromPrevious}% from previous)
                  </span>
                ) : null
              )}
            </div>
          </Card>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Conversion by Source</h3><p className="text-sm text-muted-foreground">Lead source performance</p></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sourceBreakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="source" tick={{ fontSize: 10 }} tickLine={false} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#111315" radius={[6, 6, 0, 0]} name="Total Leads" />
                  <Bar dataKey="won" fill="#16a34a" radius={[6, 6, 0, 0]} name="Won" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Source Breakdown</h3></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Total Leads</th>
                      <th className="px-4 py-3 text-right">Won</th>
                      <th className="px-4 py-3 text-right">Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sourceBreakdown.map((s) => (
                      <tr key={s.source} className="border-b border-border/50 hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-medium capitalize">{s.source}</td>
                        <td className="px-4 py-3 text-right">{s.total}</td>
                        <td className="px-4 py-3 text-right">{s.won}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={s.conversionRate >= 30 ? "font-bold text-green-600" : s.conversionRate >= 15 ? "text-amber-600" : "text-red-600"}>
                            {s.conversionRate}%
                          </span>
                        </td>
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
