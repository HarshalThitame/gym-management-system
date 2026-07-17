import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type {
  ActivityEventRow,
  BranchRow,
  EnterpriseDashboard,
  GymRow,
  OrganizationRow,
  TenantDomainRow
} from "@/types/enterprise";
import {
  buildOrganizationDiff,
  getOrganizationLegalHoldState,
  getOrganizationPurgeEligibility,
  getOrganizationSoftDeleteState,
  isRestoreWindowOpen,
  type OrganizationDiffItem,
  type OrganizationGovernanceSnapshot,
  type OrganizationLegalHoldState,
  type OrganizationPurgeEligibility,
  type OrganizationSoftDeleteState
} from "@/features/super-admin/lib/organization-governance";
import { getAllPackages, type OrgSubscriptionSummary, type PackageRow, type SubscriptionStatus } from "./subscription-service";

export const organizationSortOptions = ["created_desc", "name_asc", "health_asc", "revenue_desc", "members_desc"] as const;

export type OrganizationSortOption = (typeof organizationSortOptions)[number];

export type OrganizationManagementFilters = {
  query: string;
  status: string;
  sort: OrganizationSortOption;
  page: number;
  pageSize: number;
};

export type OrganizationManagementPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export type OrganizationOwnerCandidate = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
};

export type OrganizationUsageSummary = {
  gyms: number;
  branches: number;
  activeBranches: number;
  staff: number;
  trainers: number;
  members: number;
  activeMembers: number;
  payments: number;
  revenue: number;
  domains: number;
  storageMb: number;
  openSecurityEvents: number;
  criticalSecurityEvents: number;
};

export type OrganizationSubscriptionDetails = {
  subscriptionId: string | null;
  packageId: string | null;
  packageName: string | null;
  status: SubscriptionStatus | null;
  startedAt: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  billingPeriod: string | null;
  billingEngine: string | null;
  providerSubscriptionId: string | null;
  latestInvoiceId: string | null;
  latestPaymentId: string | null;
  nextBillingDate: string | null;
  dunningAttempts: number | null;
  dunningStatus: string | null;
  dunningNextRetry: string | null;
  maxMembers: number | null;
  maxBranches: number | null;
  enabledFeatures: number;
};

export type OrganizationAuditTimelineItem = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  severity: "info" | "notice" | "warning" | "critical";
  entityType: string;
  entityId: string | null;
  createdAt: string;
  metadata: Json;
  ipAddress: string | null;
  userAgent: string | null;
  source: "activity_events" | "audit_logs";
};

export type OrganizationDeletionProtection = {
  canDelete: boolean;
  reasons: string[];
};

export type OrganizationHealthScore = {
  score: number;
  status: "good" | "watch" | "risk";
  label: string;
  factors: string[];
};

export type OrganizationApprovalRequest = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  organizationSlug: string | null;
  organizationStatus: string | null;
  action: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  requestedBy: string | null;
  requestedByName: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  targetUserId: string | null;
  reason: string | null;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  expiresAt: string;
  diff: OrganizationDiffItem[];
};

export type OrganizationManagementRecord = {
  organization: OrganizationRow;
  owner: OrganizationOwnerCandidate | null;
  usage: OrganizationUsageSummary;
  subscription: OrganizationSubscriptionDetails;
  auditTimeline: OrganizationAuditTimelineItem[];
  deletionProtection: OrganizationDeletionProtection;
  health: OrganizationHealthScore;
  tags: string[];
  approvalRequests: OrganizationApprovalRequest[];
  pendingApprovalCount: number;
  softDelete: OrganizationSoftDeleteState & { restoreAvailable: boolean };
  legalHold: OrganizationLegalHoldState;
  purgeEligibility: OrganizationPurgeEligibility;
};

export type OrganizationManagementSummary = {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  unassignedPlans: number;
  protectedDeletes: number;
  pendingApprovals: number;
  averageHealthScore: number;
};

export type OrganizationManagementData = {
  records: OrganizationManagementRecord[];
  ownerCandidates: OrganizationOwnerCandidate[];
  packages: PackageRow[];
  filters: OrganizationManagementFilters;
  pagination: OrganizationManagementPagination;
  summary: OrganizationManagementSummary;
};

export type OrganizationApprovalInboxFilters = {
  query: string;
  status: string;
  action: string;
  page: number;
  pageSize: number;
};

export type OrganizationApprovalInboxData = {
  approvals: OrganizationApprovalRequest[];
  filters: OrganizationApprovalInboxFilters;
  pagination: OrganizationManagementPagination;
  summary: {
    pending: number;
    expired: number;
    reviewed: number;
  };
};

export type OrganizationDetailAuditFilters = {
  query: string;
  severity: string;
  source: string;
};

export type OrganizationDetailListFilters = {
  gymsPage: number;
  gymsPageSize: number;
  branchesPage: number;
  branchesPageSize: number;
  usersPage: number;
  usersPageSize: number;
  domainsPage: number;
  domainsPageSize: number;
  securityPage: number;
  securityPageSize: number;
};

export type OrganizationUserAssignment = Database["public"]["Tables"]["branch_users"]["Row"] & {
  profile: OrganizationOwnerCandidate | null;
};

export type UsageSnapshotRow = {
  id: string;
  organization_id: string;
  snapshot_date: string;
  member_count: number;
  branch_count: number;
  active_trainers: number;
  storage_gb: number;
  api_calls_last_30d: number;
  created_at: string;
};

export type OrganizationDetailData = {
  record: OrganizationManagementRecord;
  packages: PackageRow[];
  ownerCandidates: OrganizationOwnerCandidate[];
  gyms: GymRow[];
  branches: BranchRow[];
  users: OrganizationUserAssignment[];
  domains: TenantDomainRow[];
  securityEvents: Database["public"]["Tables"]["security_events"]["Row"][];
  approvalRequests: OrganizationApprovalRequest[];
  auditTimeline: OrganizationAuditTimelineItem[];
  recentPayments: PaymentRow[];
  paymentAttempts: Database["public"]["Tables"]["payment_attempts"]["Row"][];
  subscriptionInvoices: Database["public"]["Tables"]["org_subscription_invoices"]["Row"][];
  subscriptionPayments: Database["public"]["Tables"]["org_subscription_payments"]["Row"][];
  billingGatewayHealth: OrganizationBillingGatewayHealth;
  usageSnapshots: UsageSnapshotRow[];
  gymAdminMap: Record<string, { assigned: boolean; adminName: string | null; adminStatus: string | null }>;
  auditFilters: OrganizationDetailAuditFilters;
  listFilters: OrganizationDetailListFilters;
  listPagination: {
    gyms: OrganizationManagementPagination;
    branches: OrganizationManagementPagination;
    users: OrganizationManagementPagination;
    domains: OrganizationManagementPagination;
    security: OrganizationManagementPagination;
  };
};

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email" | "phone" | "status">;
type MemberRow = Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "gym_id" | "status">;
type PaymentRow = Pick<Database["public"]["Tables"]["payments"]["Row"], "id" | "gym_id" | "status" | "amount" | "currency" | "payment_number" | "created_at" | "method" | "provider">;
type AuditLogRow = Pick<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "actor_id" | "action" | "entity_type" | "entity_id" | "metadata" | "ip_address" | "user_agent" | "created_at">;
type BranchUserRow = Database["public"]["Tables"]["branch_users"]["Row"];
type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];
export type OrganizationBillingGatewayHealth = {
  provider: string | null;
  providerEnvironment: string | null;
  status: "healthy" | "watch" | "risk" | "unknown";
  source: "live_org_data" | "unknown";
  lastEventAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failedEvents7d: number;
  webhookBacklog: number;
  retryBacklog: number;
  latestFailureMessage: string | null;
  retryLimit: number;
  retryCooldownMinutes: number;
  retryReadyAt: string | null;
  retryCooldownRemainingMinutes: number | null;
  retryBlocked: boolean;
};

