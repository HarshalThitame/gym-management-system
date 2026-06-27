"use client";

import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AuditResult } from "../../services/ux-governance-service";

type AuditEntry = {
  timestamp: string;
  score: number;
};

type Props = {
  currentAudit: AuditResult;
  history: AuditEntry[];
};

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff > 0) return <TrendingUp className="size-4 text-green-600" />;
  if (diff < 0) return <TrendingDown className="size-4 text-red-600" />;
  return <Minus className="size-4 text-muted-foreground" />;
}

export function AuditHistory({ currentAudit, history }: Props) {
  const allEntries: AuditEntry[] = [
    { timestamp: currentAudit.timestamp, score: currentAudit.overallScore },
    ...history,
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-[0_18px_60px_rgb(17_18_20/0.06)]">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Audit History</p>
        </div>
      </div>
      <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
        {allEntries.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">No audit history yet</div>
        ) : (
          allEntries.map((entry, i) => {
            const color = entry.score >= 80 ? "text-green-600" : entry.score >= 40 ? "text-amber-600" : "text-red-600";
            return (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`font-black ${color}`}>{entry.score}</span>
                  {i < allEntries.length - 1 && <TrendArrow current={entry.score} previous={allEntries[i + 1]!.score} />}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
