"use client";

import { useMemo } from "react";
import { Activity, ArrowUpRight, Clock, TrendingUp, UsersRound } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OccupancyGauge, OccupancyMeter } from "./occupancy-meter";
import type { AttendanceSessionRow } from "@/types/attendance";
import type { MemberRow } from "@/types/membership";

type OccupancyDashboardProps = {
  currentSessions: Array<AttendanceSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
  hourlyTraffic: Array<{ hour: string; visits: number }>;
  dailyTrend: Array<{ date: string; visits: number; uniqueMembers: number }>;
  metrics: {
    currentInside: number;
    todayCheckIns: number;
    capacityPercentage: number;
    averageDuration: number;
    peakHour: number | null;
  };
  capacity?: number;
};

export function OccupancyDashboard({ currentSessions, hourlyTraffic, dailyTrend, metrics, capacity = 120 }: OccupancyDashboardProps) {
  const hourlyData = useMemo(() => {
    const now = new Date().getHours();
    return hourlyTraffic.filter((h) => Number(h.hour.slice(0, 2)) <= now + 1);
  }, [hourlyTraffic]);

  const trendData = useMemo(() => dailyTrend.slice(-14), [dailyTrend]);

  const avgDurationFormatted = metrics.averageDuration >= 60
    ? `${Math.floor(metrics.averageDuration / 60)}h ${metrics.averageDuration % 60}m`
    : `${metrics.averageDuration}m`;

  return (
    <div className="space-y-6">
      {/* ═══ KPI Grid ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Currently Inside</p>
            <UsersRound className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-black">{metrics.currentInside}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{metrics.capacityPercentage}% capacity</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Today</p>
            <Activity className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-black">{metrics.todayCheckIns}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">check-ins</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Avg Duration</p>
            <Clock className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-black">{avgDurationFormatted}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">per visit</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Peak Hour</p>
            <TrendingUp className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-black">{metrics.peakHour !== null ? `${String(metrics.peakHour).padStart(2, "0")}:00` : "—"}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">busiest hour</p>
        </div>
      </div>

      {/* ═══ Occupancy Gauge + Active Sessions ═══ */}
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Capacity</h3>
          </CardHeader>
          <CardContent className="flex justify-center">
            <OccupancyGauge capacity={capacity} current={metrics.currentInside} size="lg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Currently Inside ({currentSessions.length})</h3>
          </CardHeader>
          <CardContent>
            {currentSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-semibold text-muted-foreground">
                No members checked in right now
              </div>
            ) : (
              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {currentSessions.slice(0, 20).map((session) => (
                  <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3" key={session.id}>
                    <div>
                      <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{session.member?.member_code ?? ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">
                        {Math.round((Date.now() - new Date(session.check_in_at).getTime()) / 60000)}m
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts ═══ */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Today by Hour</h3>
          </CardHeader>
          <CardContent>
            {hourlyData.every((h) => h.visits === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No traffic data yet today.</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <Tooltip />
                    <Bar dataKey="visits" radius={[2, 2, 0, 0]}>
                      {hourlyData.map((h, i) => (
                        <Cell key={i} fill={h.visits > 0 ? "#16a34a" : "#e5e7eb"} />
                      ))}
                    </Bar>
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">14-Day Trend</h3>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No trend data available.</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <Tooltip />
                    <Bar dataKey="visits" fill="#16a34a" radius={[2, 2, 0, 0]} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