type SupabaseQueryError = {
  message: string;
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
type OrganizationApprovalRequestRow = {
  id: string;
  organization_id: string;
  action: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  requested_by: string | null;
  reviewed_by: string | null;
  target_user_id: string | null;
  before_snapshot: Json;
  after_snapshot: Json;
  reason: string | null;
  review_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  expires_at: string;
};

type OrganizationManagementSupplementClient = {
  from(table: "profiles"): {
    select(columns: string): {
      in(column: "status" | "id", values: string[]): {
        order(column: "full_name", options: { ascending: boolean }): {
          limit(count: number): Promise<{ data: ProfileRow[] | null; error: SupabaseQueryError | null }>;
        };
        limit(count: number): Promise<{ data: ProfileRow[] | null; error: SupabaseQueryError | null }>;
      };
    };
  };
  from(table: "organization_subscriptions"): {
    select(columns: string): {
      in(column: "organization_id", values: string[]): Promise<{ data: OrganizationSubscriptionSummaryRow[] | null; error: SupabaseQueryError | null }>;
    };
  };
  from(table: "organization_approval_requests"): {
    select(columns: string): {
      in(column: "organization_id", values: string[]): {
        order(column: "requested_at", options: { ascending: boolean }): {
          limit(count: number): Promise<{ data: OrganizationApprovalRequestRow[] | null; error: SupabaseQueryError | null }>;
        };
      };
    };
  };
};

type ApprovalInboxSelectQuery = {
  eq(column: "status" | "action", value: string): ApprovalInboxSelectQuery;
  or(filters: string): ApprovalInboxSelectQuery;
  order(column: "requested_at", options: { ascending: boolean }): {
    range(from: number, to: number): Promise<{ data: OrganizationApprovalRequestRow[] | null; error: SupabaseQueryError | null; count: number | null }>;
  };
};

type OrganizationApprovalInboxClient = {
  from(table: "organization_approval_requests"): {
    select(columns: string, options?: { count?: "exact" }): ApprovalInboxSelectQuery;
  };
};

const defaultFilters: OrganizationManagementFilters = {
  query: "",
  status: "all",
  sort: "created_desc",
  page: 1,
  pageSize: 12
};

const ORGANIZATION_SUBSCRIPTION_SELECT = "id, organization_id, package_id, status, started_at, expires_at, trial_ends_at, billing_period, billing_engine, provider_subscription_id, latest_invoice_id, latest_payment_id, next_billing_date, dunning_attempts, dunning_status, dunning_next_retry";

const defaultApprovalInboxFilters: OrganizationApprovalInboxFilters = {
  query: "",
  status: "pending",
  action: "all",
  page: 1,
  pageSize: 25
};

const defaultDetailListFilters: OrganizationDetailListFilters = {
  gymsPage: 1,
  gymsPageSize: 25,
  branchesPage: 1,
  branchesPageSize: 25,
  usersPage: 1,
  usersPageSize: 25,
  domainsPage: 1,
  domainsPageSize: 25,
  securityPage: 1,
  securityPageSize: 25
};

export async function getOrganizationManagementData(
  _dashboard?: EnterpriseDashboard,
  input: Partial<OrganizationManagementFilters> = {}
): Promise<OrganizationManagementData> {
  const supabase = await createSupabaseServerClient();
  const filters = normalizeOrganizationFilters(input);
  const organizationPage = await queryOrganizationPage(supabase, filters);
  const packages = await getAllPackages();
  const ownerCandidates = await getOwnerCandidates(supabase as unknown as OrganizationManagementSupplementClient);
  const records = await buildOrganizationRecords({
    supabase,
    organizations: organizationPage.organizations,
    packages,
    ownerCandidates,
    auditFilters: { query: "", severity: "all", source: "all" },
    auditLimit: 8
  });

  const sortedRecords = sortRecords(records, filters.sort);
  const summary = await buildGlobalManagementSummary(supabase, filters, packages, ownerCandidates);

  return {
    records: sortedRecords,
    ownerCandidates,
    packages,
    filters,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: organizationPage.total,
      totalPages: Math.max(1, Math.ceil(organizationPage.total / filters.pageSize)),
      from: organizationPage.total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1,
      to: Math.min(filters.page * filters.pageSize, organizationPage.total)
    },
    summary
  };
}

