import { createSupabaseServerClient } from "@/lib/supabase/server";

export const subscriptionStatuses = ["active", "trial", "expired", "suspended", "cancelled"] as const;

export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  max_members: number;
  max_branches: number;
  qr_attendance_enabled: boolean;
  biometric_attendance_enabled: boolean;
  rfid_attendance_enabled: boolean;
  class_scheduling_enabled: boolean;
  trainer_assignment_enabled: boolean;
  razorpay_enabled: boolean;
  communications_enabled: boolean;
  ai_enabled: boolean;
  advanced_reports_enabled: boolean;
  custom_domain_enabled: boolean;
  api_access_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OrgSubscriptionSummary = {
  organizationId: string;
  organizationName: string;
  organizationContact: string | null;
  packageId: string | null;
  packageName: string | null;
  status: SubscriptionStatus | null;
  startedAt: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  subscriptionId: string | null;
};

export type AssignPackageToOrgInput = {
  organizationId: string;
  packageId: string;
  status?: SubscriptionStatus;
  expiresAt?: Date;
  trialEndsAt?: Date;
  assignedBy: string;
  notes?: string;
};

type SupabaseQueryError = {
  code?: string;
  message: string;
};

type OrganizationBaseRow = {
  id: string;
  name: string;
  billing_email: string | null;
  primary_domain: string | null;
};

type OrganizationSubscriptionSummaryRow = {
  id: string;
  organization_id: string;
  package_id: string;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  trial_ends_at: string | null;
};

type PackageSummaryRow = {
  id: string;
  name: string;
};

type PlatformSubscriptionFallbackRow = {
  id: string;
  organization_id: string;
  plan_tier: "starter" | "professional" | "enterprise";
  status: "trial" | "active" | "past_due" | "cancelled" | "suspended";
  starts_on: string;
  renews_on: string | null;
  trial_ends_on: string | null;
};

type OrganizationSubscriptionRow = {
  id: string;
  organization_id: string;
  package_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  started_at: string;
  expires_at: string | null;
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationSubscriptionUpsert = {
  organization_id: string;
  package_id: string;
  status: SubscriptionStatus;
  expires_at: string | null;
  trial_ends_at: string | null;
  assigned_by: string;
  notes: string | null;
};

type QueryResult<T> = Promise<{ data: T[] | null; error: SupabaseQueryError | null }>;
type MaybeSingleResult<T> = Promise<{ data: T | null; error: SupabaseQueryError | null }>;

type OrganizationQuery = {
  select(columns: string): OrganizationQuery;
  order(column: "name", options: { ascending: boolean }): QueryResult<OrganizationBaseRow>;
};

type PackageQuery = {
  select(columns: "*"): PackageActiveQuery;
  select(columns: string): QueryResult<PackageSummaryRow>;
};

type PackageActiveQuery = {
  eq(column: "is_active", value: boolean): PackageActiveQuery;
  order(column: "sort_order", options: { ascending: boolean }): QueryResult<PackageRow>;
};

type OrganizationSubscriptionMutation = {
  select(columns: string): QueryResult<OrganizationSubscriptionSummaryRow>;
  upsert(payload: OrganizationSubscriptionUpsert, options: { onConflict: "organization_id" }): OrganizationSubscriptionReturningQuery;
  update(payload: Pick<OrganizationSubscriptionRow, "status">): OrganizationSubscriptionFilterQuery;
};

type PlatformSubscriptionQuery = {
  select(columns: string): QueryResult<PlatformSubscriptionFallbackRow>;
};

type OrganizationSubscriptionFilterQuery = {
  eq(column: "id", value: string): OrganizationSubscriptionReturningQuery;
};

type OrganizationSubscriptionReturningQuery = {
  select(columns: string): OrganizationSubscriptionSingleQuery;
};

type OrganizationSubscriptionSingleQuery = {
  maybeSingle(): MaybeSingleResult<OrganizationSubscriptionRow>;
};

type SubscriptionServiceSupabaseClient = {
  from(table: "organizations"): OrganizationQuery;
  from(table: "packages"): PackageQuery;
  from(table: "organization_subscriptions"): OrganizationSubscriptionMutation;
  from(table: "platform_subscriptions"): PlatformSubscriptionQuery;
};

const ORGANIZATION_SUBSCRIPTION_SELECT = `
  id,
  organization_id,
  package_id,
  status,
  started_at,
  expires_at,
  trial_ends_at
`;

/**
 * Returns all tenant organizations with their current package subscription,
 * including organizations that do not yet have an assigned package.
 */
export async function getAllOrgsWithSubscriptions(): Promise<OrgSubscriptionSummary[]> {
  const supabase = await getSubscriptionServiceClient();
  const [organizationsResult, subscriptionsResult, packagesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, billing_email, primary_domain")
      .order("name", { ascending: true }),
    supabase
      .from("organization_subscriptions")
      .select(ORGANIZATION_SUBSCRIPTION_SELECT),
    supabase
      .from("packages")
      .select("id, name")
  ]);

  if (organizationsResult.error) {
    throw new Error(organizationsResult.error.message);
  }

  if (isSchemaCacheMissing(subscriptionsResult.error) || isSchemaCacheMissing(packagesResult.error)) {
    return getAllOrgsWithLegacySubscriptions(supabase, organizationsResult.data ?? []);
  }

  const firstError = [subscriptionsResult, packagesResult].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const subscriptionsByOrganization = new Map((subscriptionsResult.data ?? []).map((subscription) => [subscription.organization_id, subscription]));
  const packageNamesById = new Map((packagesResult.data ?? []).map((packageRecord) => [packageRecord.id, packageRecord.name]));

  return (organizationsResult.data ?? []).map((organization) => {
    const subscription = subscriptionsByOrganization.get(organization.id) ?? null;
    return mapOrganizationSubscription(organization, subscription, subscription ? packageNamesById.get(subscription.package_id) ?? null : null);
  });
}

