"use client";
import { Badge } from "@/components/ui/badge";
import { contrastRatio, accessibilityGrade } from "@/features/enterprise/lib/accessibility";

export function AccessibilityBadge({ fg, bg }: { fg: string; bg: string }) {
  const ratio = contrastRatio(fg, bg);
  const grade = accessibilityGrade(fg, bg);
  const variant = grade === "AAA" ? "success" as const : grade === "AA" ? "info" as const : "error" as const;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant={variant} className="text-[10px] px-1.5 py-0">{grade}</Badge>
      <span className="font-mono text-muted-foreground">{ratio.toFixed(1)}:1</span>
    </div>
  );
}