export async function getOrganizationDetailData(
  organizationId: string,
  auditFilters: Partial<OrganizationDetailAuditFilters> = {},
  listFiltersInput: Partial<OrganizationDetailListFilters> = {}
): Promise<OrganizationDetailData | null> {
  const supabase = await createSupabaseServerClient();
  const filters = normalizeAuditFilters(auditFilters);
  const listFilters = normalizeDetailListFilters(listFiltersInput);
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!organization) {
    return null;
  }

  const packages = await getAllPackages();
  const ownerCandidates = await getOwnerCandidates(supabase as unknown as OrganizationManagementSupplementClient);
  const [record] = await buildOrganizationRecords({
    supabase,
    organizations: [organization],
    packages,
    ownerCandidates,
    auditFilters: filters,
    auditLimit: 80
  });

  if (!record) {
    return null;
  }

  const gymsRange = paginationRange(listFilters.gymsPage, listFilters.gymsPageSize);
  const branchesRange = paginationRange(listFilters.branchesPage, listFilters.branchesPageSize);
  const usersRange = paginationRange(listFilters.usersPage, listFilters.usersPageSize);
  const domainsRange = paginationRange(listFilters.domainsPage, listFilters.domainsPageSize);
  const securityRange = paginationRange(listFilters.securityPage, listFilters.securityPageSize);
  const [gymsResult, branchesResult, usersResult, domainsResult, securityResult] = await Promise.all([
    supabase
      .from("gyms")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(gymsRange.from, gymsRange.to),
    supabase
      .from("branches")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(branchesRange.from, branchesRange.to),
    supabase
      .from("branch_users")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .range(usersRange.from, usersRange.to),
    supabase
      .from("tenant_domains")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(domainsRange.from, domainsRange.to),
    supabase
      .from("security_events")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(securityRange.from, securityRange.to)
  ]);

  const firstError = [gymsResult, branchesResult, usersResult, domainsResult, securityResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const users = usersResult.data ?? [];
  const profiles = await getProfilesById(supabase as unknown as OrganizationManagementSupplementClient, users.map((user) => user.user_id));
  const profileById = new Map(profiles.map((profile) => [profile.id, profileToOwnerCandidate(profile)]));
  const gymIds = (gymsResult.data ?? []).map((gym) => gym.id);
  const recentPayments = gymIds.length > 0
    ? await getRecentPaymentsForGyms(supabase, gymIds)
    : [];

  const gymAdminMap = new Map<string, { assigned: boolean; adminName: string | null; adminStatus: string | null }>();
  if (gymIds.length > 0) {
    const branchIdsForGyms = (branchesResult.data ?? [])
      .filter((b) => b.gym_id && gymIds.includes(b.gym_id))
      .map((b) => b.id);
    if (branchIdsForGyms.length > 0) {
      const { data: gymAdminRows } = await supabase
        .from("branch_users")
        .select("user_id, branch_id, role_name")
        .in("branch_id", branchIdsForGyms)
        .eq("role_name", "gym_admin");
      const adminUserIds = [...new Set((gymAdminRows ?? []).map((r) => r.user_id))];
      const adminProfiles = adminUserIds.length > 0
        ? (await supabase.from("profiles").select("id, full_name, status").in("id", adminUserIds)).data ?? []
        : [];
      const adminNameMap = new Map(adminProfiles.map((p) => [p.id, p.full_name]));
      const adminStatusMap = new Map(adminProfiles.map((p) => [p.id, p.status]));
      const adminBranchesByGym = new Map<string, Set<string>>();
      for (const br of branchesResult.data ?? []) {
        if (!br.gym_id) continue;
        if (!adminBranchesByGym.has(br.gym_id)) adminBranchesByGym.set(br.gym_id, new Set());
        adminBranchesByGym.get(br.gym_id)!.add(br.id);
      }
      for (const gId of gymIds) {
        const gymBranchIds = adminBranchesByGym.get(gId) ?? new Set();
        const adminForGym = (gymAdminRows ?? []).find((r) => gymBranchIds.has(r.branch_id));
        gymAdminMap.set(gId, {
          assigned: adminForGym != null,
          adminName: adminForGym ? adminNameMap.get(adminForGym.user_id) ?? "Admin" : null,
          adminStatus: adminForGym ? adminStatusMap.get(adminForGym.user_id) ?? null : null
        });
      }
    }
  }

  const { data: usageSnapshotsData } = await supabase
    .from("subscription_usage_snapshots")
    .select("*")
    .eq("organization_id", organizationId)
    .order("snapshot_date", { ascending: false })
    .limit(12);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [subscriptionInvoicesResult, subscriptionPaymentsResult, paymentProviderEventsResult] = await Promise.all([
    supabase
      .from("org_subscription_invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("org_subscription_payments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("payment_provider_events")
      .select("id, event_id, event_type, status, error_message, processed_at, created_at, provider, provider_environment, invoice_id, subscription_id")
      .eq("organization_id", organizationId)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(24)
  ]);
  const { data: paymentAttempts, error: paymentAttemptsError } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  for (const result of [subscriptionInvoicesResult, subscriptionPaymentsResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  if (paymentAttemptsError) {
    throw new Error(paymentAttemptsError.message);
  }
  if (paymentProviderEventsResult.error) {
    throw new Error(paymentProviderEventsResult.error.message);
  }

  const paymentProviderEvents = paymentProviderEventsResult.data ?? [];
  const latestProviderEvent = paymentProviderEvents[0] ?? null;
  const failedProviderEvents = paymentProviderEvents.filter((event) => event.status === "failed");
  const successfulProviderEvents = paymentProviderEvents.filter((event) => event.status === "processed" || event.status === "success");
  const latestSuccessfulProviderEvent = successfulProviderEvents[0] ?? null;
  const latestFailedProviderEvent = failedProviderEvents[0] ?? null;
  const retryBacklog = (paymentAttempts ?? []).filter((attempt) => attempt.status === "failed" || attempt.status === "retrying" || attempt.status === "processing" || attempt.status === "created").length;
  const subscriptionPayments = subscriptionPaymentsResult.data ?? [];
  const webhookBacklog = subscriptionPayments.filter((payment) => payment.status === "awaiting_webhook" || payment.status === "processing").length;
  const latestFailureMessage = latestFailedProviderEvent?.error_message ?? (paymentAttempts ?? []).find((attempt) => attempt.status === "failed")?.error_description ?? subscriptionPayments.find((payment) => payment.status === "failed")?.failure_reason ?? null;
  const retryLimit = 3;
  const retryCooldownMinutes = 15;
  const retryCooldownRemainingMinutes = latestProviderEvent?.created_at
    ? Math.max(0, Math.ceil((new Date(latestProviderEvent.created_at).getTime() + retryCooldownMinutes * 60 * 1000 - Date.now()) / (60 * 1000)))
    : null;
  const retryReadyAt = latestProviderEvent?.created_at
    ? new Date(new Date(latestProviderEvent.created_at).getTime() + retryCooldownMinutes * 60 * 1000).toISOString()
    : null;
  const retryBlocked = retryBacklog >= retryLimit || Boolean(retryCooldownRemainingMinutes && retryCooldownRemainingMinutes > 0);
  const gatewayStatus: OrganizationBillingGatewayHealth["status"] =
    failedProviderEvents.length > 0 || retryBlocked
      ? "watch"
      : latestProviderEvent
        ? "healthy"
        : "unknown";

  return {
    record,
    packages,
    ownerCandidates,
    gyms: gymsResult.data ?? [],
    branches: branchesResult.data ?? [],
    users: users.map((user) => ({ ...user, profile: profileById.get(user.user_id) ?? null })),
    domains: domainsResult.data ?? [],
    securityEvents: securityResult.data ?? [],
    approvalRequests: record.approvalRequests,
    auditTimeline: record.auditTimeline,
    recentPayments,
    paymentAttempts: paymentAttempts ?? [],
    subscriptionInvoices: subscriptionInvoicesResult.data ?? [],
    subscriptionPayments,
    billingGatewayHealth: {
      provider: latestProviderEvent?.provider ?? latestSuccessfulProviderEvent?.provider ?? latestFailedProviderEvent?.provider ?? null,
      providerEnvironment: latestProviderEvent?.provider_environment ?? latestSuccessfulProviderEvent?.provider_environment ?? latestFailedProviderEvent?.provider_environment ?? null,
      status: gatewayStatus,
      source: "live_org_data",
      lastEventAt: latestProviderEvent?.created_at ?? null,
      lastSuccessAt: latestSuccessfulProviderEvent?.created_at ?? null,
      lastFailureAt: latestFailedProviderEvent?.created_at ?? null,
      failedEvents7d: failedProviderEvents.length,
      webhookBacklog,
      retryBacklog,
      latestFailureMessage,
      retryLimit,
      retryCooldownMinutes,
      retryReadyAt,
      retryCooldownRemainingMinutes,
      retryBlocked,
    },
    usageSnapshots: usageSnapshotsData ?? [],
    gymAdminMap: Object.fromEntries(gymAdminMap),
    auditFilters: filters,
    listFilters,
    listPagination: {
      gyms: buildPagination(listFilters.gymsPage, listFilters.gymsPageSize, gymsResult.count ?? 0),
      branches: buildPagination(listFilters.branchesPage, listFilters.branchesPageSize, branchesResult.count ?? 0),
      users: buildPagination(listFilters.usersPage, listFilters.usersPageSize, usersResult.count ?? 0),
      domains: buildPagination(listFilters.domainsPage, listFilters.domainsPageSize, domainsResult.count ?? 0),
      security: buildPagination(listFilters.securityPage, listFilters.securityPageSize, securityResult.count ?? 0)
    }
  };
}

export async function getOrganizationApprovalInboxData(input: Partial<OrganizationApprovalInboxFilters> = {}): Promise<OrganizationApprovalInboxData> {
  const supabase = await createSupabaseServerClient();
  const filters = normalizeApprovalInboxFilters(input);
  let query = (supabase as unknown as OrganizationApprovalInboxClient)
    .from("organization_approval_requests")
    .select("*", { count: "exact" });

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.action !== "all") {
    query = query.eq("action", filters.action);
  }

  const approvalSearch = await buildApprovalInboxSearchFilter(supabase, filters.query);
  if (approvalSearch) {
    query = query.or(approvalSearch);
  }

  const rangeFrom = (filters.page - 1) * filters.pageSize;
  const rangeTo = rangeFrom + filters.pageSize - 1;
  const { data, error, count } = await query
    .order("requested_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (error) {
    throw new Error(error.message);
  }

  const approvals = data ?? [];
  const orgIds = Array.from(new Set(approvals.map((approval) => approval.organization_id)));
  const actorIds = Array.from(new Set(
    approvals
      .flatMap((approval) => [approval.requested_by, approval.reviewed_by])
      .filter((id): id is string => Boolean(id))
  ));
  const [organizationsResult, actorProfiles] = await Promise.all([
    orgIds.length > 0
      ? supabase.from("organizations").select("id, name, slug, status").in("id", orgIds)
      : Promise.resolve({ data: [] as Array<Pick<OrganizationRow, "id" | "name" | "slug" | "status">>, error: null }),
    getProfilesById(supabase as unknown as OrganizationManagementSupplementClient, actorIds)
  ]);

  if (organizationsResult.error) {
    throw new Error(organizationsResult.error.message);
  }

  const organizationById = new Map((organizationsResult.data ?? []).map((organization) => [organization.id, organization]));
  const actorById = new Map(actorProfiles.map((profile) => [profile.id, profileToOwnerCandidate(profile)]));
  const mappedApprovals = approvals
    .map((approval) => toApprovalRequest(approval, actorById, new Map(), organizationById.get(approval.organization_id) ?? null))
    .filter((approval) => approvalMatchesInboxSearch(approval, filters.query));

  const statusSummary = await getApprovalStatusSummary(supabase as unknown as OrganizationApprovalInboxClient);

  return {
    approvals: mappedApprovals,
    filters,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: count ?? mappedApprovals.length,
      totalPages: Math.max(1, Math.ceil((count ?? mappedApprovals.length) / filters.pageSize)),
      from: (count ?? mappedApprovals.length) === 0 ? 0 : rangeFrom + 1,
      to: Math.min(rangeTo + 1, count ?? mappedApprovals.length)
    },
    summary: statusSummary
  };
}

export function normalizeOrganizationFilters(input: Partial<OrganizationManagementFilters>, maxPageSize = 50): OrganizationManagementFilters {
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? defaultFilters.pageSize) || defaultFilters.pageSize, 6), maxPageSize);
  const page = Math.max(Number(input.page ?? defaultFilters.page) || defaultFilters.page, 1);
  const sort = organizationSortOptions.includes(input.sort ?? defaultFilters.sort) ? input.sort ?? defaultFilters.sort : defaultFilters.sort;

  return {
    query: String(input.query ?? defaultFilters.query).trim().slice(0, 120),
    status: String(input.status ?? defaultFilters.status).trim() || "all",
    sort,
    page,
    pageSize
  };
}

