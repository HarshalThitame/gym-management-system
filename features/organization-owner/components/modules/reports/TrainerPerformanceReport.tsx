"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { downloadCSV } from "@/features/organization-owner/lib/csv-export";
import { Button } from "@/components/ui/button";
import type { TrainerPerformance } from "@/features/organization-owner/services/report-service";

type ReportResponse = { trainers: TrainerPerformance[]; monthlyTrend: { month: string; totalSessions: number; totalAttendees: number }[] };

const CHART_COLORS = ["#111315", "#16a34a", "#0891b2", "#f59e0b", "#dc2626", "#8b5cf6", "#ec4899", "#14b8a6"];

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
        <p className="text-lg font-semibold text-muted-foreground">Trainer Performance Report</p>
        <p className="text-sm text-muted-foreground">Trainer performance report requires an upgrade.</p>
      </CardContent>
    </Card>
  );
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function TrainerPerformanceReport({ organizationId: _organizationId, hasFeature }: Props) {
  void _organizationId;
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => formatISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [dateTo, setDateTo] = useState(() => formatISODate(new Date()));
  const [trainerFilter, setTrainerFilter] = useState("all");
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
      const res = await fetch(`/api/analytics/reports?type=trainer_performance&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        setError(err.error ?? "Failed to load data");
        setLoading(false);
        return;
      }
      setReport((await res.json()) as ReportResponse);
    } catch {
      setError("Failed to load trainer performance data.");
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (hasFeature) fetchData(); }, [hasFeature, fetchData]);

  const data = report?.trainers ?? null;
  const monthlyTrend = report?.monthlyTrend ?? [];
  const allTrainers = report?.trainers ?? [];

  const filteredData = useMemo(() => {
    if (!data) return null;
    if (trainerFilter === "all") return data;
    return data.filter((t) => t.trainerId === trainerFilter);
  }, [data, trainerFilter]);

  const stats = useMemo(() => {
    const d = filteredData;
    if (!d || d.length === 0) return { totalTrainers: 0, totalSessions: 0, avgRating: "0.0", totalAttendees: 0 };
    const totalSessions = d.reduce((s, t) => s + t.totalSessions, 0);
    const totalAttendees = d.reduce((s, t) => s + t.totalAttendees, 0);
    const ratings = d.filter((t) => t.avgRating > 0);
    const avgRating = ratings.length > 0 ? (ratings.reduce((s, t) => s + t.avgRating, 0) / ratings.length).toFixed(1) : "N/A";
    return { totalTrainers: d.length, totalSessions, avgRating, totalAttendees };
  }, [filteredData]);

  const handleExportCSV = useCallback(() => {
    if (!filteredData) return;
    downloadCSV(
      ["Trainer", "Total Sessions", "PT Sessions", "Class Sessions", "Avg Rating", "Total Attendees"],
      filteredData.map((t) => [t.trainerName, String(t.totalSessions), String(t.ptSessions), String(t.classSessions), String(t.avgRating), String(t.totalAttendees)]),
      "trainer-performance-report"
    );
  }, [filteredData]);

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
        {allTrainers && allTrainers.length > 1 ? (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-muted-foreground">Trainer</label>
            <select value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
              <option value="all">All Trainers</option>
              {allTrainers.map((t) => <option key={t.trainerId} value={t.trainerId}>{t.trainerName}</option>)}
            </select>
          </div>
        ) : null}
        <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={!filteredData || filteredData.length === 0}>
          Export CSV
        </Button>
      </div>

      {loading ? <ChartSkeleton className="h-64" /> : error ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{error}</CardContent></Card>
      ) : !filteredData || filteredData.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No trainer performance data for this period.</CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard detail="Total trainers in period" label="Trainers" value={String(stats.totalTrainers)} />
            <StatCard detail="Total sessions conducted" label="Sessions" value={String(stats.totalSessions)} />
            <StatCard detail="Average trainer rating" label="Avg Rating" value={stats.avgRating} />
            <StatCard detail="Total check-in attendees" label="Attendees" value={String(stats.totalAttendees)} />
          </section>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Sessions per Trainer</h3></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="trainerName" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="totalSessions" radius={[0, 4, 4, 0]}>
                    {filteredData.slice(0, 12).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {monthlyTrend.length > 1 ? (
            <Card>
              <CardHeader><h3 className="text-2xl font-black">Sessions Over Time</h3><p className="text-sm text-muted-foreground">Monthly trend of all sessions and attendees</p></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="totalSessions" stroke="#111315" strokeWidth={2} dot={{ r: 3 }} name="Sessions" />
                    <Line type="monotone" dataKey="totalAttendees" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} name="Attendees" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Trainer Details</h3></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">Trainer</th>
                      <th className="px-4 py-3 text-right">Total Sessions</th>
                      <th className="px-4 py-3 text-right">PT Sessions</th>
                      <th className="px-4 py-3 text-right">Class Sessions</th>
                      <th className="px-4 py-3 text-right">Rating</th>
                      <th className="px-4 py-3 text-right">Attendees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((t) => (
                      <tr key={t.trainerId} className="border-b border-border/50 hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-medium">{t.trainerName}</td>
                        <td className="px-4 py-3 text-right">{t.totalSessions}</td>
                        <td className="px-4 py-3 text-right">{t.ptSessions}</td>
                        <td className="px-4 py-3 text-right">{t.classSessions}</td>
                        <td className="px-4 py-3 text-right">{t.avgRating > 0 ? t.avgRating.toFixed(1) : "—"}</td>
                        <td className="px-4 py-3 text-right">{t.totalAttendees}</td>
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
