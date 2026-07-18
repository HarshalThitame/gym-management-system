import { getOrganizationEntitlements } from "@/features/entitlement";
import { normalizePackageTier } from "@/features/entitlement/package-tier";
import { getOrgFeatureFlags } from "./feature-resolver";
import type { OrgFeatureFlags } from "./feature-flags";

export type OrgPlanContext = {
  packageName: string;
  packageSlug: string;
  packageId: string | null;
  status: string;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  isTrialing: boolean;
  isSuspended: boolean;
  features: OrgFeatureFlags;
  maxMembers: number;
  maxBranches: number;
  maxTrainers: number;
  maxStaff: number;
  maxStorageGb: number;
  maxApiCalls: number;
  membershipPlanTypes: number;
  weeklyClasses: number;
  smsMonthly: number;
};

export async function getOrgPlanContext(organizationId: string): Promise<OrgPlanContext> {
  const features = await getOrgFeatureFlags(organizationId);

  try {
    const snapshot = await getOrganizationEntitlements(organizationId);
    if (!snapshot.subscriptionId) return defaultPlanContext(features);

    return mapPlanContext(snapshot, features);
  } catch (error) {
    console.error("Unexpected plan context failure", {
      organizationId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return defaultPlanContext(features);
  }
}

function defaultPlanContext(features: OrgFeatureFlags): OrgPlanContext {
  return {
    packageName: "No Plan",
    packageSlug: "",
    packageId: null,
    status: "none",
    expiresAt: null,
    trialEndsAt: null,
    isTrialing: false,
    isSuspended: false,
    features,
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
}

function mapPlanContext(
  snapshot: Awaited<ReturnType<typeof getOrganizationEntitlements>>,
  features: OrgFeatureFlags,
): OrgPlanContext {
  const status = snapshot.subscriptionStatus;
  const isEffective = status === "active" || status === "trial";
  const expiresAt = isEffective ? readDate(snapshot.endDate) : null;
  const trialEndsAt = status === "trial" ? readDate(snapshot.endDate) : null;
  const packageSlug = normalizePackageTier(snapshot.packageName) ?? normalizePackageTier(snapshot.packageId) ?? "";

  return {
    packageName: snapshot.packageName ?? "No Plan",
    packageSlug,
    packageId: snapshot.packageId,
    status,
    expiresAt,
    trialEndsAt,
    isTrialing: status === "trial" && Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now()),
    isSuspended: status === "suspended" || status === "expired",
    features,
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
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
