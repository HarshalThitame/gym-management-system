"use client";

import { useState } from "react";
import { AlertTriangle, Search, User, ChevronDown } from "lucide-react";

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export function SecurityIncidentQueue({ incidents }: { incidents: Array<Record<string, unknown>> }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const filtered = incidents.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (severityFilter && i.severity !== severityFilter) return false;
    return true;
  }).sort((a, b) => (SEVERITY_ORDER[b.severity as string] ?? 0) - (SEVERITY_ORDER[a.severity as string] ?? 0));

  const severityColor = (s: string) => {
    const colors: Record<string, string> = { critical: "bg-red-100 text-red-700 border-red-200", high: "bg-orange-100 text-orange-700 border-orange-200", medium: "bg-amber-100 text-amber-700 border-amber-200", low: "bg-blue-100 text-blue-700 border-blue-200" };
    return colors[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[130px]">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="contained">Contained</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[130px]">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No incidents match your filters</p>
          </div>
        ) : filtered.map((inc) => (
          <div key={inc.id as string}>
            <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === (inc.id as string) ? null : (inc.id as string))}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${severityColor(inc.severity as string)}`}>{inc.severity as string}</span>
                  <p className="text-xs font-medium truncate">{inc.description as string}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    inc.status === "open" ? "bg-red-50 text-red-700" :
                    inc.status === "investigating" ? "bg-amber-50 text-amber-700" :
                    inc.status === "contained" ? "bg-blue-50 text-blue-700" :
                    inc.status === "resolved" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                  }`}>{inc.status as string}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandedId === (inc.id as string) ? "rotate-180" : ""}`} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                {inc.assigned_to ? <><User className="h-3 w-3" /> {`${inc.assigned_to}`.slice(0, 8)}</> : null}
                {inc.incident_category ? <span>· {`${inc.incident_category}`}</span> : null}
                <span>· {inc.created_at ? new Date(inc.created_at as string).toLocaleString() : ""}</span>
              </div>
            </div>
            {expandedId === (inc.id as string) && (
              <div className="px-4 py-3 bg-muted/10 border-t border-border space-y-2">
                <div className="flex items-center gap-2">
                  <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors">Assign</button>
                  <button className="h-7 px-2.5 rounded-md border border-border text-[10px] font-medium hover:bg-muted transition-colors">Escalate</button>
                  <button className="h-7 px-2.5 rounded-md border border-border text-[10px] font-medium hover:bg-muted transition-colors">Contain</button>
                  <button className="h-7 px-2.5 rounded-md border border-red-200 text-red-600 text-[10px] font-medium hover:bg-red-50 transition-colors">Resolve</button>
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Add investigation note..." rows={2}
                  className="w-full rounded-md border border-border bg-background text-xs px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <button className="h-7 px-2.5 rounded-md border border-border text-[10px] font-medium hover:bg-muted transition-colors">Add Note</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
