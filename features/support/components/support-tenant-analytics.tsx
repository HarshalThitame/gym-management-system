"use client";

import { useState } from "react";
import { Building2, Ticket, AlertTriangle, BarChart3 } from "lucide-react";

type TenantMetric = {
  organizationId: string;
  organizationName: string;
  totalTickets: number;
  openTickets: number;
  breachedCount: number;
  avgCsat: number;
};

export function SupportTenantAnalytics({ metrics }: { metrics: TenantMetric[] }) {
  const [sortBy, setSortBy] = useState<"total" | "open" | "csat">("total");

  const sorted = [...metrics].sort((a, b) => {
    if (sortBy === "open") return b.openTickets - a.openTickets;
    if (sortBy === "csat") return (a.avgCsat || 999) - (b.avgCsat || 999);
    return b.totalTickets - a.totalTickets;
  });

  const totalTickets = metrics.reduce((s, m) => s + m.totalTickets, 0);
  const totalOpen = metrics.reduce((s, m) => s + m.openTickets, 0);
  const totalBreached = metrics.reduce((s, m) => s + m.breachedCount, 0);
  const avgCsatAll = metrics.filter((m) => m.avgCsat > 0);
  const avgCsat = avgCsatAll.length > 0 ? avgCsatAll.reduce((s, m) => s + m.avgCsat, 0) / avgCsatAll.length : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><p className="text-[10px] font-semibold uppercase text-muted-foreground">Tenants</p></div>
          <p className="text-2xl font-bold mt-1">{metrics.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-blue-500" /><p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Tickets</p></div>
          <p className="text-2xl font-bold mt-1">{totalTickets}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><p className="text-[10px] font-semibold uppercase text-muted-foreground">Open</p></div>
          <p className="text-2xl font-bold mt-1">{totalOpen}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-green-500" /><p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg CSAT</p></div>
          <p className="text-2xl font-bold mt-1">{avgCsat > 0 ? avgCsat.toFixed(1) : "—"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Tenant Breakdown</p>
          <div className="flex gap-1">
            {(["total", "open", "csat"] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-[10px] px-2 py-1 rounded ${sortBy === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {s === "total" ? "By Volume" : s === "open" ? "By Open" : "By CSAT"}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {sorted.map((m) => (
            <div key={m.organizationId} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.organizationName}</p>
                <p className="text-[10px] text-muted-foreground">{m.totalTickets} tickets · {m.openTickets} open</p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className={m.breachedCount > 0 ? "text-red-600 font-medium" : "text-green-600"}>{m.breachedCount} breached</span>
                <span>{m.avgCsat > 0 ? `${m.avgCsat.toFixed(1)} CSAT` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
