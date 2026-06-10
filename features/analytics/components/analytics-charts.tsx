"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttendanceHeatmapPoint, ClassScorecard, LeadFunnelPoint, MembershipTrendPoint, RevenueTrendPoint, TrainerScorecard } from "@/types/analytics";

const palette = ["#111315", "#16a34a", "#0891b2", "#f59e0b", "#d92d20", "#7c3aed"];

export function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${value}`} tickLine={false} />
          <Tooltip formatter={(value) => [`₹${value}`, "Revenue"]} />
          <Area dataKey="revenue" fill="#11131522" stroke="#111315" strokeWidth={2.5} type="monotone" />
          <Area dataKey="personalTraining" fill="#16a34a22" stroke="#16a34a" strokeWidth={2} type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MembershipTrendChart({ data }: { data: MembershipTrendPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          <Bar dataKey="newMembers" fill="#111315" radius={[6, 6, 0, 0]} />
          <Bar dataKey="renewals" fill="#16a34a" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expired" fill="#d92d20" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrainerUtilizationChart({ data }: { data: TrainerScorecard[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="trainerName" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} tickLine={false} />
          <Tooltip formatter={(value) => [`${value}%`, "Utilization"]} />
          <Bar dataKey="utilizationScore" fill="#111315" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassUtilizationAnalyticsChart({ data }: { data: ClassScorecard[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="className" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} tickLine={false} />
          <Tooltip formatter={(value) => [`${value}%`, "Fill rate"]} />
          <Bar dataKey="fillRate" fill="#0891b2" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadFunnelChart({ data }: { data: LeadFunnelPoint[] }) {
  const rows = data.slice(0, 8);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <PieChart>
          <Tooltip />
          <Pie data={rows} dataKey="leads" innerRadius={58} nameKey="status" outerRadius={96} paddingAngle={3}>
            {rows.map((row, index) => <Cell fill={palette[index % palette.length] ?? "#111315"} key={`${row.source}-${row.status}`} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttendanceHeatmap({ data }: { data: AttendanceHeatmapPoint[] }) {
  const max = Math.max(...data.map((point) => point.visits), 1);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
      {data.slice(0, 48).map((point) => {
        const intensity = Math.max(0.12, point.visits / max);
        return (
          <div className="rounded-md border border-border p-3" key={`${point.day}-${point.hour}`} style={{ backgroundColor: `rgba(17,19,21,${intensity})`, color: intensity > 0.55 ? "#ffffff" : "#111315" }}>
            <p className="text-xs font-black uppercase">{point.day}</p>
            <p className="mt-1 text-sm font-bold">{point.hour}</p>
            <p className="mt-2 text-2xl font-black">{point.visits}</p>
          </div>
        );
      })}
    </div>
  );
}
