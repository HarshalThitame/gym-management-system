"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ClassUtilizationChart({ data }: { data: Array<{ className: string; fillRate: number; booked: number; capacity: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="className" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} tickLine={false} />
          <Tooltip formatter={(value, name) => [name === "fillRate" ? `${value}%` : value, name === "fillRate" ? "Fill rate" : name]} />
          <Bar dataKey="fillRate" fill="#111315" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassBookingTrendChart({ data }: { data: Array<{ date: string; bookings: number; cancellations: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          <Line dataKey="bookings" dot={false} stroke="#111315" strokeWidth={2.5} type="monotone" />
          <Line dataKey="cancellations" dot={false} stroke="#d92d20" strokeWidth={2.5} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
