"use server";

import { assertUserBelongsToOrganization, getOrganizationEntitlements } from "@/features/entitlement";
import type { FeatureKey } from "@/features/entitlement";
import type { OrgFeatureFlags } from "@/lib/tenant/feature-flags";
import { getOrgFeatureFlags } from "@/lib/tenant/feature-resolver";

export type EntitlementKey = FeatureKey;

export type PlanSummary = {
  packageId: string | null;
  name: string;
  status: string;
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
    active: FeatureKey[];
    locked: FeatureKey[];
  };
  limits: Record<string, number>;
  allFeatures: OrgFeatureFlags;
};

export async function getEntitlementSummaryAction(organizationId: string): Promise<EntitlementSummary> {
  await assertUserBelongsToOrganization(organizationId);
  const snapshot = await getOrganizationEntitlements(organizationId);
  const allFeatures = await getOrgFeatureFlags(organizationId);

  const activeFeatureKeys = snapshot.activeFeatureKeys;

  const plan: PlanSummary | null = snapshot.subscriptionId && snapshot.packageId ? {
    packageId: snapshot.packageId,
    name: snapshot.packageName,
    status: snapshot.subscriptionStatus,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    remainingDays: snapshot.endDate
      ? Math.max(0, Math.ceil((new Date(snapshot.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null,
    isTrialing: snapshot.subscriptionStatus === "trial",
    autoRenew: true,
  } : null;

  const limits: Record<string, number> = { ...snapshot.limits };

  return {
    organizationId,
    plan,
    features: { active: activeFeatureKeys, locked: [] },
    limits,
    allFeatures,
  };
}