export function normalizeAuditFilters(input: Partial<OrganizationDetailAuditFilters>): OrganizationDetailAuditFilters {
  return {
    query: String(input.query ?? "").trim().slice(0, 120),
    severity: String(input.severity ?? "all").trim() || "all",
    source: String(input.source ?? "all").trim() || "all"
  };
}

export function normalizeDetailListFilters(input: Partial<OrganizationDetailListFilters>, maxPageSize = 100): OrganizationDetailListFilters {
  return {
    gymsPage: normalizePage(input.gymsPage),
    gymsPageSize: normalizePageSize(input.gymsPageSize, defaultDetailListFilters.gymsPageSize, maxPageSize),
    branchesPage: normalizePage(input.branchesPage),
    branchesPageSize: normalizePageSize(input.branchesPageSize, defaultDetailListFilters.branchesPageSize, maxPageSize),
    usersPage: normalizePage(input.usersPage),
    usersPageSize: normalizePageSize(input.usersPageSize, defaultDetailListFilters.usersPageSize, maxPageSize),
    domainsPage: normalizePage(input.domainsPage),
    domainsPageSize: normalizePageSize(input.domainsPageSize, defaultDetailListFilters.domainsPageSize, maxPageSize),
    securityPage: normalizePage(input.securityPage),
    securityPageSize: normalizePageSize(input.securityPageSize, defaultDetailListFilters.securityPageSize, maxPageSize)
  };
}

export function normalizeApprovalInboxFilters(input: Partial<OrganizationApprovalInboxFilters>, maxPageSize = 100): OrganizationApprovalInboxFilters {
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? defaultApprovalInboxFilters.pageSize) || defaultApprovalInboxFilters.pageSize, 10), maxPageSize);
  const page = Math.max(Number(input.page ?? defaultApprovalInboxFilters.page) || defaultApprovalInboxFilters.page, 1);

  return {
    query: String(input.query ?? defaultApprovalInboxFilters.query).trim().slice(0, 120),
    status: String(input.status ?? defaultApprovalInboxFilters.status).trim() || "all",
    action: String(input.action ?? defaultApprovalInboxFilters.action).trim() || "all",
    page,
    pageSize
  };
}

async function queryOrganizationPage(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, filters: OrganizationManagementFilters) {
  let query = supabase
    .from("organizations")
    .select("*", { count: "exact" });

  if (filters.status !== "all") {
    query = query.eq("status", filters.status as OrganizationRow["status"]);
  }

  const safeQuery = sanitizeSearch(filters.query);
  if (safeQuery) {
    query = query.or([
      `name.ilike.%${safeQuery}%`,
      `slug.ilike.%${safeQuery}%`,
      `billing_email.ilike.%${safeQuery}%`,
      `primary_domain.ilike.%${safeQuery}%`
    ].join(","));
  }

  const rangeFrom = (filters.page - 1) * filters.pageSize;
  const rangeTo = rangeFrom + filters.pageSize - 1;
  const dbSort = dbSortFor(filters.sort);
  const { data, error, count } = await query
    .order(dbSort.column, { ascending: dbSort.ascending })
    .range(rangeFrom, rangeTo);

  if (error) {
    throw new Error(error.message);
  }

  return {
    organizations: data ?? [],
    total: count ?? 0
  };
}

async function queryAllOrganizationsForSummary(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, filters: OrganizationManagementFilters) {
  const batchSize = 1000;
  const organizations: OrganizationRow[] = [];
  let page = 0;

  while (true) {
    let query = supabase
      .from("organizations")
      .select("*");

    if (filters.status !== "all") {
      query = query.eq("status", filters.status as OrganizationRow["status"]);
    }

    const safeQuery = sanitizeSearch(filters.query);
    if (safeQuery) {
      query = query.or([
        `name.ilike.%${safeQuery}%`,
        `slug.ilike.%${safeQuery}%`,
        `billing_email.ilike.%${safeQuery}%`,
        `primary_domain.ilike.%${safeQuery}%`
      ].join(","));
    }

    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    organizations.push(...rows);

    if (rows.length < batchSize) {
      break;
    }

    page += 1;
  }

  return organizations;
}

