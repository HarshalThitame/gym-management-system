"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type HourlyPoint = {
  hour: string;
  visits: number;
};

type DailyPoint = {
  date: string;
  visits: number;
  uniqueMembers: number;
};

export function HourlyTrafficChart({ data }: { data: HourlyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(17,19,21,0.08)" vertical={false} />
          <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: "rgba(17,19,21,0.04)" }} />
          <Bar dataKey="visits" fill="#111315" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyAttendanceChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(17,19,21,0.08)" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip />
          <Line dataKey="visits" stroke="#111315" strokeWidth={2.5} dot={false} />
          <Line dataKey="uniqueMembers" stroke="#b7e339" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
