"use client";

import { X } from "lucide-react";
import type { AgentWithWorkload } from "../services/support-assignment-service";

export function SupportBulkActions({
  selectedCount,
  agents,
  onAssign,
  onSetPriority,
  onSetStatus,
  onClear,
}: {
  selectedCount: number;
  agents?: AgentWithWorkload[];
  onAssign: (agentId: string) => void;
  onSetPriority: (priority: string) => void;
  onSetStatus: (status: string) => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-xs font-medium">{selectedCount} selected</span>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1">
          <select
            onChange={(e) => { if (e.target.value) { onSetStatus(e.target.value); e.target.value = ""; } }}
            className="h-7 rounded-md border border-border bg-background px-2 text-[10px] font-medium focus:outline-none"
          >
            <option value="">Change Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            onChange={(e) => { if (e.target.value) { onSetPriority(e.target.value); e.target.value = ""; } }}
            className="h-7 rounded-md border border-border bg-background px-2 text-[10px] font-medium focus:outline-none"
          >
            <option value="">Change Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          {agents && agents.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) { onAssign(e.target.value); e.target.value = ""; } }}
              className="h-7 rounded-md border border-border bg-background px-2 text-[10px] font-medium focus:outline-none"
            >
              <option value="">Assign to...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.activeTicketCount} tickets)</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <button onClick={onClear} className="p-1 hover:text-foreground text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
