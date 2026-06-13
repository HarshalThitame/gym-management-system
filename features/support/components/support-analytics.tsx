"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TicketsBarChart, TicketsPieChart, TicketsLineChart, AgentBarChart } from "./support-enterprise-charts";
import type { SupportDashboard } from "@/types/enterprise";

function KpiCard({
  label, value, sub, trend, color,
}: {
  label: string; value: string | number; sub?: string;
  trend?: "up" | "down" | "neutral";
  color?: "good" | "watch" | "risk";
}) {
  const colorMap = {
    good: "text-green-600", watch: "text-amber-600", risk: "text-red-600",
  };
  const trendIcon = trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between mt-1">
        <p className={`text-2xl font-bold ${color ? colorMap[color] : ""}`}>{value}</p>
        {trend && <div className={`flex items-center gap-0.5 text-xs ${trendColor}`}>{trendIcon}{trend}</div>}
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function SupportAnalytics({ dashboard }: { dashboard: SupportDashboard }) {
  const [chartView, setChartView] = useState<"priority" | "status">("priority");

  const priorityData = dashboard.ticketsByPriority.map((t) => ({ name: t.priority.charAt(0).toUpperCase() + t.priority.slice(1), value: t.count }));
  const statusData = dashboard.ticketsByStatus.map((t) => ({ name: t.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), value: t.count }));
  const agentData = dashboard.agentPerformance.map((a) => ({ name: a.agentName, resolved: a.resolved, csat: Math.round(a.csat) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Open Tickets" value={dashboard.openTickets}
          color={dashboard.openTickets > 50 ? "risk" : dashboard.openTickets > 20 ? "watch" : "good"}
          trend={dashboard.openTickets > 0 ? "down" : "neutral"} />
        <KpiCard label="Closed" value={dashboard.closedTickets} color="good" trend="up" />
        <KpiCard label="SLA Compliance" value={`${dashboard.slaCompliancePercent}%`}
          color={dashboard.slaCompliancePercent >= 95 ? "good" : dashboard.slaCompliancePercent >= 80 ? "watch" : "risk"} />
        <KpiCard label="Breached" value={dashboard.breachedCount}
          color={dashboard.breachedCount > 0 ? "risk" : "good"}
          trend={dashboard.breachedCount > 0 ? "down" : "neutral"} />
        <KpiCard label="CSAT" value={dashboard.csatScore.toFixed(1)} sub="/ 10"
          color={dashboard.csatScore >= 8 ? "good" : dashboard.csatScore >= 6 ? "watch" : "risk"} />
        <KpiCard label="NPS" value={dashboard.npsScore.toFixed(1)} sub="/ 10"
          color={dashboard.npsScore >= 7 ? "good" : dashboard.npsScore >= 5 ? "watch" : "risk"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribution</p>
            <div className="flex gap-1">
              <button onClick={() => setChartView("priority")}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${chartView === "priority" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Priority</button>
              <button onClick={() => setChartView("status")}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${chartView === "status" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Status</button>
            </div>
          </div>
          {chartView === "priority" ? <TicketsBarChart data={priorityData} /> : <TicketsBarChart data={statusData} />}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ticket Breakdown</p>
          {chartView === "priority" ? <TicketsPieChart data={priorityData} /> : <TicketsPieChart data={statusData} />}
        </div>
      </div>

      {agentData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Agent Performance</p>
          <AgentBarChart data={agentData} />
        </div>
      )}
    </div>
  );
}
