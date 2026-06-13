"use client";

import { useState } from "react";
import { CheckSquare, X } from "lucide-react";

export function SupportBulkActions({
  selectedCount,
  onAssign,
  onSetPriority,
  onSetStatus,
  onEscalate,
  onClose,
  onClear,
}: {
  selectedCount: number;
  onAssign: (agentId: string) => void;
  onSetPriority: (priority: string) => void;
  onSetStatus: (status: string) => void;
  onEscalate: () => void;
  onClose: (reason: string) => void;
  onClear: () => void;
}) {
  const [showAction, setShowAction] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <CheckSquare className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium mr-2">{selectedCount} selected</span>

      <div className="flex items-center gap-1">
        <button onClick={() => setShowAction("assign")} className="h-7 px-2 rounded text-[10px] font-medium bg-background border border-border hover:bg-muted">
          Assign
        </button>
        <button onClick={() => setShowAction("priority")} className="h-7 px-2 rounded text-[10px] font-medium bg-background border border-border hover:bg-muted">
          Priority
        </button>
        <button onClick={() => setShowAction("status")} className="h-7 px-2 rounded text-[10px] font-medium bg-background border border-border hover:bg-muted">
          Status
        </button>
        <button onClick={() => { onEscalate(); setShowAction(null); }} className="h-7 px-2 rounded text-[10px] font-medium bg-background border border-border hover:bg-muted">
          Escalate
        </button>
        <button onClick={() => setShowAction("close")} className="h-7 px-2 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
          Close
        </button>
      </div>

      <button onClick={onClear} className="ml-auto p-1 hover:text-foreground text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </button>

      {showAction === "assign" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAction(null)}>
          <div className="bg-card rounded-lg border p-4 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold mb-2">Assign {selectedCount} Tickets</p>
            <input type="text" placeholder="Agent ID..." className="w-full h-9 rounded-md border border-border text-sm px-3" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { onAssign(""); setShowAction(null); }} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium">Assign</button>
              <button onClick={() => setShowAction(null)} className="h-8 px-3 rounded-md border text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAction === "priority" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAction(null)}>
          <div className="bg-card rounded-lg border p-4 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold mb-2">Set Priority</p>
            <select className="w-full h-9 rounded-md border border-border text-sm px-3">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="critical">Critical</option><option value="emergency">Emergency</option>
            </select>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { onSetPriority(""); setShowAction(null); }} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium">Apply</button>
              <button onClick={() => setShowAction(null)} className="h-8 px-3 rounded-md border text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAction === "status" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAction(null)}>
          <div className="bg-card rounded-lg border p-4 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold mb-2">Set Status</p>
            <select className="w-full h-9 rounded-md border border-border text-sm px-3">
              <option value="open">Open</option><option value="in_review">In Review</option>
              <option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
            </select>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { onSetStatus(""); setShowAction(null); }} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium">Apply</button>
              <button onClick={() => setShowAction(null)} className="h-8 px-3 rounded-md border text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAction === "close" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAction(null)}>
          <div className="bg-card rounded-lg border p-4 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold mb-2">Close {selectedCount} Tickets</p>
            <input type="text" placeholder="Closing reason..." className="w-full h-9 rounded-md border border-border text-sm px-3" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { onClose(""); setShowAction(null); }} className="h-8 px-3 rounded-md bg-red-600 text-white text-xs font-medium">Close All</button>
              <button onClick={() => setShowAction(null)} className="h-8 px-3 rounded-md border text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
