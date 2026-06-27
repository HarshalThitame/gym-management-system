"use client";

import { AlertTriangle, XCircle, Info, ChevronDown, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Violation } from "../../services/ux-governance-service";

type Props = {
  violations: Violation[];
};

const severityConfig = {
  violation: { icon: <XCircle className="size-4 shrink-0 text-red-500" />, label: "Violation", color: "text-red-700 bg-red-50 border-red-200" },
  warning: { icon: <AlertTriangle className="size-4 shrink-0 text-amber-500" />, label: "Warning", color: "text-amber-800 bg-amber-50 border-amber-200" },
  info: { icon: <Info className="size-4 shrink-0 text-blue-500" />, label: "Info", color: "text-blue-700 bg-blue-50 border-blue-200" },
};

export function ViolationList({ violations }: Props) {
  const grouped = violations.slice(0, 50);

  return (
    <div className="mt-3 space-y-1">
      {grouped.map((v, i) => {
        const cfg = severityConfig[v.severity];
        return (
          <div key={i} className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2 text-sm">
            {cfg.icon}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs truncate">{v.description}</span>
                <span className={cn("text-[10px] font-bold uppercase shrink-0 rounded border px-1.5 py-0.5", cfg.color)}>{cfg.label}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <FileCode className="size-3" />
                <span className="truncate">{v.file}:{v.line}</span>
                {v.value && <span className="font-mono text-[10px] truncate">{v.value}</span>}
              </div>
            </div>
          </div>
        );
      })}
      {violations.length > 50 && (
        <p className="pt-1 text-xs text-muted-foreground text-center">+{violations.length - 50} more issues</p>
      )}
    </div>
  );
}
