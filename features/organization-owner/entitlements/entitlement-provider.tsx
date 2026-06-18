"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { OrgFeatureFlags, FeatureFlagKey } from "@/lib/tenant/feature-flags";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import type { PlanSummary } from "./entitlement-loader";
import { getEntitlementSummaryAction } from "./entitlement-loader";

type EntitlementState = {
  plan: PlanSummary | null;
  features: OrgFeatureFlags;
  limits: Record<string, number>;
  loading: boolean;
  error: string | null;
};

type EntitlementContextValue = EntitlementState & {
  refresh: () => Promise<void>;
  hasFeature: (key: FeatureFlagKey) => boolean;
  isWithinLimit: (limitKey: string, currentUsage: number) => { ok: boolean; limit: number };
};

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({
  children,
  organizationId,
  initialPlanContext,
}: {
  children: ReactNode;
  organizationId: string;
  initialPlanContext: OrgPlanContext;
}) {
  const [state, setState] = useState<EntitlementState>({
    plan: buildPlanSummary(initialPlanContext),
    features: initialPlanContext.features,
    limits: extractLimits(initialPlanContext),
    loading: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const summary = await getEntitlementSummaryAction(organizationId);
      setState({
        plan: summary.plan,
        features: summary.allFeatures,
        limits: summary.limits,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load entitlements.",
      }));
    }
  }, [organizationId]);

  const hasFeature = useCallback(
    (key: FeatureFlagKey): boolean => {
      return (state.features[key] as boolean | undefined) ?? false;
    },
    [state.features],
  );

  const isWithinLimit = useCallback(
    (limitKey: string, currentUsage: number): { ok: boolean; limit: number } => {
      const limit = (state.limits as Record<string, number>)[limitKey];
      if (limit === undefined || limit === -1) return { ok: true, limit: -1 };
      return { ok: currentUsage < limit, limit };
    },
    [state.limits],
  );

  const value = useMemo(
    () => ({ ...state, refresh, hasFeature, isWithinLimit }),
    [state, refresh, hasFeature, isWithinLimit],
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error("useEntitlements must be used within EntitlementProvider");
  return ctx;
}

export function useHasFeature(key: FeatureFlagKey): boolean {
  const ctx = useContext(EntitlementContext);
  if (!ctx) return false;
  return ctx.hasFeature(key);
}

export function usePlanSummary(): PlanSummary | null {
  const ctx = useContext(EntitlementContext);
  if (!ctx) return null;
  return ctx.plan;
}

export function useFeatureLockReason(key: FeatureFlagKey): string | null {
  const ctx = useContext(EntitlementContext);
  if (!ctx) return "Entitlement system unavailable.";
  if (!ctx.plan) return "No active subscription. Upgrade to a plan to access this feature.";
  if (ctx.plan.status === "expired") return "Your plan has expired. Renew to regain access.";
  if (ctx.plan.status === "cancelled") return "Your plan has been cancelled. Choose a new plan.";
  if (ctx.plan.status === "suspended") return "Your subscription is suspended. Contact support.";
  if (ctx.plan.status === "pending_activation") return "Your new plan has not started yet.";
  if (!ctx.hasFeature(key)) return `This feature is not included in your ${ctx.plan.name} plan. Upgrade to access it.`;
  return null;
}

export function useRefreshEntitlements() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error("useRefreshEntitlements must be used within EntitlementProvider");
  return ctx.refresh;
}

function buildPlanSummary(ctx: OrgPlanContext): PlanSummary | null {
  if (!ctx.packageId || ctx.packageName === "No Plan") return null;
  return {
    packageId: ctx.packageId,
    name: ctx.packageName,
    status: ctx.status as PlanSummary["status"],
    startDate: null,
    endDate: ctx.expiresAt?.toISOString() ?? null,
    remainingDays: ctx.expiresAt
      ? Math.max(0, Math.ceil((ctx.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null,
    isTrialing: ctx.isTrialing,
    autoRenew: true,
  };
}

function extractLimits(ctx: OrgPlanContext): Record<string, number> {
  return {
    maxMembers: ctx.maxMembers,
    maxBranches: ctx.maxBranches,
    maxTrainers: ctx.maxTrainers,
    maxStaff: ctx.maxStaff,
    maxStorageGb: ctx.maxStorageGb,
    maxApiCalls: ctx.maxApiCalls,
    membershipPlanTypes: ctx.membershipPlanTypes,
    weeklyClasses: ctx.weeklyClasses,
    smsMonthly: ctx.smsMonthly,
  };
}
