"use client";

import { useState } from "react";
import { Shield, AlertTriangle, Users, LogIn, Fingerprint, Monitor, Activity, TrendingUp, TrendingDown } from "lucide-react";
import type { EnterpriseSecurityDashboard } from "@/types/enterprise";

function KpiCard({ icon, label, value, status, trend, detail }: {
  icon: React.ReactNode; label: string; value: string | number;
  status: "good" | "watch" | "risk"; trend: "up" | "down" | "neutral"; detail?: string;
}) {
  const statusColors = { good: "text-green-600", watch: "text-amber-600", risk: "text-red-600" };
  const bgColors = { good: "bg-green-50 border-green-200", watch: "bg-amber-50 border-amber-200", risk: "bg-red-50 border-red-200" };
  const trendIcon = trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className={`mt-2 text-3xl font-black ${statusColors[status]}`}>{value}</p>
          {detail && <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>}
        </div>
        <div className={`grid size-11 shrink-0 place-items-center rounded-lg border ${bgColors[status]}`}>
          {icon}
        </div>
      </div>
      {trendIcon && (
        <div className={`mt-3 flex items-center gap-1 text-xs ${trendColor}`}>
          {trendIcon}
          <span className="font-medium">{trend === "up" ? "Rising" : "Declining"}</span>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "border-red-200 bg-red-50 text-red-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    low: "border-blue-200 bg-blue-50 text-blue-700",
    info: "border-gray-200 bg-gray-50 text-gray-600",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors[severity] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "border-red-200 bg-red-50 text-red-700",
    investigating: "border-amber-200 bg-amber-50 text-amber-800",
    contained: "border-blue-200 bg-blue-50 text-blue-700",
    resolved: "border-green-200 bg-green-50 text-green-700",
    closed: "border-gray-200 bg-gray-50 text-gray-600",
    dismissed: "border-gray-200 bg-gray-50 text-gray-600",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors[status] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>{status.replace(/_/g, " ")}</span>;
}

export function SecurityDashboard({
  dashboard, kpis, recentEvents, tenantRisk,
}: {
  dashboard: EnterpriseSecurityDashboard;
  kpis: Array<{ label: string; value: number; status: "good" | "watch" | "risk"; trend: "up" | "down" | "neutral"; detail: string }>;
  recentEvents: Array<Record<string, unknown>>;
  tenantRisk: Array<{ organizationId: string; total: number; critical: number; open: number; riskScore: number }>;
}) {
  const [eventFilter, setEventFilter] = useState("all");
  const filteredEvents = eventFilter === "all" ? recentEvents : recentEvents.filter((e) => e.severity === eventFilter);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} icon={
            i === 0 ? <Shield className="size-5" /> :
            i === 1 ? <AlertTriangle className="size-5" /> :
            i === 2 ? <Activity className="size-5" /> :
            i === 3 ? <LogIn className="size-5" /> :
            i === 4 ? <Fingerprint className="size-5" /> :
            <Monitor className="size-5" />
          } {...kpi} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Live Event Stream</p>
            <div className="flex gap-1">
              {["all", "critical", "high", "medium"].map((s) => (
                <button key={s} onClick={() => setEventFilter(s)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                    eventFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="size-10 text-green-500 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">All Clear</p>
                <p className="text-xs text-muted-foreground mt-1">No security events to display</p>
              </div>
            ) : filteredEvents.slice(0, 15).map((event) => (
              <div key={event.id as string} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={event.severity as string} />
                    <StatusBadge status={event.status as string} />
                  </div>
                  <p className="mt-1 text-sm font-medium truncate">{event.description as string}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.actor_id ? `User ${String(event.actor_id).slice(0, 8)}` : "System"}
                    {" · "}{event.created_at ? new Date(event.created_at as string).toLocaleString() : ""}
                  </p>
                </div>
                {event.source_ip ? <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{String(event.source_ip)}</span> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tenant Risk Ranking</p>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {tenantRisk.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No Data</p>
                <p className="text-xs text-muted-foreground mt-1">No tenant risk data available</p>
              </div>
            ) : tenantRisk.map((t, i) => (
              <div key={t.organizationId} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-right text-xs font-mono ${i < 3 ? "text-red-600 font-bold" : "text-muted-foreground"}`}>#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{t.organizationId.slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">{t.total} events · {t.critical} critical · {t.open} open</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-black ${t.riskScore > 70 ? "text-red-600" : t.riskScore > 30 ? "text-amber-600" : "text-green-600"}`}>{t.riskScore}</span>
                  <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${t.riskScore > 70 ? "bg-red-500" : t.riskScore > 30 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{ width: `${t.riskScore}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