async function buildOrganizationRecords({
  supabase,
  organizations,
  packages,
  ownerCandidates,
  auditFilters,
  auditLimit
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizations: OrganizationRow[];
  packages: PackageRow[];
  ownerCandidates: OrganizationOwnerCandidate[];
  auditFilters: OrganizationDetailAuditFilters;
  auditLimit: number;
}): Promise<OrganizationManagementRecord[]> {
  const organizationIds = organizations.map((organization) => organization.id);
  if (organizationIds.length === 0) {
    return [];
  }

  const [
    gymsResult,
    branchesResult,
    branchUsersResult,
    domainsResult,
    metricsResult,
    subscriptionsResult,
    activityResult,
    auditResult,
    securityResult,
    approvalsResult
  ] = await Promise.all([
    supabase.from("gyms").select("*").in("organization_id", organizationIds).limit(10000),
    supabase.from("branches").select("*").in("organization_id", organizationIds).limit(10000),
    supabase.from("branch_users").select("*").in("organization_id", organizationIds).limit(20000),
    supabase.from("tenant_domains").select("*").in("organization_id", organizationIds).limit(5000),
    supabase.from("enterprise_branch_metrics_latest").select("*").in("organization_id", organizationIds).limit(10000),
    (supabase as unknown as OrganizationManagementSupplementClient)
      .from("organization_subscriptions")
      .select(ORGANIZATION_SUBSCRIPTION_SELECT)
      .in("organization_id", organizationIds),
    supabase
      .from("activity_events")
      .select("*")
      .in("organization_id", organizationIds)
      .order("created_at", { ascending: false })
      .limit(1200),
    supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at")
      .eq("entity_type", "organization")
      .in("entity_id", organizationIds)
      .order("created_at", { ascending: false })
      .limit(1200),
    supabase
      .from("security_events")
      .select("*")
      .in("organization_id", organizationIds)
      .order("created_at", { ascending: false })
      .limit(1200),
    (supabase as unknown as OrganizationManagementSupplementClient)
      .from("organization_approval_requests")
      .select("*")
      .in("organization_id", organizationIds)
      .order("requested_at", { ascending: false })
      .limit(1200)
  ]);

  for (const result of [gymsResult, branchesResult, branchUsersResult, domainsResult, metricsResult, activityResult, auditResult, securityResult, approvalsResult]) {
    if (result.error) {
      console.error("[super-admin-organizations] Supplemental query failed.", result.error.message);
    }
  }

  if (subscriptionsResult.error) {
    console.error("[super-admin-organizations] Organization subscription query failed.", subscriptionsResult.error.message);
  }

  const gyms = gymsResult.data ?? [];
  const gymIds = gyms.map((gym) => gym.id);
  const [membersResult, paymentsResult] = gymIds.length > 0
    ? await Promise.all([
      supabase.from("members").select("id, gym_id, status").in("gym_id", gymIds).limit(50000),
      supabase.from("payments").select("id, gym_id, status, amount, currency, payment_number, created_at, method, provider").in("gym_id", gymIds).limit(50000)
    ])
    : [
      { data: [] as MemberRow[], error: null },
      { data: [] as PaymentRow[], error: null }
    ];

  for (const result of [membersResult, paymentsResult]) {
    if (result.error) {
      console.error("[super-admin-organizations] Financial/member query failed.", result.error.message);
    }
  }

  const rawTimelineByOrg = buildActivityTimelineByOrganization(
    activityResult.data ?? [],
    auditResult.data ?? [],
    auditFilters
  );
  const approvalRows = approvalsResult.data ?? [];
  const actorIds = Array.from(new Set([
    ...Array.from(rawTimelineByOrg.values()).flat().map((event) => event.actorId).filter((id): id is string => Boolean(id)),
    ...approvalRows.flatMap((approval) => [approval.requested_by, approval.reviewed_by]).filter((id): id is string => Boolean(id))
  ]));
  const actorProfiles = await getProfilesById(supabase as unknown as OrganizationManagementSupplementClient, actorIds);
  const actorById = new Map(actorProfiles.map((profile) => [profile.id, profileToOwnerCandidate(profile)]));
  const ownerById = new Map(ownerCandidates.map((owner) => [owner.id, owner]));
  const subscriptionsByOrg = new Map((subscriptionsResult.data ?? []).map((subscription) => [subscription.organization_id, subscription]));
  const packageById = new Map(packages.map((packageRow) => [packageRow.id, packageRow]));
  const gymToOrganization = new Map(gyms.filter((gym) => Boolean(gym.organization_id)).map((gym) => [gym.id, gym.organization_id as string]));
  const usageByOrg = buildUsageByOrganization({
    organizations,
    gyms,
    branches: branchesResult.data ?? [],
    branchUsers: branchUsersResult.data ?? [],
    domains: domainsResult.data ?? [],
    metrics: metricsResult.data ?? [],
    securityEvents: securityResult.data ?? [],
    members: membersResult.data ?? [],
    payments: paymentsResult.data ?? [],
    gymToOrganization
  });
  const approvalsByOrg = buildApprovalRequestsByOrganization(approvalRows, actorById, ownerById);

  return organizations.map((organization) => {
    const subscriptionSummary = subscriptionsByOrg.get(organization.id) ?? null;
    const packageRow = subscriptionSummary?.package_id ? packageById.get(subscriptionSummary.package_id) ?? null : null;
    const usage = usageByOrg.get(organization.id) ?? emptyUsage();
    const timeline = (rawTimelineByOrg.get(organization.id) ?? []).slice(0, auditLimit).map((event) => {
      const actor = event.actorId ? actorById.get(event.actorId) ?? ownerById.get(event.actorId) ?? null : null;
      return {
        ...event,
        actorName: actor?.fullName ?? null,
        actorEmail: actor?.email ?? null
      };
    });
    const subscription = toSubscriptionDetails(subscriptionSummary, packageRow);
    const approvalRequests = approvalsByOrg.get(organization.id) ?? [];
    const softDelete = getOrganizationSoftDeleteState(organization.settings);
    const legalHold = getOrganizationLegalHoldState(organization.settings);
    const operationalPurgeBlockers = buildOperationalPurgeBlockers(usage);
    const purgeEligibility = getOrganizationPurgeEligibility({
      status: organization.status,
      softDelete,
      legalHold,
      operationalBlockers: operationalPurgeBlockers
    });

    return {
      organization,
      owner: organization.owner_user_id ? ownerById.get(organization.owner_user_id) ?? null : null,
      usage,
      subscription,
      auditTimeline: timeline,
      deletionProtection: buildDeletionProtection(usage, timeline.length),
      health: buildOrganizationHealth(organization, usage, subscription),
      tags: organizationTags(organization.settings),
      approvalRequests,
      pendingApprovalCount: approvalRequests.filter((approval) => approval.status === "pending").length,
      softDelete: {
        ...softDelete,
        restoreAvailable: organization.status === "archived" && isRestoreWindowOpen(softDelete.restoreUntil)
      },
      legalHold,
      purgeEligibility
    };
  });
}

function buildApprovalRequestsByOrganization(
  approvals: OrganizationApprovalRequestRow[],
  actorById: Map<string, OrganizationOwnerCandidate>,
  ownerById: Map<string, OrganizationOwnerCandidate>
) {
  const byOrg = new Map<string, OrganizationApprovalRequest[]>();

  for (const approval of approvals) {
    const existing = byOrg.get(approval.organization_id) ?? [];
    existing.push(toApprovalRequest(approval, actorById, ownerById));
    byOrg.set(approval.organization_id, existing);
  }

  return byOrg;
}

function toApprovalRequest(
  approval: OrganizationApprovalRequestRow,
  actorById: Map<string, OrganizationOwnerCandidate>,
  ownerById: Map<string, OrganizationOwnerCandidate>,
  organization?: Pick<OrganizationRow, "id" | "name" | "slug" | "status"> | null
): OrganizationApprovalRequest {
  const beforeSnapshot = snapshotFromJson(approval.before_snapshot);
  const afterSnapshot = snapshotFromJson(approval.after_snapshot);
  const requestedBy = approval.requested_by
    ? actorById.get(approval.requested_by) ?? ownerById.get(approval.requested_by) ?? null
    : null;
  const reviewedBy = approval.reviewed_by
    ? actorById.get(approval.reviewed_by) ?? ownerById.get(approval.reviewed_by) ?? null
    : null;

  return {
    id: approval.id,
    organizationId: approval.organization_id,
    organizationName: organization?.name ?? null,
    organizationSlug: organization?.slug ?? null,
    organizationStatus: organization?.status ?? null,
    action: approval.action,
    status: approval.status,
    requestedBy: approval.requested_by,
    requestedByName: requestedBy?.fullName ?? requestedBy?.email ?? null,
    reviewedBy: approval.reviewed_by,
    reviewedByName: reviewedBy?.fullName ?? reviewedBy?.email ?? null,
    targetUserId: approval.target_user_id,
    reason: approval.reason,
    reviewNote: approval.review_note,
    requestedAt: approval.requested_at,
    reviewedAt: approval.reviewed_at,
    expiresAt: approval.expires_at,
    diff: beforeSnapshot && afterSnapshot ? buildOrganizationDiff(beforeSnapshot, afterSnapshot) : []
  };
}

