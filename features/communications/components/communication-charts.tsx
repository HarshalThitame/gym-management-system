"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CampaignPerformanceSummaryRow, CommunicationDailySummaryRow } from "@/types/communications";
import { calculateCampaignRates } from "../lib/business-rules";

export function ChannelVolumeChart({ data }: { data: CommunicationDailySummaryRow[] }) {
  const rows = Object.values(data.reduce<Record<string, { date: string; email: number; whatsapp: number; sms: number; inApp: number }>>((acc, row) => {
    const date = row.communication_date ?? "Unknown";
    acc[date] ??= { date, email: 0, whatsapp: 0, sms: 0, inApp: 0 };
    if (row.channel === "email") {
      acc[date].email += row.total ?? 0;
    }
    if (row.channel === "whatsapp") {
      acc[date].whatsapp += row.total ?? 0;
    }
    if (row.channel === "sms") {
      acc[date].sms += row.total ?? 0;
    }
    if (row.channel === "in_app" || row.channel === "push") {
      acc[date].inApp += row.total ?? 0;
    }
    return acc;
  }, {})).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          <Line dataKey="email" dot={false} stroke="#111315" strokeWidth={2.5} type="monotone" />
          <Line dataKey="whatsapp" dot={false} stroke="#16a34a" strokeWidth={2.5} type="monotone" />
          <Line dataKey="sms" dot={false} stroke="#0891b2" strokeWidth={2.5} type="monotone" />
          <Line dataKey="inApp" dot={false} stroke="#f59e0b" strokeWidth={2.5} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignPerformanceChart({ data }: { data: CampaignPerformanceSummaryRow[] }) {
  const rows = data.slice(0, 10).map((campaign) => {
    const rates = calculateCampaignRates(campaign);
    return {
      name: campaign.name ?? "Campaign",
      deliveryRate: rates.deliveryRate,
      openRate: rates.openRate,
      clickRate: rates.clickRate
    };
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} tickLine={false} />
          <Tooltip formatter={(value) => [`${value}%`, "Rate"]} />
          <Bar dataKey="deliveryRate" fill="#111315" radius={[6, 6, 0, 0]} />
          <Bar dataKey="openRate" fill="#16a34a" radius={[6, 6, 0, 0]} />
          <Bar dataKey="clickRate" fill="#0891b2" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
