"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";

type RevenueChartPoint = {
  month: string;
  revenue: number;
  count: number;
};

export function OrganizationRevenueChart({ data }: { data: RevenueChartPoint[] }) {
  if (!data.some((d) => d.revenue > 0)) {
    return <p className="text-sm font-semibold text-muted-foreground">No revenue data available for chart rendering.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 12 }} />
          <YAxis stroke="#888" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ fontSize: 13 }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
