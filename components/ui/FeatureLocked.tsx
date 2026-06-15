"use client";

import { ArrowUp, Crown, Lock, Sparkles, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeatureLockedProps = {
  featureName: string;
  requiredPlan: string;
  description?: string;
  children?: ReactNode;
  compact?: boolean;
  featureKey?: string;
  currentPlan?: string;
};

const PLAN_COLORS: Record<string, { badge: string; icon: string; button: string }> = {
  Starter:  { badge: "border-green-200 bg-green-50 text-green-700", icon: "text-green-600", button: "bg-green-600 hover:bg-green-700" },
  Growth:   { badge: "border-blue-200 bg-blue-50 text-blue-700", icon: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
  Enterprise: { badge: "border-purple-200 bg-purple-50 text-purple-700", icon: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700" },
};

const PLAN_PRICES: Record<string, { monthly: string; yearly: string }> = {
  Starter:    { monthly: "₹1,499/mo", yearly: "₹14,999/yr" },
  Growth:     { monthly: "₹3,999/mo", yearly: "₹39,999/yr" },
  Enterprise: { monthly: "₹9,999/mo", yearly: "₹99,999/yr" },
};

export function FeatureLocked({
  featureName,
  requiredPlan,
  description,
  children,
  compact = false,
  featureKey,
  currentPlan,
}: FeatureLockedProps) {
  const planKey = Object.keys(PLAN_COLORS).includes(requiredPlan) ? requiredPlan : "Growth";
  const colors = PLAN_COLORS[planKey as keyof typeof PLAN_COLORS]!;
  const pricing = PLAN_PRICES[planKey as keyof typeof PLAN_PRICES] ?? null;

  if (compact) {
    return (
      <span
        aria-label={`${featureName} locked`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-bold text-muted-foreground"
      >
        <Lock aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Available on</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px]", colors.badge)}>{requiredPlan}</span>
      </span>
    );
  }

  const c = colors;
  const p = pricing;

  const upgradeContent = (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="grid size-14 place-items-center rounded-xl border-2 border-amber-200 bg-amber-50">
        {requiredPlan === "Enterprise" ? (
          <Crown className="size-7 text-purple-600" />
        ) : requiredPlan === "Growth" ? (
          <Zap className="size-7 text-blue-600" />
        ) : (
          <Sparkles className="size-7 text-green-600" />
        )}
      </div>
      <h3 className="mt-4 text-2xl font-black">{featureName}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Badge className={c.badge}>
          <ArrowUp className="mr-1 size-3" />
          {requiredPlan}
        </Badge>
        {currentPlan && currentPlan !== "No Plan" && (
          <span className="text-xs text-muted-foreground">
            (you are on {currentPlan})
          </span>
        )}
      </div>

      {p && (
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-border bg-surface-muted px-4 py-2">
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Starting from</p>
            <p className="text-lg font-black">{p.monthly}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Save with yearly</p>
            <p className="text-lg font-black">{p.yearly}</p>
          </div>
        </div>
      )}

      <Button
        className={c.button}
        onClick={() => {
          const params = new URLSearchParams();
          if (featureKey) params.set("feature", featureKey);
          if (requiredPlan) params.set("upgrade", requiredPlan.toLowerCase());
          window.location.href = `/organization/plan?${params.toString()}`;
        }}
        type="button"
        variant="accent"
      >
        Upgrade to {requiredPlan}
        <ArrowUp className="ml-1.5 size-4" />
      </Button>
    </div>
  );

  if (children) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
        <div className="pointer-events-none select-none opacity-35 blur-[1px]">{children}</div>
        <div className="absolute inset-0 grid place-items-center bg-background/80 p-5 backdrop-blur-sm">
          {upgradeContent}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 md:p-8">{upgradeContent}</CardContent>
    </Card>
  );
}

export default FeatureLocked;
