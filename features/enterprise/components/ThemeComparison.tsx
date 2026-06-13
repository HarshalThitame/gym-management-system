"use client";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeComparison({
  before, after, enabled, onToggle, children,
}: {
  before: Record<string, string>;
  after: Record<string, string>;
  enabled: boolean;
  onToggle: () => void;
  children: (colors: Record<string, string>) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">{enabled ? "Comparing: Before vs After" : "Live Preview"}</p>
        <Button size="sm" variant="ghost" onClick={onToggle} className="text-xs gap-1">
          <ArrowLeftRight className="size-3.5" />
          {enabled ? "Show After Only" : "Compare Before/After"}
        </Button>
      </div>
      {enabled ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground text-center border-b border-border">Before</div>
            <div className="p-2">{children(before)}</div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground text-center border-b border-border">After</div>
            <div className="p-2">{children(after)}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="p-3">{children(after)}</div>
        </div>
      )}
    </div>
  );
}
