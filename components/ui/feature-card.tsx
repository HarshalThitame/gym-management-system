"use client";

import { Check, Lock, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FeatureCardProps = {
  label: string;
  description: string;
  included: boolean;
  upgradeLabel?: string;
  limitLabel?: string;
  compact?: boolean;
  isNewInGrowth?: boolean;
  isNewInEnterprise?: boolean;
  isUnlimited?: boolean;
};

export function FeatureCard({ label, description, included, upgradeLabel, limitLabel, compact = false, isNewInGrowth, isNewInEnterprise, isUnlimited }: FeatureCardProps) {
  const isNew = isNewInEnterprise || isNewInGrowth;
  const newColor = isNewInEnterprise ? "purple" : "blue";
  const borderClass = included && isNewInEnterprise ? "border-purple-200/50 bg-purple-50/10" : included && isNewInGrowth ? "border-blue-200/50 bg-blue-50/10" : "";
  const newBadgeClass = isNewInEnterprise ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-blue-50 border-blue-200 text-blue-700";
  const newBadgeLabel = isNewInEnterprise ? "New in Enterprise" : "New in Growth";

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
        included ? "text-foreground" : "text-muted-foreground"
      )}>
        {included ? (
          <Check className="size-3 shrink-0 text-green-600" />
        ) : (
          <Lock className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{label}</span>
        {isNewInGrowth && included && (
          <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
            <Sparkles className="size-2.5 inline mr-0.5" />New
          </span>
        )}
        {isNewInEnterprise && included && (
          <span className="ml-auto shrink-0 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
            <Sparkles className="size-2.5 inline mr-0.5" />Enterprise
          </span>
        )}
        {!included && upgradeLabel && (
          <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            {upgradeLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border p-3.5 transition-all",
      included ? "border-border bg-background" : "border-dashed border-border bg-surface-muted/30",
      borderClass
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold", included ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </p>
            {included ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                <Check className="size-3" /> Included
              </span>
            ) : upgradeLabel ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <Lock className="size-3" /> {upgradeLabel}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                <Minus className="size-3" /> Locked
              </span>
            )}
            {isNewInEnterprise && included && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                <Sparkles className="size-3" /> New in Enterprise
              </span>
            )}
            {isNewInGrowth && included && !isNewInEnterprise && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                <Sparkles className="size-3" /> New in Growth
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          {isUnlimited && included && (
            <p className="mt-1 text-[11px] font-bold text-purple-600 flex items-center gap-1">
              <Sparkles className="size-3" /> Unlimited
            </p>
          )}
          {limitLabel && included && !isUnlimited && (
            <p className="mt-1 text-[11px] font-semibold text-indigo-600">{limitLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

type FeatureCategorySectionProps = {
  name: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
};

export function FeatureCategorySection({ name, description, icon, children }: FeatureCategorySectionProps) {
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-accent/5 to-background px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <h3 className="text-base font-black">{name}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

type LimitBarProps = {
  label: string;
  current: number;
  limit: number;
  limitLabel?: string;
};

export function LimitBar({ label, current, limit, limitLabel }: LimitBarProps) {
  if (limit === -1) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{label}</span>
          <span className="text-xs inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">Unlimited</span>
        </div>
        {limitLabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{limitLabel}</p>}
      </div>
    );
  }

  const percent = Math.min(100, Math.round((current / limit) * 100));
  const isOver = current >= limit;
  const isWarning = percent >= 80 && !isOver;

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className={cn(
          "text-xs font-bold",
          isOver ? "text-red-600" : isWarning ? "text-amber-600" : "text-muted-foreground"
        )}>
          {current} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-accent/10">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-green-500"
          )}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      {limitLabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{limitLabel}</p>}
    </div>
  );
}
