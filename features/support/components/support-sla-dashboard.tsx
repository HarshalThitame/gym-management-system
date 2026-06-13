"use client";

import type { SupportSlaPolicyRow } from "@/types/enterprise";

function SlaStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-blue-100 text-blue-800",
    warning: "bg-amber-100 text-amber-800",
    breached: "bg-red-100 text-red-800",
    met: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export function SupportSlaDashboard({
  policies,
  slaStats,
}: {
  policies: SupportSlaPolicyRow[];
  slaStats: { totalTickets: number; breachedCount: number; atRiskCount: number; slaCompliancePercent: number };
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Compliance</p>
          <p className={`text-2xl font-bold mt-1 ${slaStats.slaCompliancePercent >= 95 ? "text-green-600" : slaStats.slaCompliancePercent >= 80 ? "text-amber-600" : "text-red-600"}`}>
            {slaStats.slaCompliancePercent}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Tickets</p>
          <p className="text-2xl font-bold mt-1">{slaStats.totalTickets}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Breached</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{slaStats.breachedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">At Risk</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{slaStats.atRiskCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SLA Policies</p>
        </div>
        <div className="divide-y divide-border">
          {policies.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No SLA policies configured.</div>
          ) : (
            policies.map((policy) => (
              <div key={policy.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{policy.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{policy.priority} priority</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Response: {policy.first_response_minutes}m</span>
                  <span>Resolution: {policy.resolution_minutes}m</span>
                  {policy.escalation_minutes && <span>Escalation: {policy.escalation_minutes}m</span>}
                  <SlaStatusBadge status={policy.is_active ? "active" : "cancelled"} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