function buildUsageByOrganization(input: {
  organizations: OrganizationRow[];
  gyms: GymRow[];
  branches: BranchRow[];
  branchUsers: BranchUserRow[];
  domains: TenantDomainRow[];
  metrics: Database["public"]["Views"]["enterprise_branch_metrics_latest"]["Row"][];
  securityEvents: SecurityEventRow[];
  members: MemberRow[];
  payments: PaymentRow[];
  gymToOrganization: Map<string, string>;
}) {
  const usage = new Map<string, OrganizationUsageSummary>();

  for (const organization of input.organizations) {
    usage.set(organization.id, emptyUsage());
  }

  for (const gym of input.gyms) {
    if (!gym.organization_id) {
      continue;
    }
    ensureUsage(usage, gym.organization_id).gyms += 1;
  }

  for (const branch of input.branches) {
    const summary = ensureUsage(usage, branch.organization_id);
    summary.branches += 1;
    if (branch.status === "active") {
      summary.activeBranches += 1;
    }
  }

  for (const user of input.branchUsers) {
    const summary = ensureUsage(usage, user.organization_id);
    if (user.role_name === "trainer") {
      summary.trainers += 1;
    } else if (user.role_name !== "member") {
      summary.staff += 1;
    }
  }

  for (const member of input.members) {
    const organizationId = member.gym_id ? input.gymToOrganization.get(member.gym_id) : null;
    if (!organizationId) {
      continue;
    }
    const summary = ensureUsage(usage, organizationId);
    summary.members += 1;
    if (member.status === "active") {
      summary.activeMembers += 1;
    }
  }

  for (const payment of input.payments) {
    const organizationId = payment.gym_id ? input.gymToOrganization.get(payment.gym_id) : null;
    if (!organizationId) {
      continue;
    }
    const summary = ensureUsage(usage, organizationId);
    summary.payments += 1;
    if (payment.status === "paid" || payment.status === "partially_refunded") {
      summary.revenue += Number(payment.amount ?? 0);
    }
  }

  for (const domain of input.domains) {
    const summary = ensureUsage(usage, domain.organization_id);
    if (domain.status !== "disabled") {
      summary.domains += 1;
    }
  }

  for (const metric of input.metrics) {
    const organizationId = metric.organization_id;
    if (!organizationId) {
      continue;
    }
    ensureUsage(usage, organizationId).storageMb += Number(metric.storage_mb ?? 0);
  }

  for (const event of input.securityEvents) {
    if (!event.organization_id || (event.status !== "open" && event.status !== "investigating")) {
      continue;
    }
    const summary = ensureUsage(usage, event.organization_id);
    summary.openSecurityEvents += 1;
    if (event.severity === "critical") {
      summary.criticalSecurityEvents += 1;
    }
  }

  return usage;
}

function buildActivityTimelineByOrganization(
  activityEvents: ActivityEventRow[],
  auditLogs: AuditLogRow[],
  filters: OrganizationDetailAuditFilters
) {
  const timeline = new Map<string, OrganizationAuditTimelineItem[]>();

  for (const event of activityEvents) {
    if (!event.organization_id && !(event.entity_type === "organization" && event.entity_id)) {
      continue;
    }
    const organizationId = event.organization_id ?? event.entity_id;
    if (!organizationId) {
      continue;
    }
    pushTimeline(timeline, organizationId, {
      id: event.id,
      action: event.event_type,
      actorId: event.actor_id,
      actorName: null,
      actorEmail: null,
      severity: auditTimelineSeverity(event.severity),
      entityType: event.entity_type,
      entityId: event.entity_id,
      createdAt: event.created_at,
      metadata: normalizeJson(event.metadata),
      ipAddress: asNullableString(event.ip_address),
      userAgent: asNullableString(event.user_agent),
      source: "activity_events"
    });
  }

  for (const log of auditLogs) {
    if (!log.entity_id) {
      continue;
    }
    pushTimeline(timeline, log.entity_id, {
      id: log.id,
      action: log.action,
      actorId: log.actor_id,
      actorName: null,
      actorEmail: null,
      severity: severityFromAction(log.action),
      entityType: log.entity_type,
      entityId: log.entity_id,
      createdAt: log.created_at,
      metadata: normalizeJson(log.metadata),
      ipAddress: asNullableString(log.ip_address),
      userAgent: asNullableString(log.user_agent),
      source: "audit_logs"
    });
  }

  for (const [organizationId, items] of timeline.entries()) {
    timeline.set(
      organizationId,
      items
        .filter((item) => auditItemMatchesFilters(item, filters))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    );
  }

  return timeline;
}

function auditItemMatchesFilters(item: OrganizationAuditTimelineItem, filters: OrganizationDetailAuditFilters) {
  const matchesSeverity = filters.severity === "all" || item.severity === filters.severity;
  const matchesSource = filters.source === "all" || item.source === filters.source;
  const query = filters.query.toLowerCase();
  const matchesQuery = !query || [
    item.action,
    item.entityType,
    item.entityId,
    item.actorId,
    item.ipAddress,
    item.userAgent,
    JSON.stringify(item.metadata)
  ].filter(Boolean).join(" ").toLowerCase().includes(query);

  return matchesSeverity && matchesSource && matchesQuery;
}

function buildDeletionProtection(usage: OrganizationUsageSummary, auditEvents: number): OrganizationDeletionProtection {
  const reasons = [
    usage.gyms > 0 ? `${usage.gyms} gym records` : null,
    usage.branches > 0 ? `${usage.branches} branch records` : null,
    usage.members > 0 ? `${usage.members} member records` : null,
    usage.payments > 0 ? `${usage.payments} payment records` : null,
    usage.domains > 0 ? `${usage.domains} active domains` : null,
    auditEvents > 0 ? `${auditEvents} audit events` : null
  ].filter((reason): reason is string => Boolean(reason));

  return {
    canDelete: reasons.length === 0,
    reasons
  };
}

function buildOperationalPurgeBlockers(usage: OrganizationUsageSummary) {
  return [
    usage.gyms > 0 ? `${usage.gyms} gym records remain` : null,
    usage.branches > 0 ? `${usage.branches} branch records remain` : null,
    usage.staff > 0 ? `${usage.staff} staff assignments remain` : null,
    usage.trainers > 0 ? `${usage.trainers} trainer assignments remain` : null,
    usage.members > 0 ? `${usage.members} member records remain` : null,
    usage.payments > 0 ? `${usage.payments} payment records remain` : null,
    usage.domains > 0 ? `${usage.domains} active domains remain` : null
  ].filter((reason): reason is string => Boolean(reason));
}

