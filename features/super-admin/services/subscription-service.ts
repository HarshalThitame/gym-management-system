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
  message: string;
};

type OrganizationWithSubscriptionRow = {
  id: string;
  name: string;
  billing_email: string | null;
  primary_domain: string | null;
  organization_subscriptions: OrganizationSubscriptionJoinRow | OrganizationSubscriptionJoinRow[] | null;
};

type OrganizationSubscriptionJoinRow = {
  id: string;
  package_id: string;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  trial_ends_at: string | null;
  packages: PackageNameJoinRow | PackageNameJoinRow[] | null;
};

type PackageNameJoinRow = {
  name: string;
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
  order(column: "name", options: { ascending: boolean }): QueryResult<OrganizationWithSubscriptionRow>;
};

type PackageQuery = {
  select(columns: string): PackageQuery;
  eq(column: "is_active", value: boolean): PackageQuery;
  order(column: "sort_order", options: { ascending: boolean }): QueryResult<PackageRow>;
};

type OrganizationSubscriptionMutation = {
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
  name,
  billing_email,
  primary_domain,
  organization_subscriptions (
    id,
    package_id,
    status,
    started_at,
    expires_at,
    trial_ends_at,
    packages (
      name
    )
  )
`;

/**
 * Returns all tenant organizations with their current package subscription,
 * including organizations that do not yet have an assigned package.
 */
export async function getAllOrgsWithSubscriptions(): Promise<OrgSubscriptionSummary[]> {
  const supabase = await getSubscriptionServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(ORGANIZATION_SUBSCRIPTION_SELECT)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapOrganizationSubscription);
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

function mapOrganizationSubscription(row: OrganizationWithSubscriptionRow): OrgSubscriptionSummary {
  const subscription = firstOrNull(row.organization_subscriptions);
  const packageRecord = subscription ? firstOrNull(subscription.packages) : null;

  return {
    organizationId: row.id,
    organizationName: row.name,
    organizationContact: row.billing_email ?? row.primary_domain,
    packageId: subscription?.package_id ?? null,
    packageName: packageRecord?.name ?? null,
    status: subscription?.status ?? null,
    startedAt: subscription?.started_at ?? null,
    expiresAt: subscription?.expires_at ?? null,
    trialEndsAt: subscription?.trial_ends_at ?? null,
    subscriptionId: subscription?.id ?? null
  };
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
