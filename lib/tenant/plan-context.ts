import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgFeatureFlags } from "./feature-resolver";
import type { OrgFeatureFlags } from "./feature-flags";

type SupabaseQueryError = {
  message: string;
};

type PlanSubscriptionQuery = {
  select(columns: string): PlanSubscriptionQuery;
  eq(column: "organization_id", value: string): PlanSubscriptionQuery;
  order(column: "started_at", options: { ascending: boolean }): PlanSubscriptionQuery;
  limit(count: number): PlanSubscriptionQuery;
  maybeSingle(): Promise<{ data: unknown; error: SupabaseQueryError | null }>;
};

type PlanContextSupabaseClient = {
  from(table: "organization_subscriptions"): PlanSubscriptionQuery;
};

export type OrgPlanContext = {
  packageName: string;
  status: string;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  isTrialing: boolean;
  isSuspended: boolean;
  features: OrgFeatureFlags;
};

const PLAN_SELECT = `
  status,
  expires_at,
  trial_ends_at,
  packages (
    name
  )
`;

/**
 * Resolves organization package metadata and feature flags for portal rendering.
 *
 * Use this in server components when a page needs both the feature access
 * snapshot and the subscription state shown to the user.
 */
export async function getOrgPlanContext(organizationId: string): Promise<OrgPlanContext> {
  const features = await getOrgFeatureFlags(organizationId);

  try {
    const supabase = await getPlanContextClient();
    const { data, error } = await supabase
      .from("organization_subscriptions")
      .select(PLAN_SELECT)
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve organization plan context", {
        organizationId,
        message: error.message
      });
      return defaultPlanContext(features);
    }

    return mapPlanContext(data, features);
  } catch (error) {
    console.error("Unexpected plan context failure", {
      organizationId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return defaultPlanContext(features);
  }
}

async function getPlanContextClient() {
  return await createSupabaseServerClient() as unknown as PlanContextSupabaseClient;
}

function defaultPlanContext(features: OrgFeatureFlags): OrgPlanContext {
  return {
    packageName: "No Plan",
    status: "none",
    expiresAt: null,
    trialEndsAt: null,
    isTrialing: false,
    isSuspended: false,
    features
  };
}

function mapPlanContext(value: unknown, features: OrgFeatureFlags): OrgPlanContext {
  if (!isRecord(value)) {
    return defaultPlanContext(features);
  }

  const status = typeof value.status === "string" ? value.status : "none";
  const expiresAt = readDate(value.expires_at);
  const trialEndsAt = readDate(value.trial_ends_at);

  return {
    packageName: readPackageName(value.packages),
    status,
    expiresAt,
    trialEndsAt,
    isTrialing: status === "trial" && Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now()),
    isSuspended: status === "suspended" || status === "expired",
    features
  };
}

function readPackageName(value: unknown) {
  const packageRecord = Array.isArray(value) ? value[0] : value;

  if (isRecord(packageRecord) && typeof packageRecord.name === "string" && packageRecord.name.trim().length > 0) {
    return packageRecord.name;
  }

  return "No Plan";
}

function readDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
