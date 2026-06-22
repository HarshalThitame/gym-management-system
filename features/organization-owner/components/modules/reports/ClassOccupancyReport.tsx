"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { downloadCSV } from "@/features/organization-owner/lib/csv-export";
import { Button } from "@/components/ui/button";
import type { ClassOccupancy } from "@/features/organization-owner/services/report-service";

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
        <p className="text-lg font-semibold text-muted-foreground">Class Occupancy Report</p>
        <p className="text-sm text-muted-foreground">Class occupancy report requires an upgrade.</p>
      </CardContent>
    </Card>
  );
}

function occupancyColor(pct: number) {
  if (pct >= 80) return "#16a34a";
  if (pct >= 50) return "#f59e0b";
  return "#dc2626";
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ClassOccupancyReport({ organizationId: _organizationId, hasFeature }: Props) {
  void _organizationId;
  const [data, setData] = useState<ClassOccupancy[] | null>(null);
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
      const res = await fetch(`/api/analytics/reports?type=class_occupancy&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        setError(err.error ?? "Failed to load data");
        setLoading(false);
        return;
      }
      setData((await res.json()) as ClassOccupancy[]);
    } catch {
      setError("Failed to load class occupancy data.");
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (hasFeature) fetchData(); }, [hasFeature, fetchData]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return { totalClasses: 0, avgOccupancy: "0%", mostPopular: "—", underPerforming: 0 };
    const totalSessions = data.reduce((s, c) => s + c.sessionCount, 0);
    const avgOcc = totalSessions > 0 ? Math.round(data.reduce((s, c) => s + c.occupancyPercent * c.sessionCount, 0) / totalSessions) : 0;
    const mostPopular = [...data].sort((a, b) => b.occupancyPercent - a.occupancyPercent)[0]?.classType ?? "—";
    const underPerforming = data.filter((c) => c.occupancyPercent < 50).length;
    return {
      totalClasses: data.reduce((s, c) => s + c.sessionCount, 0),
      avgOccupancy: `${avgOcc}%`,
      mostPopular,
      underPerforming,
    };
  }, [data]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    downloadCSV(
      ["Class Type", "Sessions", "Total Slots", "Total Booked", "Occupancy %", "Avg Attendees"],
      data.map((c) => [c.classType, String(c.sessionCount), String(c.totalSlots), String(c.totalBooked), `${c.occupancyPercent}%`, String(c.avgAttendees)]),
      "class-occupancy-report"
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
        <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={!data || data.length === 0}>
          Export CSV
        </Button>
      </div>

      {loading ? <ChartSkeleton className="h-64" /> : error ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{error}</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No class occupancy data for this period.</CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard detail="Total class sessions held" label="Total Classes" value={String(stats.totalClasses)} />
            <StatCard detail="Weighted average fill rate" label="Avg Occupancy" value={stats.avgOccupancy} />
            <StatCard detail="Best performing class type" label="Most Popular" value={stats.mostPopular} />
            <StatCard detail="Classes under 50% occupancy" label="Under-Performing" value={String(stats.underPerforming)} />
          </section>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Occupancy by Class Type</h3><p className="text-sm text-muted-foreground">Color: green &ge;80%, yellow 50-79%, red &lt;50%</p></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="classType" tick={{ fontSize: 10 }} tickLine={false} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value) => [`${value}%`, "Occupancy"]} />
                  <Bar dataKey="occupancyPercent" radius={[6, 6, 0, 0]}>
                    {data.slice(0, 12).map((d, i) => <Cell key={i} fill={occupancyColor(d.occupancyPercent)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Class Occupancy Details</h3></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">Class Type</th>
                      <th className="px-4 py-3 text-right">Sessions</th>
                      <th className="px-4 py-3 text-right">Capacity</th>
                      <th className="px-4 py-3 text-right">Booked</th>
                      <th className="px-4 py-3 text-right">Occupancy</th>
                      <th className="px-4 py-3 text-right">Avg Attendees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((c) => (
                      <tr key={c.classType} className={`border-b border-border/50 hover:bg-surface-muted/50 ${c.occupancyPercent < 50 ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}>
                        <td className="px-4 py-3 font-medium">{c.classType}</td>
                        <td className="px-4 py-3 text-right">{c.sessionCount}</td>
                        <td className="px-4 py-3 text-right">{c.totalSlots}</td>
                        <td className="px-4 py-3 text-right">{c.totalBooked}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={c.occupancyPercent < 50 ? "font-bold text-red-600" : ""}>{c.occupancyPercent}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">{c.avgAttendees}</td>
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
