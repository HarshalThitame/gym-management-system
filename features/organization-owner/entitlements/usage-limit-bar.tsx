"use client";

import { cn } from "@/lib/utils";

export type LimitBarProps = {
  label: string;
  current: number;
  limit: number;
  isUnlimited?: boolean;
  className?: string;
};

export function UsageLimitBar({ label, current, limit, isUnlimited, className }: LimitBarProps) {
  const percent = isUnlimited || limit <= 0 ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const status = isUnlimited ? "unlimited" : percent >= 100 ? "reached" : percent >= 80 ? "warning" : "safe";

  const colors = {
    safe: "bg-green-500",
    warning: "bg-amber-500",
    reached: "bg-red-500",
    unlimited: "bg-blue-400",
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className={cn(
          "font-bold",
          status === "reached" ? "text-red-600" : status === "warning" ? "text-amber-600" : "text-muted-foreground"
        )}>
          {isUnlimited ? "Unlimited" : `${current} / ${limit}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-accent/20">
        <div
          className={cn("h-full rounded-full transition-all", colors[status])}
          style={{ width: `${isUnlimited ? 100 : percent}%` }}
        />
      </div>
      {status === "reached" && (
        <p className="text-[10px] font-semibold text-red-600">Limit reached — upgrade to increase</p>
      )}
      {status === "warning" && (
        <p className="text-[10px] font-semibold text-amber-600">{limit - current} remaining</p>
      )}
    </div>
  );
}
