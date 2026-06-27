"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "./score-ring";
import type { CategoryScore } from "../../services/ux-governance-service";
import { ViolationList } from "./violation-list";

type Props = {
  category: CategoryScore;
  icon?: ReactNode;
  index: number;
};

const statusConfig = {
  pass: { badge: "success" as const, label: "Pass", icon: <CheckCircle2 className="size-4 text-green-600" /> },
  warning: { badge: "warning" as const, label: "Warning", icon: <AlertTriangle className="size-4 text-amber-600" /> },
  fail: { badge: "error" as const, label: "Fail", icon: <XCircle className="size-4 text-red-600" /> },
};

export function CategoryCard({ category, icon, index }: Props) {
  const cfg = statusConfig[category.status];

  return (
    <details
      className="group reveal-up rounded-xl border border-border bg-card shadow-[0_18px_60px_rgb(17_18_20/0.06)] overflow-hidden"
      style={{ "--reveal-delay": `${index * 0.05}s` } as React.CSSProperties}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-4">
          {icon && <div className="rounded-md bg-accent/10 p-2 text-foreground">{icon}</div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black">{category.label}</h3>
              <Badge variant={cfg.badge}>{cfg.label}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{category.detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ScoreRing score={category.score} size={48} strokeWidth={4} />
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0" />
        </div>
      </summary>
      <div className="border-t border-border px-5 pb-4">
        {category.violations.length > 0 ? (
          <ViolationList violations={category.violations} />
        ) : (
          <div className="flex items-center gap-2 py-3 text-sm text-green-600">
            <CheckCircle2 className="size-4" />
            No issues found
          </div>
        )}
      </div>
    </details>
  );
}
