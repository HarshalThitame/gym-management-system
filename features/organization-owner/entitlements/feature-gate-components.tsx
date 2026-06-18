"use client";

import type { ReactNode } from "react";
import { Lock, ArrowUpRight, AlertTriangle } from "lucide-react";
import { useEntitlements, useHasFeature, useFeatureLockReason } from "./entitlement-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FeatureKey } from "@/features/entitlement";

// ═══ FeatureGate ═══
// Wraps children with a feature check. If feature is locked, shows fallback.
export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hasFeature = useHasFeature(feature);
  const lockReason = useFeatureLockReason(feature);

  if (hasFeature) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <LockedFeaturePage feature={feature} featureName={undefined} reason={lockReason ?? ""} />;
}

// ═══ FeatureGateInline ═══
// Inline version that doesn't wrap page-level content, just renders or not
export function FeatureGateInline({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const hasFeature = useHasFeature(feature);
  if (!hasFeature) return null;
  return <>{children}</>;
}

// ═══ LockedFeatureCard ═══
// Card shown inline when a feature section is locked
export function LockedFeatureCard({
  feature,
  featureName,
}: {
  feature: FeatureKey;
  featureName: string;
}) {
  const { plan } = useEntitlements();
  const lockReason = useFeatureLockReason(feature);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="rounded-full bg-amber-100 p-3">
          <Lock className="size-6 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold">{featureName}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">{lockReason}</p>
        </div>
        {plan && (
          <p className="text-xs text-muted-foreground">
            Current plan: <span className="font-semibold">{plan.name}</span>
          </p>
        )}
        <Button variant="primary" size="sm" onClick={() => window.location.assign("/organization/plan?tab=pay")} type="button">
          <ArrowUpRight className="size-4 mr-1" /> View Plans
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══ LockedActionButton ═══
// Disabled action button that shows tooltip/reason on click
export function LockedActionButton({
  feature,
  label,
  reason: propReason,
}: {
  feature: FeatureKey;
  label: string;
  reason?: string;
}) {
  const lockReason = useFeatureLockReason(feature);
  const reason = propReason ?? lockReason;

  return (
    <Button
      variant="primary"
      size="sm"
      disabled
      className="opacity-60 cursor-not-allowed"
      onClick={(e) => {
        e.preventDefault();
        if (reason) {
          import("@/components/ui/toast").then(({ showToast }) => showToast(reason, "info"));
        }
      }}
      title={reason ?? ""}
      type="button"
    >
      <Lock className="size-4 mr-1" /> {label}
    </Button>
  );
}

// ═══ LockedFeaturePage ═══
// Full page shown when a locked feature route is accessed directly
export function LockedFeaturePage({
  feature,
  featureName,
  reason,
}: {
  feature: FeatureKey | undefined;
  featureName: string | undefined;
  reason: string;
}) {
  const { plan } = useEntitlements();
  const computedLockReason = useFeatureLockReason((feature ?? "memberManagement") as FeatureKey);
  const lockReason = reason ?? (feature ? computedLockReason : null);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-amber-100 p-4">
            <Lock className="size-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            {featureName && (
              <h2 className="text-xl font-black">{featureName}</h2>
            )}
            <p className="text-sm text-muted-foreground">
              {lockReason ?? "This feature is not available on your current plan."}
            </p>
          </div>

          {plan ? (
            <div className="w-full rounded-lg border border-border bg-background p-3 text-sm">
              <p className="text-muted-foreground">Current Plan</p>
              <p className="font-bold">{plan.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{plan.status}</p>
              {plan.remainingDays !== null && plan.remainingDays > 0 && (
                <p className="text-xs text-muted-foreground">{plan.remainingDays} day{plan.remainingDays !== 1 ? "s" : ""} remaining</p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <p>No active subscription found. Choose a plan to get started.</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="primary" onClick={() => window.location.assign("/organization/plan")} type="button">
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ UpgradePrompt ═══
// Compact inline prompt shown when a user tries to use a locked feature
export function UpgradePrompt({ feature, featureName }: { feature: FeatureKey; featureName: string }) {
  const { plan } = useEntitlements();
  void feature;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Lock className="size-5 shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="text-sm font-bold text-amber-900">{featureName} is locked</p>
          <p className="text-xs text-amber-700">
            {plan ? `Not included in your ${plan.name} plan.` : "No active plan."} Upgrade to access this feature.
          </p>
        </div>
      </div>
      <Button variant="primary" size="sm" onClick={() => window.location.assign("/organization/plan?tab=pay")} type="button">
        Upgrade
      </Button>
    </div>
  );
}
