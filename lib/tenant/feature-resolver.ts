import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeatureFlagKey, OrgFeatureFlags } from "./feature-flags";

type SubscriptionStatus = "active" | "trial";

type SupabaseQueryError = {
  message: string;
};

type OrganizationSubscriptionQuery = {
  select(columns: string): OrganizationSubscriptionQuery;
  eq(column: "organization_id", value: string): OrganizationSubscriptionQuery;
  in(column: "status", values: SubscriptionStatus[]): OrganizationSubscriptionQuery;
  order(column: "started_at", options: { ascending: boolean }): OrganizationSubscriptionQuery;
  limit(count: number): OrganizationSubscriptionQuery;
  maybeSingle(): Promise<{ data: unknown; error: SupabaseQueryError | null }>;
};

type FeatureResolverSupabaseClient = {
  from(table: "organization_subscriptions"): OrganizationSubscriptionQuery;
};

const SAFE_DEFAULT_FEATURE_FLAGS: OrgFeatureFlags = {
  maxMembers: 0,
  maxBranches: 0,
  qrAttendanceEnabled: false,
  biometricAttendanceEnabled: false,
  rfidAttendanceEnabled: false,
  classSchedulingEnabled: false,
  trainerAssignmentEnabled: false,
  razorpayEnabled: false,
  communicationsEnabled: false,
  aiEnabled: false,
  advancedReportsEnabled: false,
  customDomainEnabled: false,
  apiAccessEnabled: false
};

const FEATURE_SELECT = `
  status,
  trial_ends_at,
  packages (
    max_members,
    max_branches,
    qr_attendance_enabled,
    biometric_attendance_enabled,
    rfid_attendance_enabled,
    class_scheduling_enabled,
    trainer_assignment_enabled,
    razorpay_enabled,
    communications_enabled,
    ai_enabled,
    advanced_reports_enabled,
    custom_domain_enabled,
    api_access_enabled
  )
`;

/**
 * Resolves the package feature flags for an organization.
 *
 * Use this in server components, server actions, route handlers, and server-side
 * services when a full package capability snapshot is needed. The resolver
 * fails closed: missing subscriptions, expired trials, malformed rows, and
 * Supabase errors all return a no-access default.
 */
export async function getOrgFeatureFlags(organizationId: string): Promise<OrgFeatureFlags> {
  try {
    const supabase = await getFeatureResolverClient();
    const { data, error } = await supabase
      .from("organization_subscriptions")
      .select(FEATURE_SELECT)
      .eq("organization_id", organizationId)
      .in("status", ["active", "trial"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve organization feature flags", {
        organizationId,
        message: error.message
      });
      return safeDefaultFeatureFlags();
    }

    return mapSubscriptionToFeatureFlags(data);
  } catch (error) {
    console.error("Unexpected feature resolver failure", {
      organizationId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return safeDefaultFeatureFlags();
  }
}

/**
 * Checks a single package feature flag for an organization.
 *
 * Use this convenience helper when a service or page only needs one boolean
 * capability check and does not need the complete package limit snapshot.
 */
export async function hasFeature(organizationId: string, feature: FeatureFlagKey): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);
  return flags[feature];
}

/**
 * Throws when an organization does not have a required package feature.
 *
 * Use this inside server actions and API route handlers where unavailable
 * package capabilities should immediately stop the operation.
 */
export async function assertFeature(organizationId: string, feature: FeatureFlagKey): Promise<void> {
  const enabled = await hasFeature(organizationId, feature);

  if (!enabled) {
    throw new Error("Feature not available on your current plan.");
  }
}

/**
 * Checks whether an organization can add another member under its package.
 *
 * `maxMembers` uses -1 for unlimited. The comparison is strict so an org with
 * maxMembers 150 can add while the current count is 149, but not at 150.
 */
export async function isWithinMemberLimit(organizationId: string, currentMemberCount: number): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);

  if (flags.maxMembers === -1) {
    return true;
  }

  return currentMemberCount < flags.maxMembers;
}

/**
 * Checks whether an organization can add another branch under its package.
 *
 * `maxBranches` uses -1 for unlimited. The comparison is strict so an org with
 * maxBranches 3 can add while the current count is 2, but not at 3.
 */
export async function isWithinBranchLimit(organizationId: string, currentBranchCount: number): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);

  if (flags.maxBranches === -1) {
    return true;
  }

  return currentBranchCount < flags.maxBranches;
}

async function getFeatureResolverClient() {
  return await createSupabaseServerClient() as unknown as FeatureResolverSupabaseClient;
}

function safeDefaultFeatureFlags(): OrgFeatureFlags {
  return { ...SAFE_DEFAULT_FEATURE_FLAGS };
}

function mapSubscriptionToFeatureFlags(value: unknown): OrgFeatureFlags {
  if (!isRecord(value)) {
    return safeDefaultFeatureFlags();
  }

  const status = value.status;
  if (status !== "active" && status !== "trial") {
    return safeDefaultFeatureFlags();
  }

  if (status === "trial" && !isTrialValid(value.trial_ends_at)) {
    return safeDefaultFeatureFlags();
  }

  const packageRecord = readPackageRecord(value.packages);
  if (!packageRecord) {
    return safeDefaultFeatureFlags();
  }

  return {
    maxMembers: readNumber(packageRecord, "max_members"),
    maxBranches: readNumber(packageRecord, "max_branches"),
    qrAttendanceEnabled: readBoolean(packageRecord, "qr_attendance_enabled"),
    biometricAttendanceEnabled: readBoolean(packageRecord, "biometric_attendance_enabled"),
    rfidAttendanceEnabled: readBoolean(packageRecord, "rfid_attendance_enabled"),
    classSchedulingEnabled: readBoolean(packageRecord, "class_scheduling_enabled"),
    trainerAssignmentEnabled: readBoolean(packageRecord, "trainer_assignment_enabled"),
    razorpayEnabled: readBoolean(packageRecord, "razorpay_enabled"),
    communicationsEnabled: readBoolean(packageRecord, "communications_enabled"),
    aiEnabled: readBoolean(packageRecord, "ai_enabled"),
    advancedReportsEnabled: readBoolean(packageRecord, "advanced_reports_enabled"),
    customDomainEnabled: readBoolean(packageRecord, "custom_domain_enabled"),
    apiAccessEnabled: readBoolean(packageRecord, "api_access_enabled")
  };
}

function readPackageRecord(value: unknown) {
  const packageValue = Array.isArray(value) ? value[0] : value;
  return isRecord(packageValue) ? packageValue : null;
}

function isTrialValid(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trialEndsAt = Date.parse(value);
  return Number.isFinite(trialEndsAt) && trialEndsAt > Date.now();
}

function readBoolean(record: Record<string, unknown>, key: string) {
  return record[key] === true;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
