"use client";

import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Plus } from "lucide-react";

export function EmergencyOverrideManager({ overrides }: { overrides: Array<Record<string, unknown>> }) {
  const [showCreate, setShowCreate] = useState(false);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    denied: "bg-red-100 text-red-700 border-red-200",
    active: "bg-blue-100 text-blue-700 border-blue-200",
    expired: "bg-gray-100 text-gray-500 border-gray-200",
    revoked: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {overrides.filter((o) => o.status === "active").length} active overrides
        </p>
        <button onClick={() => setShowCreate(true)}
          className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Override Request
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
        {overrides.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No emergency override requests</p>
          </div>
        ) : overrides.map((o, i) => (
          <div key={`${o.id}-${i}`} className="px-4 py-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {`${o.status}` === "active" ? <AlertTriangle className="h-4 w-4 text-blue-500" /> :
                 `${o.status}` === "approved" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                 `${o.status}` === "denied" ? <XCircle className="h-4 w-4 text-red-500" /> :
                 <Clock className="h-4 w-4 text-amber-500" />}
                <div>
                  <p className="text-xs font-medium capitalize">{`${o.use_case ?? "Unknown"}`.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">{`${o.reason ?? ""}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusColors[`${o.status}`] ?? ""}`}>{`${o.status}`}</span>
                <span className="text-[10px] text-muted-foreground">{`${o.access_level ?? ""}`.replace(/_/g, " ")}</span>
                {o.status === "pending" && (
                  <div className="flex gap-1">
                    <button className="h-6 px-2 rounded bg-green-600 text-white text-[9px] font-medium hover:bg-green-700">Approve</button>
                    <button className="h-6 px-2 rounded border border-red-200 text-red-600 text-[9px] font-medium hover:bg-red-50">Deny</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>By: {`${(o.requester as Record<string, unknown>)?.full_name ?? String(o.requested_by).slice(0, 8)}`}</span>
              <span>· {String(o.duration_minutes)}m duration</span>
              {o.created_at ? <span>· {new Date(String(o.created_at)).toLocaleString()}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Request Emergency Override</h3>
            <p className="text-xs text-muted-foreground mt-1">This action will be logged and requires approval.</p>
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); setShowCreate(false); }}>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Use Case</label>
                <select className="w-full h-9 rounded-lg border border-border text-sm px-3 mt-1">
                  <option value="tenant_lockout">Tenant Lockout</option>
                  <option value="critical_outage">Critical Outage</option>
                  <option value="admin_recovery">Admin Recovery</option>
                  <option value="security_incident">Security Incident</option>
                  <option value="data_recovery">Data Recovery</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</label>
                <input type="text" className="w-full h-9 rounded-lg border border-border text-sm px-3 mt-1" placeholder="Brief reason for override" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Justification</label>
                <textarea rows={3} className="w-full rounded-lg border border-border text-sm px-3 py-2 mt-1 resize-none" placeholder="Detailed justification (required)" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Access Level</label>
                <select className="h-8 rounded-lg border border-border text-xs px-2">
                  <option value="read_only">Read Only</option>
                  <option value="write">Write</option>
                  <option value="admin">Admin</option>
                </select>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-2">Duration (min)</label>
                <input type="number" defaultValue={60} className="h-8 w-20 rounded-lg border border-border text-xs px-2" min={5} max={1440} />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Submit Request</button>
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
