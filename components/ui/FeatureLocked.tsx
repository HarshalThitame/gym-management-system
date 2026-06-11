"use client";

import { Lock } from "lucide-react";
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
};

export function FeatureLocked({
  featureName,
  requiredPlan,
  description,
  children,
  compact = false
}: FeatureLockedProps) {
  if (compact) {
    return (
      <span aria-label={`${featureName} locked`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
        <Lock aria-hidden="true" className="size-3.5" />
        Upgrade to {requiredPlan}
      </span>
    );
  }

  if (children) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
        <div className="pointer-events-none select-none opacity-35 blur-[1px]">{children}</div>
        <div className="absolute inset-0 grid place-items-center bg-background/80 p-5 backdrop-blur-sm">
          <LockedContent description={description} featureName={featureName} requiredPlan={requiredPlan} />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 md:p-8">
        <LockedContent description={description} featureName={featureName} requiredPlan={requiredPlan} />
      </CardContent>
    </Card>
  );
}

function LockedContent({
  description,
  featureName,
  requiredPlan
}: {
  description: string | undefined;
  featureName: string;
  requiredPlan: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="grid size-12 place-items-center rounded-md border border-amber-200 bg-amber-50 text-amber-800">
        <Lock aria-hidden="true" className="size-5" />
      </div>
      <h3 className="mt-4 text-2xl font-black">{featureName}</h3>
      {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <Badge className={cn("mt-4 border-amber-200 bg-amber-50 text-amber-800")}>
        Required plan: {requiredPlan}
      </Badge>
      <Button className="mt-5" onClick={() => console.info("redirect to upgrade flow")} type="button" variant="accent">
        Upgrade Plan
      </Button>
    </div>
  );
}

export default FeatureLocked;
