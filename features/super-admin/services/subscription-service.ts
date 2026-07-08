import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus as CanonicalSubscriptionStatus } from "@/features/entitlement";
import { syncSubscriptionArtifactsForOrganization } from "./subscription-entitlement-sync";

export const subscriptionStatuses = SUBSCRIPTION_STATUSES;

export type SubscriptionStatus = CanonicalSubscriptionStatus;

export type PackageRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  color: string | null;
  icon: string | null;
  trial_days: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Legacy compatibility fields (nullable after migration)
  max_members?: number;
  max_branches?: number;
  qr_attendance_enabled?: boolean;
  biometric_attendance_enabled?: boolean;
  rfid_attendance_enabled?: boolean;
  class_scheduling_enabled?: boolean;
  trainer_assignment_enabled?: boolean;
  razorpay_enabled?: boolean;
  communications_enabled?: boolean;
  ai_enabled?: boolean;
  advanced_reports_enabled?: boolean;
  custom_domain_enabled?: boolean;
  api_access_enabled?: boolean;
  price?: number;
  billing_period?: string;
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
  slug?: string;
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
    console.error("[subscription-service] Organizations query failed.", organizationsResult.error.message);
    return [];
  }

  const firstError = [subscriptionsResult, packagesResult].find((result) => result.error)?.error;

  if (firstError) {
    console.error("[subscription-service] Subscription or packages query failed.", firstError.message);
    return [];
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
    console.error("[subscription-service] Packages query failed.", error.message);
    return [];
  }

  return (data ?? []).map((pkg) => {
    const p = pkg as unknown as Record<string, unknown>;
    return {
      id: p.id as string,
      name: p.name as string,
      slug: (p.slug as string) ?? "",
      description: p.description as string | null,
      is_active: p.is_active as boolean,
      is_archived: (p.is_archived as boolean) ?? false,
      sort_order: (p.sort_order as number) ?? 0,
      color: p.color as string | null,
      icon: p.icon as string | null,
      trial_days: (p.trial_days as number) ?? 0,
      metadata: p.metadata as Record<string, unknown> | null,
      created_at: p.created_at as string,
      updated_at: p.updated_at as string,
      archived_at: p.archived_at as string | null,
    } as PackageRow;
  });
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

  await syncSubscriptionArtifactsForOrganization(
    organizationId,
    `Package assignment synced for ${organizationId}.`,
  );

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

  await syncSubscriptionArtifactsForOrganization(
    data.organization_id,
    `Subscription status changed to ${status}.`,
  );

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

// Legacy platform_subscriptions fallback removed.
// All subscription data now uses organization_subscriptions and packages tables.
