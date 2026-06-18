"use server";

import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import type { OrgFeatureFlags, FeatureFlagKey } from "@/lib/tenant/feature-flags";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";

export type EntitlementKey = FeatureFlagKey;

export type PlanSummary = {
  packageId: string | null;
  name: string;
  status: "active" | "trial" | "cancelled" | "expired" | "suspended" | "pending_activation" | "none";
  startDate: string | null;
  endDate: string | null;
  remainingDays: number | null;
  isTrialing: boolean;
  autoRenew: boolean;
};

export type EntitlementSummary = {
  organizationId: string;
  plan: PlanSummary | null;
  features: {
    active: string[];
    locked: string[];
  };
  limits: Record<string, number>;
  allFeatures: OrgFeatureFlags;
};

export async function getEntitlementSummaryAction(organizationId: string): Promise<EntitlementSummary> {
  const ctx: OrgPlanContext = await getOrgPlanContext(organizationId);

  const plan: PlanSummary | null = ctx.packageId ? {
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
  } : null;

  const features = ctx.features;
  const activeFeatures: string[] = [];
  const lockedFeatures: string[] = [];

  for (const [key, value] of Object.entries(features)) {
    if (typeof value === "boolean") {
      if (value) activeFeatures.push(key);
    }
  }

  const limits: Record<string, number> = {
    maxMembers: features.maxMembers,
    maxBranches: features.maxBranches,
    maxTrainers: features.maxTrainers,
    maxStaff: features.maxStaff,
    maxStorageGb: features.maxStorageGb,
    maxApiCalls: features.maxApiCalls,
    membershipPlanTypes: features.membershipPlanTypes,
    weeklyClasses: features.weeklyClasses,
    smsMonthly: features.smsMonthly,
  };

  return {
    organizationId,
    plan,
    features: { active: activeFeatures, locked: lockedFeatures },
    limits,
    allFeatures: features,
  };
}
