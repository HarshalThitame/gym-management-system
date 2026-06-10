"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BranchPerformancePoint, TenantUsagePoint } from "@/types/enterprise";

export function BranchPerformanceChart({ data }: { data: BranchPerformancePoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="branchName" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          <Bar dataKey="revenue" fill="#111315" radius={[6, 6, 0, 0]} />
          <Bar dataKey="members" fill="#16a34a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TenantUsageChart({ data }: { data: TenantUsagePoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="organizationName" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} tickLine={false} />
          <Tooltip formatter={(value) => [`${value}%`, "Utilization"]} />
          <Bar dataKey="branchPercent" fill="#111315" radius={[6, 6, 0, 0]} />
          <Bar dataKey="memberPercent" fill="#0891b2" radius={[6, 6, 0, 0]} />
          <Bar dataKey="storagePercent" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
