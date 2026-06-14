"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";

type DashboardChartsProps = {
  dashboard: OrganizationOwnerDashboard;
};

export function DashboardCharts({ dashboard }: DashboardChartsProps) {
  const branchMetrics = dashboard.branchMetrics.slice(0, 30).reverse();

  // Revenue trend: aggregate by month from branch metrics
  const revenueByDate = new Map<string, number>();
  const attendanceByDate = new Map<string, number>();
  const memberByDate = new Map<string, number>();

  for (const m of branchMetrics) {
    const date = m.metric_date ? m.metric_date.slice(0, 7) : "unknown";
    revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + Number(m.revenue_amount ?? 0));
    attendanceByDate.set(date, (attendanceByDate.get(date) ?? 0) + Number(m.attendance_count ?? 0));
    memberByDate.set(date, Math.max(memberByDate.get(date) ?? 0, Number(m.active_members ?? 0)));
  }

  const trendData = Array.from(revenueByDate.entries()).map(([date, revenue]) => ({
    date,
    revenue,
    attendance: attendanceByDate.get(date) ?? 0,
    members: memberByDate.get(date) ?? 0
  }));

  // Branch performance data
  const branchPerf = dashboard.branches
    .map((b) => {
      const bm = dashboard.branchMetrics.filter((m) => m.branch_id === b.id);
      return {
        branchName: b.name,
        revenue: bm.reduce((s, m) => s + Number(m.revenue_amount ?? 0), 0),
        members: Math.max(...bm.map((m) => Number(m.active_members ?? 0)), 0),
        attendance: bm.reduce((s, m) => s + Number(m.attendance_count ?? 0), 0),
        trainerUtilization: bm.length > 0 ? bm.reduce((s, m) => s + Number(m.trainer_utilization ?? 0), 0) / bm.length : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Revenue Trend</p>
          <h3 className="text-2xl font-black">Revenue Over Time</h3>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-muted-foreground">No revenue data available yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  <Tooltip />
                  <Line dataKey="revenue" stroke="#111315" strokeWidth={2} dot={{ r: 3, fill: "#111315" }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Growth */}
      <Card>
        <CardHeader>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Members</p>
          <h3 className="text-2xl font-black">Member Growth</h3>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-muted-foreground">No member data available yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  <Tooltip />
                  <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance</p>
          <h3 className="text-2xl font-black">Attendance Over Time</h3>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-muted-foreground">No attendance data available yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  <Tooltip />
                  <Line dataKey="attendance" stroke="#0891b2" strokeWidth={2} dot={{ r: 3, fill: "#0891b2" }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branch Performance */}
      <Card>
        <CardHeader>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Branches</p>
          <h3 className="text-2xl font-black">Branch Performance</h3>
        </CardHeader>
        <CardContent>
          {branchPerf.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-muted-foreground">No branch metrics available yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={branchPerf}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="branchName" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#111315" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
