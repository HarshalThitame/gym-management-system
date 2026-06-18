"use client";

import { Lock, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "./entitlement-provider";
import { showToast } from "@/components/ui/toast";
import type { FeatureKey } from "@/features/entitlement";

type LimitAwareActionButtonProps = {
  label: string;
  featureKey: FeatureKey;
  limitKey: string;
  currentUsage: number;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "lg";
  className?: string;
};

export function LimitAwareActionButton({
  label,
  featureKey,
  limitKey,
  currentUsage,
  onClick,
  href,
  variant = "primary",
  size = "sm",
  className,
}: LimitAwareActionButtonProps) {
  const { hasFeature, isWithinLimit, plan } = useEntitlements();

  const featureAllowed = hasFeature(featureKey);
  const limitCheck = isWithinLimit(limitKey, currentUsage);

  if (!featureAllowed) {
    return (
      <Button
        variant="secondary"
        size={size}
        disabled
        className={className}
        onClick={(e) => {
          e.preventDefault();
          showToast(`This feature is not included in your ${plan?.name ?? "current"} plan.`, "info");
        }}
        title={`Not included in your plan`}
        type="button"
      >
        <Lock className="size-4 mr-1" /> {label}
      </Button>
    );
  }

  if (!limitCheck.ok) {
    return (
      <div className="inline-flex flex-col gap-1">
        <Button
          variant="secondary"
          size={size}
          disabled
          className={className}
          onClick={(e) => {
            e.preventDefault();
            showToast(`Limit reached: ${currentUsage} / ${limitCheck.limit}. Upgrade your plan to add more.`, "info");
          }}
          title={`Limit reached: ${currentUsage} / ${limitCheck.limit}`}
          type="button"
        >
          <Lock className="size-4 mr-1" /> {label}
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Limit reached ({currentUsage}/{limitCheck.limit}) · <button className="underline hover:text-primary" onClick={() => window.location.assign("/organization/plan")} type="button">Upgrade <ArrowUpRight className="inline size-3" /></button>
        </span>
      </div>
    );
  }

  if (href) {
    return (
      <Button variant={variant} size={size} className={className} onClick={() => window.location.assign(href)} type="button">
        {label}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={onClick} type="button">
      {label}
    </Button>
  );
}
