"use client";

import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const CHART_COLORS = ["#111315", "#16a34a", "#2563eb", "#d97706", "#dc2626", "#8b5cf6", "#0891b2"];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-muted-foreground">{p.name}:</span><span className="font-medium">{p.value}</span></div>
      ))}
    </div>
  );
}

export function SecurityAnalyticsCharts({
  totalEvents, severityCounts, categoryCounts, riskTrends, threatStats,
}: {
  totalEvents: number;
  severityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  riskTrends: Array<Record<string, unknown>>;
  threatStats: { total: number; malicious: number; byType: Record<string, number> };
}) {
  const severityData = Object.entries(severityCounts).map(([name, value]) => ({ name, value }));
  const categoryData = Object.entries(categoryCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name: name?.replace(/_/g, " ") ?? "other", value }));
  const trendData = riskTrends.map((d) => ({ date: d.date as string, blocked: d.blocked as number, high: d.high as number, medium: d.medium as number }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Events</p><p className="text-2xl font-bold mt-1">{totalEvents.toLocaleString()}</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Critical</p><p className="text-2xl font-bold mt-1 text-red-600">{(severityCounts.critical ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Threat Intel</p><p className="text-2xl font-bold mt-1">{threatStats.total}</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Malicious Indicators</p><p className="text-2xl font-bold mt-1 text-red-600">{threatStats.malicious}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Events by Severity</p>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {severityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risk Trends (14 days)</p>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="high" stroke="#dc2626" strokeWidth={2} dot={false} name="High Risk" />
              <Line type="monotone" dataKey="medium" stroke="#d97706" strokeWidth={2} dot={false} name="Medium Risk" />
              <Line type="monotone" dataKey="blocked" stroke="#111315" strokeWidth={2} dot={false} name="Blocked" />
            </LineChart>
          </ResponsiveContainer></div>
        </div>

        {categoryData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Threat Categories</p>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="value" strokeWidth={0}>
                  {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer></div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">User Risk Distribution</p>
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-semibold text-muted-foreground">No user risk data available</p>
              <p className="text-xs text-muted-foreground mt-1">Risk distribution data appears once security events are tracked.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
