"use client";

import { useState } from "react";
import { ArrowUp, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1 — Support Agent",
  2: "Level 2 — Team Lead",
  3: "Level 3 — Operations Manager",
  4: "Level 4 — Tenant Admin",
  5: "Level 5 — Super Admin",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "border-green-300 bg-green-50",
  2: "border-blue-300 bg-blue-50",
  3: "border-amber-300 bg-amber-50",
  4: "border-orange-300 bg-orange-50",
  5: "border-red-300 bg-red-50",
};

export function SupportEscalationMatrix({
  byLevel,
  activeEscalations,
  escalationRules,
}: {
  byLevel: { level: number; count: number }[];
  activeEscalations: Record<string, unknown>[];
  escalationRules: Record<string, unknown>[];
}) {
  const [showEscalateModal, setShowEscalateModal] = useState(false);

  const levelData = [1, 2, 3, 4, 5].map((level) => ({
    level,
    label: LEVEL_LABELS[level] ?? `Level ${level}`,
    count: byLevel.find((l) => l.level === level)?.count ?? 0,
    colorClass: LEVEL_COLORS[level] ?? "border-gray-300 bg-gray-50",
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-2">
        {levelData.map((item, idx) => (
          <div key={item.level} className={`rounded-lg border-2 ${item.colorClass} p-3 text-center relative`}>
            {idx < 4 && (
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <p className="text-xs font-bold">{item.level}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.label}</p>
            <p className={`text-lg font-bold mt-1 ${item.count > 0 ? "text-red-600" : "text-green-600"}`}>
              {item.count}
            </p>
            <p className="text-[10px] text-muted-foreground">escalated</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Escalations</p>
            <button
              onClick={() => setShowEscalateModal(true)}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              + New Escalation
            </button>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {activeEscalations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No active escalations.</div>
            ) : (
              activeEscalations.map((esc) => (
                <div key={esc.id as string} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">
                      L{(esc.escalated_from_level as number)} → L{(esc.escalated_to_level as number)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(esc.created_at as string).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs mt-1">{String(esc.reason ?? "")}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Triggered by: {esc.triggered_by as string}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escalation Rules</p>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {escalationRules.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No escalation rules configured.</div>
            ) : (
              escalationRules.map((rule) => (
                <div key={rule.id as string} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{rule.name as string}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Active</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trigger: <span className="font-medium capitalize">{(rule.trigger_on as string).replace(/_/g, " ")}</span>
                    {" · "} L{(rule.escalate_from_level as number)} → L{(rule.escalate_to_level as number)}
                    {rule.escalate_after_minutes ? <> · After {String(rule.escalate_after_minutes)}m</> : null}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showEscalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEscalateModal(false)}>
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Manual Escalation</h3>
            <p className="text-sm text-muted-foreground mt-1">Escalate a ticket to a higher support level.</p>
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); setShowEscalateModal(false); }}>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Ticket ID</label>
                <input type="text" placeholder="Enter ticket ID" className="w-full h-9 rounded-md border border-border bg-background text-sm px-3" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Escalate To Level</label>
                <select className="w-full h-9 rounded-md border border-border bg-background text-sm px-3">
                  <option value="2">Level 2 — Team Lead</option>
                  <option value="3">Level 3 — Operations Manager</option>
                  <option value="4">Level 4 — Tenant Admin</option>
                  <option value="5">Level 5 — Super Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Reason</label>
                <textarea rows={3} className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 resize-none" placeholder="Why is this being escalated?" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Escalate Ticket
                </button>
                <button type="button" onClick={() => setShowEscalateModal(false)} className="h-9 px-4 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
