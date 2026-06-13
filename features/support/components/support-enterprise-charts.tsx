"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";


const CHART_COLORS = ["#111315", "#16a34a", "#2563eb", "#d97706", "#dc2626", "#8b5cf6", "#0891b2", "#be185d"] as const;

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TicketsBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 } as never}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 } as never} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 } as never} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TicketsLineChart({ data }: { data: Array<{ date: string; created: number; resolved: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="created" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="resolved" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TicketsPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="value" strokeWidth={0}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentBarChart({ data }: { data: { name: string; resolved: number; csat: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 } as never} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 } as never} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 } as never} tickLine={false} axisLine={false} width={100} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="resolved" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} maxBarSize={24} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
