"use client";

import { useState } from "react";
import { Monitor, Smartphone, Globe, XCircle, AlertTriangle, Shield } from "lucide-react";

export function SecuritySessionManager({ sessions }: { sessions: Array<Record<string, unknown>> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-xs font-medium text-red-700">{selected.size} session(s) selected</span>
          <button className="ml-auto h-7 px-2.5 rounded-md bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 transition-colors">Revoke Selected</button>
          <button onClick={() => setSelected(new Set())} className="h-7 px-2.5 rounded-md border border-red-200 text-red-600 text-[10px] font-medium hover:bg-red-50 transition-colors">Clear</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
        {sessions.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No active sessions</div>
        ) : sessions.map((s) => {
          const risk = s.risk_score as number;
          const isHighRisk = risk > 70;
          return (
            <div key={s.id as string} className={`px-4 py-3 hover:bg-muted/20 transition-colors ${isHighRisk ? "border-l-2 border-l-red-400" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.has(s.id as string)} onChange={() => toggleSelect(s.id as string)} className="rounded border-border h-3.5 w-3.5" />
                  {(s.device_type as string) === "mobile" ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Monitor className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium">{`${(s.user as Record<string, unknown>)?.full_name ?? "Unknown"}`}</p>
                      {isHighRisk && <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">HIGH RISK</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{`${s.browser ?? "Unknown"}`} on {`${s.os ?? "Unknown"}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-muted-foreground">{`${s.ip_address ?? ""}`}</span>
                  <span className="text-muted-foreground">{`${s.location_country ?? "—"}`}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${risk > 70 ? "bg-red-500" : risk > 30 ? "bg-amber-500" : "bg-green-500"}`} />
                    <span className="text-muted-foreground">{risk}</span>
                  </div>
                  {s.logged_in_at ? <span className="text-muted-foreground">{new Date(`${s.logged_in_at}`).toLocaleDateString()}</span> : null}
                  <button onClick={() => toggleSelect(`${s.id}`)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