/**
 * Returns all active SaaS package tiers in display order for assignment forms.
 */
export async function getAllPackages(): Promise<PackageRow[]> {
  const supabase = await getSubscriptionServiceClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    if (isSchemaCacheMissing(error)) {
      console.error("[subscription-service] Packages table is not available. Apply the packages migration before assigning plans.");
      return [];
    }

    throw new Error(error.message);
  }

  return data ?? [];
}

/**
 * Creates or updates the current package subscription for an organization.
 */
export async function assignPackageToOrg({
  organizationId,
  packageId,
  status = "active",
  expiresAt,
  trialEndsAt,
  assignedBy,
  notes
}: AssignPackageToOrgInput): Promise<OrganizationSubscriptionRow> {
  const supabase = await getSubscriptionServiceClient();
  const payload: OrganizationSubscriptionUpsert = {
    organization_id: organizationId,
    package_id: packageId,
    status,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    trial_ends_at: status === "trial" && trialEndsAt ? trialEndsAt.toISOString() : null,
    assigned_by: assignedBy,
    notes: notes?.trim() ? notes.trim() : null
  };
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Subscription assignment failed.");
  }

  return data;
}

/**
 * Updates only the lifecycle status of an organization subscription row.
 */
export async function updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): Promise<OrganizationSubscriptionRow> {
  const supabase = await getSubscriptionServiceClient();
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .update({ status })
    .eq("id", subscriptionId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Subscription status update failed.");
  }

  return data;
}

async function getSubscriptionServiceClient() {
  return await createSupabaseServerClient() as unknown as SubscriptionServiceSupabaseClient;
}

function mapOrganizationSubscription(row: OrganizationBaseRow, subscription: OrganizationSubscriptionSummaryRow | null, packageName: string | null): OrgSubscriptionSummary {
  return {
    organizationId: row.id,
    organizationName: row.name,
    organizationContact: row.billing_email ?? row.primary_domain,
    packageId: subscription?.package_id ?? null,
    packageName,
    status: subscription?.status ?? null,
    startedAt: subscription?.started_at ?? null,
    expiresAt: subscription?.expires_at ?? null,
    trialEndsAt: subscription?.trial_ends_at ?? null,
    subscriptionId: subscription?.id ?? null
  };
}

async function getAllOrgsWithLegacySubscriptions(supabase: SubscriptionServiceSupabaseClient, organizations: OrganizationBaseRow[]): Promise<OrgSubscriptionSummary[]> {
  console.error("[subscription-service] Package subscription tables are not available. Falling back to platform_subscriptions for read-only summaries.");

  const { data, error } = await supabase
    .from("platform_subscriptions")
    .select("id, organization_id, plan_tier, status, starts_on, renews_on, trial_ends_on");

  if (error) {
    console.error("[subscription-service] Legacy subscription fallback failed.", error.message);
    return organizations.map((organization) => mapLegacyOrganizationSubscription(organization, null));
  }

  const subscriptionsByOrganization = new Map((data ?? []).map((subscription) => [subscription.organization_id, subscription]));

  return organizations.map((organization) => mapLegacyOrganizationSubscription(organization, subscriptionsByOrganization.get(organization.id) ?? null));
}

function mapLegacyOrganizationSubscription(row: OrganizationBaseRow, subscription: PlatformSubscriptionFallbackRow | null): OrgSubscriptionSummary {
  return {
    organizationId: row.id,
    organizationName: row.name,
    organizationContact: row.billing_email ?? row.primary_domain,
    packageId: null,
    packageName: subscription ? legacyPackageName(subscription.plan_tier) : null,
    status: subscription ? legacySubscriptionStatus(subscription.status) : null,
    startedAt: subscription?.starts_on ?? null,
    expiresAt: subscription?.renews_on ?? null,
    trialEndsAt: subscription?.trial_ends_on ?? null,
    subscriptionId: subscription?.id ?? null
  };
}

function legacySubscriptionStatus(status: PlatformSubscriptionFallbackRow["status"]): SubscriptionStatus {
  if (status === "past_due") {
    return "expired";
  }

  return status;
}

function legacyPackageName(planTier: PlatformSubscriptionFallbackRow["plan_tier"]) {
  if (planTier === "starter") {
    return "Lite";
  }

  if (planTier === "professional") {
    return "Standard";
  }

  return "Premium";
}

function isSchemaCacheMissing(error: SupabaseQueryError | null | undefined) {
  if (!error) {
    return false;
  }

  return error.code === "PGRST205"
    || error.message.includes("schema cache")
    || error.message.includes("Could not find the table")
    || error.message.includes("Could not find a relationship");
}