function buildOrganizationHealth(organization: OrganizationRow, usage: OrganizationUsageSummary, subscription: OrganizationSubscriptionDetails): OrganizationHealthScore {
  let score = 100;
  const factors: string[] = [];

  if (organization.status === "suspended" || organization.status === "deactivated") {
    score -= 35;
    factors.push("Tenant lifecycle is restricted.");
  } else if (organization.status === "archived") {
    score -= 45;
    factors.push("Tenant is archived.");
  } else if (organization.status === "trial") {
    score -= 5;
    factors.push("Tenant is still in trial.");
  }

  if (!organization.owner_user_id) {
    score -= 15;
    factors.push("No organization owner assigned.");
  }

  if (!organization.billing_email) {
    score -= 6;
    factors.push("Billing email is missing.");
  }

  if (!organization.primary_domain) {
    score -= 4;
    factors.push("Primary domain is not configured.");
  }

  if (!subscription.subscriptionId) {
    score -= 22;
    factors.push("No SaaS package is assigned.");
  } else if (subscription.status === "expired" || subscription.status === "suspended" || subscription.status === "cancelled") {
    score -= 30;
    factors.push(`Subscription status is ${subscription.status}.`);
  } else if (subscription.status === "trial") {
    score -= 6;
    factors.push("Subscription is trialing.");
  }

  const memberUsage = limitPercent(usage.activeMembers, subscription.maxMembers);
  if (memberUsage >= 90) {
    score -= 14;
    factors.push("Member limit is above 90%.");
  } else if (memberUsage >= 75) {
    score -= 7;
    factors.push("Member limit is above 75%.");
  }

  const branchUsage = limitPercent(usage.branches, subscription.maxBranches);
  if (branchUsage >= 90) {
    score -= 12;
    factors.push("Branch limit is above 90%.");
  } else if (branchUsage >= 75) {
    score -= 6;
    factors.push("Branch limit is above 75%.");
  }

  if (usage.criticalSecurityEvents > 0) {
    score -= 20;
    factors.push(`${usage.criticalSecurityEvents} critical security event(s) are open.`);
  } else if (usage.openSecurityEvents > 0) {
    score -= 10;
    factors.push(`${usage.openSecurityEvents} security event(s) need review.`);
  }

  if (usage.activeMembers > 0 && usage.payments === 0) {
    score -= 8;
    factors.push("Active members exist but no payments were found.");
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const status = bounded < 60 ? "risk" : bounded < 80 ? "watch" : "good";

  return {
    score: bounded,
    status,
    label: status === "good" ? "Healthy" : status === "watch" ? "Watch" : "Risk",
    factors: factors.length > 0 ? factors : ["No material risk signals detected."]
  };
}

async function getApprovalStatusSummary(client: OrganizationApprovalInboxClient): Promise<OrganizationApprovalInboxData["summary"]> {
  const statuses = await Promise.all([
    countApprovalsByStatus(client, "pending"),
    countApprovalsByStatus(client, "expired"),
    Promise.all([
      countApprovalsByStatus(client, "approved"),
      countApprovalsByStatus(client, "rejected"),
      countApprovalsByStatus(client, "cancelled")
    ]).then((counts) => counts.reduce((total, count) => total + count, 0))
  ]);

  return {
    pending: statuses[0],
    expired: statuses[1],
    reviewed: statuses[2]
  };
}

async function buildApprovalInboxSearchFilter(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, query: string) {
  const safeQuery = sanitizeSearch(query);
  if (!safeQuery) {
    return "";
  }

  const [organizationsResult, profilesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id")
      .or([
        `name.ilike.%${safeQuery}%`,
        `slug.ilike.%${safeQuery}%`,
        `status.ilike.%${safeQuery}%`
      ].join(","))
      .limit(2000),
    supabase
      .from("profiles")
      .select("id")
      .or([
        `full_name.ilike.%${safeQuery}%`,
        `email.ilike.%${safeQuery}%`
      ].join(","))
      .limit(2000)
  ]);

  if (organizationsResult.error) {
    console.error("[super-admin-approvals] Approval organization search failed.", organizationsResult.error.message);
  }

  if (profilesResult.error) {
    console.error("[super-admin-approvals] Approval actor search failed.", profilesResult.error.message);
  }

  const organizationIds = (organizationsResult.data ?? []).map((organization) => organization.id);
  const actorIds = (profilesResult.data ?? []).map((profile) => profile.id);
  const filters = [
    `action.ilike.%${safeQuery}%`,
    `status.ilike.%${safeQuery}%`,
    `reason.ilike.%${safeQuery}%`,
    `review_note.ilike.%${safeQuery}%`
  ];

  if (organizationIds.length > 0) {
    filters.push(`organization_id.in.(${organizationIds.join(",")})`);
  }

  if (actorIds.length > 0) {
    filters.push(`requested_by.in.(${actorIds.join(",")})`);
    filters.push(`reviewed_by.in.(${actorIds.join(",")})`);
  }

  return filters.join(",");
}

async function countApprovalsByStatus(client: OrganizationApprovalInboxClient, status: OrganizationApprovalRequest["status"]) {
  const { count, error } = await client
    .from("organization_approval_requests")
    .select("id", { count: "exact" })
    .eq("status", status)
    .order("requested_at", { ascending: false })
    .range(0, 0);

  if (error) {
    console.error("[super-admin-approvals] Approval summary query failed.", error.message);
    return 0;
  }

  return count ?? 0;
}

function approvalMatchesInboxSearch(approval: OrganizationApprovalRequest, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    approval.organizationName,
    approval.organizationSlug,
    approval.organizationStatus,
    approval.action,
    approval.status,
    approval.requestedByName,
    approval.reviewedByName,
    approval.reason,
    approval.reviewNote
  ].filter(Boolean).join(" ").toLowerCase();

  return haystack.includes(query.toLowerCase());
}

async function buildGlobalManagementSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: OrganizationManagementFilters,
  packages: PackageRow[],
  ownerCandidates: OrganizationOwnerCandidate[]
): Promise<OrganizationManagementSummary> {
  const organizations = await queryAllOrganizationsForSummary(supabase, filters);
  const records: OrganizationManagementRecord[] = [];
  const batchSize = 100;

  for (let index = 0; index < organizations.length; index += batchSize) {
    const batch = organizations.slice(index, index + batchSize);
    const batchRecords = await buildOrganizationRecords({
      supabase,
      organizations: batch,
      packages,
      ownerCandidates,
      auditFilters: { query: "", severity: "all", source: "all" },
      auditLimit: 0
    });
    records.push(...batchRecords);
  }

  return buildManagementSummary(records, organizations.length);
}

function buildManagementSummary(records: OrganizationManagementRecord[], totalOrganizations: number): OrganizationManagementSummary {
  const healthScores = records.map((record) => record.health.score);

  return {
    totalOrganizations,
    activeOrganizations: records.filter((record) => record.organization.status === "active" || record.organization.status === "trial").length,
    suspendedOrganizations: records.filter((record) => record.organization.status === "suspended" || record.organization.status === "deactivated" || record.organization.status === "archived").length,
    unassignedPlans: records.filter((record) => !record.subscription.subscriptionId).length,
    protectedDeletes: records.filter((record) => !record.deletionProtection.canDelete).length,
    pendingApprovals: records.reduce((total, record) => total + record.pendingApprovalCount, 0),
    averageHealthScore: healthScores.length > 0 ? Math.round(healthScores.reduce((total, score) => total + score, 0) / healthScores.length) : 0
  };
}

function normalizePage(value: number | undefined) {
  return Math.max(Number(value ?? 1) || 1, 1);
}

function normalizePageSize(value: number | undefined, fallback: number, maxPageSize: number) {
  return Math.min(Math.max(Number(value ?? fallback) || fallback, 10), maxPageSize);
}

function paginationRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return {
    from,
    to: from + pageSize - 1
  };
}

function buildPagination(page: number, pageSize: number, total: number): OrganizationManagementPagination {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total)
  };
}

