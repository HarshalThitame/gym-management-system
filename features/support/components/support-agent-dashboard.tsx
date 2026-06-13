"use client";

import { useState } from "react";
import { BarChart3, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users, Ticket } from "lucide-react";
import type { AgentMetrics } from "../services/support-agent-service";

function AgentKpiCard({
  icon, label, value, sub, trend, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  color?: "green" | "amber" | "red" | "blue";
}) {
  const colorMap = {
    green: "text-green-600 bg-green-50 border-green-200",
    amber: "text-amber-600 bg-amber-50 border-amber-200",
    red: "text-red-600 bg-red-50 border-red-200",
    blue: "text-blue-600 bg-blue-50 border-blue-200",
  };
  const iconColor = color ? colorMap[color] : "text-foreground bg-muted border-border";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-md border ${iconColor}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
          <TrendingUp className={`h-3 w-3 ${trend === "down" ? "rotate-180" : ""}`} />
          {trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}
        </div>
      )}
    </div>
  );
}

function AgentRow({ agent, rank }: { agent: AgentMetrics; rank: number }) {
  const csatColor = agent.avgCsat >= 8 ? "text-green-600" : agent.avgCsat >= 6 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{agent.agentName}</p>
        <p className="text-[10px] text-muted-foreground">ID: {agent.agentId.slice(0, 8)}</p>
      </div>
      <div className="flex items-center gap-4 text-xs shrink-0">
        <div className="text-center min-w-[40px]">
          <p className="font-bold">{agent.activeTickets}</p>
          <p className="text-[10px] text-muted-foreground">Active</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-bold text-green-600">{agent.resolvedToday}</p>
          <p className="text-[10px] text-muted-foreground">Today</p>
        </div>
        <div className="text-center min-w-[50px]">
          <p className="font-bold">{agent.resolvedThisWeek}</p>
          <p className="text-[10px] text-muted-foreground">This Week</p>
        </div>
        <div className="text-center min-w-[50px]">
          <p className="font-bold">{agent.resolvedThisMonth}</p>
          <p className="text-[10px] text-muted-foreground">This Month</p>
        </div>
        <div className="text-center min-w-[30px]">
          <p className={`font-bold ${csatColor}`}>{agent.avgCsat > 0 ? agent.avgCsat.toFixed(1) : "—"}</p>
          <p className="text-[10px] text-muted-foreground">CSAT</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className={`font-bold ${agent.breachedTickets > 0 ? "text-red-600" : "text-green-600"}`}>{agent.breachedTickets}</p>
          <p className="text-[10px] text-muted-foreground">Breached</p>
        </div>
      </div>
    </div>
  );
}

export function SupportAgentDashboard({ metrics }: { metrics: AgentMetrics[] }) {
  const [activeTab, setActiveTab] = useState<"overview" | "workload">("overview");

  const totalActive = metrics.reduce((s, m) => s + m.activeTickets, 0);
  const totalResolved = metrics.reduce((s, m) => s + m.resolvedToday, 0);
  const totalBreached = metrics.reduce((s, m) => s + m.breachedTickets, 0);
  const totalCsat = metrics.filter((m) => m.avgCsat > 0);
  const avgCsat = totalCsat.length > 0 ? totalCsat.reduce((s, m) => s + m.avgCsat, 0) / totalCsat.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border">
        {(["overview", "workload"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "overview" ? "Agent Overview" : "Workload Distribution"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AgentKpiCard icon={<Ticket className="h-4 w-4" />} label="Active Tickets" value={totalActive} color="blue" />
            <AgentKpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved Today" value={totalResolved} color="green" trend="up" />
            <AgentKpiCard icon={<AlertTriangle className="h-4 w-4" />} label="SLA Breached" value={totalBreached} color="red" trend={totalBreached > 0 ? "down" : "up"} />
            <AgentKpiCard icon={<BarChart3 className="h-4 w-4" />} label="Avg CSAT" value={avgCsat > 0 ? avgCsat.toFixed(1) : "—"} color="blue" />
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Performance</p>
            </div>
            <div className="divide-y divide-border">
              {metrics.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No agent data available.
                </div>
              ) : (
                metrics.map((agent, i) => (
                  <AgentRow key={agent.agentId} agent={agent} rank={i + 1} />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "workload" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.length === 0 ? (
            <div className="col-span-full px-4 py-8 text-center text-sm text-muted-foreground">
              No workload data available.
            </div>
          ) : (
            metrics.map((agent) => {
              const total = agent.activeTickets + agent.resolvedThisMonth;
              const loadPercent = total > 0 ? Math.round((agent.activeTickets / Math.max(...metrics.map((m) => m.activeTickets + m.resolvedThisMonth), 1)) * 100) : 0;
              const barColor = loadPercent > 70 ? "bg-red-500" : loadPercent > 40 ? "bg-amber-500" : "bg-green-500";

              return (
                <div key={agent.agentId} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium truncate">{agent.agentName}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      agent.activeTickets > 10 ? "bg-red-100 text-red-700" : agent.activeTickets > 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}>
                      {agent.activeTickets} active
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, loadPercent)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>Workload: {loadPercent}%</span>
                    <span>{agent.resolvedThisMonth} resolved/mo</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
