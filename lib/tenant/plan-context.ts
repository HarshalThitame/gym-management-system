import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  maxGyms: number;
  maxTrainers: number;
  maxStaff: number;
  maxStorageGb: number;
  maxApiCalls: number;
};


/**
 * Resolves organization package metadata and feature flags.
 * Uses the new package_features/package_limits entitlement system.
 */
export async function getOrgPlanContext(organizationId: string): Promise<OrgPlanContext> {
  const features = await getOrgFeatureFlags(organizationId);

  try {
    const supabase = await createSupabaseServerClient();
    const s = supabase as never as {
      from(t: string): {
        select(c: string): {
          eq(k: string, v: string): {
            in(k: string, v: string[]): {
              order(k: string, o: { ascending: boolean }): {
                limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
              };
            };
          };
        };
      };
    };

    const { data: subs } = await s
      .from("organization_subscriptions")
      .select("status, expires_at, trial_ends_at, package_id, packages!inner(name, slug)")
      .eq("organization_id", organizationId)
      .in("status", ["active", "trial", "expired", "suspended", "cancelled"])
      .order("started_at", { ascending: false })
      .limit(1);

    const sub = (subs ?? [])[0];
    if (!sub) return defaultPlanContext(features);

    return mapPlanContext(sub, features);
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
    maxGyms: features.maxGyms,
    maxTrainers: features.maxTrainers,
    maxStaff: features.maxStaff,
    maxStorageGb: features.maxStorageGb,
    maxApiCalls: features.maxApiCalls,
  };
}

function mapPlanContext(sub: Record<string, unknown>, features: OrgFeatureFlags): OrgPlanContext {
  const status = typeof sub.status === "string" ? sub.status : "none";
  const expiresAt = readDate(sub.expires_at);
  const trialEndsAt = readDate(sub.trial_ends_at);
  const pkg = readPackage(sub.packages);
  const packageId = sub.package_id as string | null;

  return {
    packageName: pkg?.name ?? "No Plan",
    packageSlug: pkg?.slug ?? "",
    packageId,
    status,
    expiresAt,
    trialEndsAt,
    isTrialing: status === "trial" && Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now()),
    isSuspended: status === "suspended" || status === "expired",
    features,
    maxMembers: features.maxMembers,
    maxBranches: features.maxBranches,
    maxGyms: features.maxGyms,
    maxTrainers: features.maxTrainers,
    maxStaff: features.maxStaff,
    maxStorageGb: features.maxStorageGb,
    maxApiCalls: features.maxApiCalls,
  };
}

function readPackage(value: unknown): { name: string; slug?: string } | null {
  const pkgRecord = Array.isArray(value) ? value[0] : value;
  if (!pkgRecord || typeof pkgRecord !== "object") return null;
  const r = pkgRecord as Record<string, unknown>;
  if (typeof r.name !== "string" || !r.name.trim()) return null;
  return { name: r.name, slug: (r.slug as string) ?? undefined };
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