function toSubscriptionDetails(subscription: OrganizationSubscriptionSummaryRow | OrgSubscriptionSummary | null, packageRow: PackageRow | null): OrganizationSubscriptionDetails {
  const normalized = normalizeSubscription(subscription);

  return {
    subscriptionId: normalized?.subscriptionId ?? null,
    packageId: normalized?.packageId ?? null,
    packageName: packageRow?.name ?? normalized?.packageName ?? null,
    status: normalized?.status ?? null,
    startedAt: normalized?.startedAt ?? null,
    expiresAt: normalized?.expiresAt ?? null,
    trialEndsAt: normalized?.trialEndsAt ?? null,
    billingPeriod: (subscription as { billing_period?: string | null } | null)?.billing_period ?? null,
    billingEngine: (subscription as { billing_engine?: string | null } | null)?.billing_engine ?? null,
    providerSubscriptionId: (subscription as { provider_subscription_id?: string | null } | null)?.provider_subscription_id ?? null,
    latestInvoiceId: (subscription as { latest_invoice_id?: string | null } | null)?.latest_invoice_id ?? null,
    latestPaymentId: (subscription as { latest_payment_id?: string | null } | null)?.latest_payment_id ?? null,
    nextBillingDate: (subscription as { next_billing_date?: string | null } | null)?.next_billing_date ?? null,
    dunningAttempts: (subscription as { dunning_attempts?: number | null } | null)?.dunning_attempts ?? null,
    dunningStatus: (subscription as { dunning_status?: string | null } | null)?.dunning_status ?? null,
    dunningNextRetry: (subscription as { dunning_next_retry?: string | null } | null)?.dunning_next_retry ?? null,
    maxMembers: packageRow?.max_members ?? null,
    maxBranches: packageRow?.max_branches ?? null,
    enabledFeatures: packageRow ? [
      packageRow.qr_attendance_enabled,
      packageRow.biometric_attendance_enabled,
      packageRow.rfid_attendance_enabled,
      packageRow.class_scheduling_enabled,
      packageRow.trainer_assignment_enabled,
      packageRow.razorpay_enabled,
      packageRow.communications_enabled,
      packageRow.ai_enabled,
      packageRow.advanced_reports_enabled,
      packageRow.custom_domain_enabled,
      packageRow.api_access_enabled
    ].filter(Boolean).length : 0
  };
}

function normalizeSubscription(subscription: OrganizationSubscriptionSummaryRow | OrgSubscriptionSummary | null) {
  if (!subscription) {
    return null;
  }

  if ("organization_id" in subscription) {
    return {
      subscriptionId: subscription.id,
      packageId: subscription.package_id,
      packageName: null,
      status: subscription.status,
      startedAt: subscription.started_at,
      expiresAt: subscription.expires_at,
      trialEndsAt: subscription.trial_ends_at
    };
  }

  return {
    subscriptionId: subscription.subscriptionId,
    packageId: subscription.packageId,
    packageName: subscription.packageName,
    status: subscription.status,
    startedAt: subscription.startedAt,
    expiresAt: subscription.expiresAt,
    trialEndsAt: subscription.trialEndsAt
  };
}

async function getOwnerCandidates(client: OrganizationManagementSupplementClient) {
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, email, phone, status")
    .in("status", ["active", "invited"])
    .order("full_name", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("[super-admin-organizations] Owner candidate query failed.", error.message);
    return [];
  }

  const profiles = data ?? [];
  const userIds = profiles.map((p) => p.id);
  const lastLoginByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const supabase = await createSupabaseServerClient();
    const { data: loginData } = await supabase
      .from("login_history")
      .select("user_id, created_at")
      .in("user_id", userIds)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(2000);
    for (const entry of loginData ?? []) {
      if (!lastLoginByUser.has(entry.user_id)) {
        lastLoginByUser.set(entry.user_id, entry.created_at);
      }
    }
  }

  return profiles.map((profile) => ({
    ...profileToOwnerCandidate(profile),
    lastLoginAt: lastLoginByUser.get(profile.id) ?? null
  }));
}

async function getProfilesById(client: OrganizationManagementSupplementClient, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 2000);
  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, email, phone, status")
    .in("id", uniqueIds)
    .limit(2000);

  if (error) {
    console.error("[super-admin-organizations] Actor profile query failed.", error.message);
    return [];
  }

  return data ?? [];
}

async function getRecentPaymentsForGyms(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, gymIds: string[]) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, gym_id, status, amount, currency, payment_number, created_at, method, provider")
    .in("gym_id", gymIds)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("[super-admin-organizations] Recent payment query failed.", error.message);
    return [];
  }

  return data ?? [];
}

function sortRecords(records: OrganizationManagementRecord[], sort: OrganizationSortOption) {
  if (sort === "health_asc") {
    return [...records].sort((left, right) => left.health.score - right.health.score);
  }

  if (sort === "revenue_desc") {
    return [...records].sort((left, right) => right.usage.revenue - left.usage.revenue);
  }

  if (sort === "members_desc") {
    return [...records].sort((left, right) => right.usage.activeMembers - left.usage.activeMembers);
  }

  return records;
}

function dbSortFor(sort: OrganizationSortOption) {
  if (sort === "name_asc") {
    return { column: "name" as const, ascending: true };
  }

  return { column: "created_at" as const, ascending: false };
}

function ensureUsage(usage: Map<string, OrganizationUsageSummary>, organizationId: string) {
  const existing = usage.get(organizationId);
  if (existing) {
    return existing;
  }
  const next = emptyUsage();
  usage.set(organizationId, next);
  return next;
}

function emptyUsage(): OrganizationUsageSummary {
  return {
    gyms: 0,
    branches: 0,
    activeBranches: 0,
    staff: 0,
    trainers: 0,
    members: 0,
    activeMembers: 0,
    payments: 0,
    revenue: 0,
    domains: 0,
    storageMb: 0,
    openSecurityEvents: 0,
    criticalSecurityEvents: 0
  };
}

function profileToOwnerCandidate(profile: ProfileRow): OrganizationOwnerCandidate {
  return {
    id: profile.id,
    fullName: profile.full_name || profile.email || profile.id,
    email: profile.email,
    phone: profile.phone,
    status: profile.status,
    lastLoginAt: null
  };
}

function pushTimeline(timeline: Map<string, OrganizationAuditTimelineItem[]>, organizationId: string, item: OrganizationAuditTimelineItem) {
  const existing = timeline.get(organizationId) ?? [];
  existing.push(item);
  timeline.set(organizationId, existing);
}

function auditTimelineSeverity(severity: string | null): OrganizationAuditTimelineItem["severity"] {
  if (severity === "critical") {
    return "critical";
  }
  if (severity === "warning" || severity === "high" || severity === "medium") {
    return "warning";
  }
  if (severity === "notice") {
    return "notice";
  }
  return "info";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function severityFromAction(action: string): OrganizationAuditTimelineItem["severity"] {
  if (/delete|suspend|critical|revoke/i.test(action)) {
    return "critical";
  }
  if (/transfer|activate|restore|update|bulk/i.test(action)) {
    return "notice";
  }
  return "info";
}

function normalizeJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    typeof value === "object"
  ) {
    return value as Json;
  }
  return null;
}

function limitPercent(used: number, limit: number | null) {
  if (limit === null || limit === -1 || limit <= 0) {
    return 0;
  }

  return Math.round((used / limit) * 10000) / 100;
}

function organizationTags(settings: Json) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return [];
  }

  const root = settings as Record<string, Json | undefined>;
  const tags = root.enterpriseTags;
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.filter((tag): tag is string => typeof tag === "string").slice(0, 12);
}

function sanitizeSearch(value: string) {
  return value.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

function snapshotFromJson(value: Json): OrganizationGovernanceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Json | undefined>;
  const id = stringValue(record.id);
  const name = stringValue(record.name);
  const slug = stringValue(record.slug);
  const status = stringValue(record.status);
  const organizationType = stringValue(record.organizationType);

  if (!id || !name || !slug || !status) {
    return null;
  }

  return {
    id,
    name,
    slug,
    status,
    organizationType: organizationType || "subscription_based",
    primaryDomain: nullableStringValue(record.primaryDomain),
    billingEmail: nullableStringValue(record.billingEmail),
    ownerUserId: nullableStringValue(record.ownerUserId),
    governance: record.governance ?? null
  };
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}
