import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { BranchRow, BranchSettingRow, BranchUserRow, GymRow, OrganizationRow, TenantDomainRow } from "@/types/enterprise";

export type GymBranchManagementSummary = {
  organizations: number;
  gyms: number;
  activeGyms: number;
  branches: number;
  activeBranches: number;
  branchesWithoutSettings: number;
  branchesWithoutAdmins: number;
  consistencyWarnings: number;
  pendingApprovals: number;
  unresolvedBranchRecords: number;
};

export type GymBranchAdminAssignment = BranchUserRow & {
  profile: GymBranchProfile | null;
};

export type GymBranchProfile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email" | "phone" | "status" | "gym_id">;

export type GymBranchMetrics = {
  activeMembers: number;
  payments: number;
  revenue: number;
  activeAttendanceSessions: number;
  unassignedMembers: number;
  unassignedPayments: number;
  unassignedAttendanceSessions: number;
};

export type GymBranchWarning = {
  severity: "warning" | "critical";
  scope: "gym" | "branch";
  entityId: string;
  title: string;
  detail: string;
};

export type GymBranchNode = {
  gym: GymRow;
  organization: Pick<OrganizationRow, "id" | "name" | "slug" | "status"> | null;
  branches: BranchNode[];
  admins: GymBranchAdminAssignment[];
  metrics: GymBranchMetrics;
  totalCapacity: number;
  warnings: GymBranchWarning[];
};

export type BranchNode = {
  branch: BranchRow;
  settings: BranchSettingRow | null;
  domains: TenantDomainRow[];
  admins: GymBranchAdminAssignment[];
  metrics: GymBranchMetrics;
  warnings: GymBranchWarning[];
};

export type GymBranchApprovalRequest = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  gymId: string | null;
  gymName: string | null;
  branchId: string | null;
  branchName: string | null;
  action: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  requestedBy: string | null;
  requestedByName: string | null;
  targetUserId: string | null;
  reason: string | null;
  requestedAt: string;
  expiresAt: string;
};

export type GymBranchAuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
  metadata: Database["public"]["Tables"]["audit_logs"]["Row"]["metadata"];
};

export type GymBranchManagementData = {
  summary: GymBranchManagementSummary;
  organizations: Array<Pick<OrganizationRow, "id" | "name" | "slug" | "status">>;
  gyms: GymBranchNode[];
  orphanBranches: BranchNode[];
  adminCandidates: GymBranchProfile[];
  approvalRequests: GymBranchApprovalRequest[];
  auditTimeline: GymBranchAuditItem[];
  filters: {
    query: string;
    organizationId: string;
    status: string;
    page: number;
    pageSize: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalGyms: number;
    totalPages: number;
  };
};

type MemberRow = Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "gym_id" | "branch_id" | "status">;
type PaymentRow = Pick<Database["public"]["Tables"]["payments"]["Row"], "id" | "gym_id" | "branch_id" | "status" | "amount">;
type AttendanceSessionRow = Pick<Database["public"]["Tables"]["attendance_sessions"]["Row"], "id" | "gym_id" | "branch_id" | "status">;
type AuditLogRow = Pick<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "action" | "entity_type" | "entity_id" | "actor_id" | "metadata" | "created_at">;
type GymBranchApprovalRow = {
  id: string;
  organization_id: string;
  gym_id: string | null;
  branch_id: string | null;
  action: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  requested_by: string | null;
  target_user_id: string | null;
  reason: string | null;
  requested_at: string;
  expires_at: string;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type QueryError = { message: string; code?: string };
type QueryResult<T> = { data: T[]; error: QueryError | null };
type GymBranchApprovalClient = SupabaseServerClient & {
  from(table: "gym_branch_approval_requests"): {
    select(columns: string): {
      eq(column: "status", value: string): {
        order(column: "requested_at", options: { ascending: boolean }): {
          limit(count: number): Promise<{ data: GymBranchApprovalRow[] | null; error: QueryError | null }>;
        };
      };
    };
  };
};

export async function getGymBranchManagementData(input: Partial<GymBranchManagementData["filters"]> = {}): Promise<GymBranchManagementData> {
  const supabase = await createSupabaseServerClient();
  const filters = normalizeGymBranchFilters(input);
  const organizationsResult = await supabase.from("organizations").select("id, name, slug, status").order("name", { ascending: true }).limit(5000);
  if (organizationsResult.error) {
    throw new Error(organizationsResult.error.message);
  }
  const organizations = organizationsResult.data ?? [];
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const query = filters.query.toLowerCase();
  const matchingOrganizationIds = query
    ? organizations
      .filter((organization) => `${organization.name} ${organization.slug}`.toLowerCase().includes(query))
      .map((organization) => organization.id)
    : [];
  const searchedBranches = query ? await searchBranchesForHierarchy(filters) : [];
  const branchMatchedGymIds = searchedBranches.map((branch) => branch.gym_id).filter((gymId): gymId is string => Boolean(gymId));
  const gymRangeStart = (filters.page - 1) * filters.pageSize;
  const gymRangeEnd = gymRangeStart + filters.pageSize - 1;

  let gymQuery = supabase.from("gyms").select("*", { count: "exact" });
  if (filters.organizationId !== "all") {
    gymQuery = gymQuery.eq("organization_id", filters.organizationId);
  }
  if (filters.status !== "all") {
    gymQuery = gymQuery.eq("status", filters.status as GymRow["status"]);
  }
  if (query) {
    const searchTerm = toPostgrestSearchTerm(query);
    const orParts = [
      searchTerm ? `name.ilike.%${searchTerm}%` : null,
      searchTerm ? `slug.ilike.%${searchTerm}%` : null,
      matchingOrganizationIds.length > 0 ? `organization_id.in.(${matchingOrganizationIds.join(",")})` : null,
      branchMatchedGymIds.length > 0 ? `id.in.(${unique(branchMatchedGymIds).join(",")})` : null
    ].filter((part): part is string => Boolean(part));
    if (orParts.length > 0) {
      gymQuery = gymQuery.or(orParts.join(","));
    }
  }

  const [gymsResult, profilesResult] = await Promise.all([
    gymQuery.order("created_at", { ascending: false }).range(gymRangeStart, gymRangeEnd),
    supabase.from("profiles").select("id, full_name, email, phone, status, gym_id").in("status", ["active", "invited"]).order("full_name", { ascending: true }).limit(5000)
  ]);

  if (gymsResult.error) {
    throw new Error(gymsResult.error.message);
  }
  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const gyms = gymsResult.data ?? [];
  const totalGyms = gymsResult.count ?? gyms.length;
  const visibleGymIds = new Set(gyms.map((gym) => gym.id));
  const profiles = profilesResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const branches = await getVisibleBranches(Array.from(visibleGymIds), filters);
  const branchIds = branches.map((branch) => branch.id);
  const gymIds = gyms.map((gym) => gym.id);
  const [
    settingsResult,
    branchUsersResult,
    domainsResult,
    membersResult,
    paymentsResult,
    attendanceResult,
    approvalRowsResult,
    auditRowsResult
  ] = await Promise.all([
    branchIds.length > 0 ? supabase.from("branch_settings").select("*").in("branch_id", branchIds).order("updated_at", { ascending: false }) : emptyResult<BranchSettingRow>(),
    branchIds.length > 0 ? supabase.from("branch_users").select("*").eq("role_name", "gym_admin").in("branch_id", branchIds).order("updated_at", { ascending: false }) : emptyResult<BranchUserRow>(),
    branchIds.length > 0 ? supabase.from("tenant_domains").select("*").in("branch_id", branchIds).order("updated_at", { ascending: false }) : emptyResult<TenantDomainRow>(),
    gymIds.length > 0 ? getMemberMetricRows(supabase, gymIds) : emptyResult<MemberRow>(),
    gymIds.length > 0 ? getPaymentMetricRows(supabase, gymIds) : emptyResult<PaymentRow>(),
    gymIds.length > 0 ? getAttendanceMetricRows(supabase, gymIds) : emptyResult<AttendanceSessionRow>(),
    getPendingGymBranchApprovalRows(supabase),
    getRecentGymBranchAuditRows(supabase)
  ]);

  const firstError = [settingsResult, branchUsersResult, domainsResult, membersResult, paymentsResult, attendanceResult, approvalRowsResult, auditRowsResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const settingsByBranch = new Map((settingsResult.data ?? []).map((settings) => [settings.branch_id, settings]));
  const domainsByBranch = groupBy(domainsResult.data ?? [], (domain) => domain.branch_id ?? "organization");
  const branchUsers = branchUsersResult.data ?? [];
  const adminsByBranch = groupBy(
    branchUsers.map((assignment) => ({ ...assignment, profile: profileById.get(assignment.user_id) ?? null })),
    (assignment) => assignment.branch_id
  );
  const metrics = buildOperationalMetrics(branches, membersResult.data ?? [], paymentsResult.data ?? [], attendanceResult.data ?? []);

  const branchNodes = branches.map((branch): BranchNode => {
    const settings = settingsByBranch.get(branch.id) ?? null;
    const admins = adminsByBranch.get(branch.id) ?? [];
    const branchMetrics = metrics.byBranch.get(branch.id) ?? emptyMetrics();
    return {
      branch,
      settings,
      domains: domainsByBranch.get(branch.id) ?? [],
      admins,
      metrics: branchMetrics,
      warnings: buildBranchWarnings(branch, settings, admins, branchMetrics, organizationById, visibleGymIds)
    };
  });
  const branchesByGym = groupBy(branchNodes.filter((node) => node.branch.gym_id), (node) => node.branch.gym_id as string);
  const orphanBranches = branchNodes.filter((node) => !node.branch.gym_id);
  const gymNodes = gyms.map((gym): GymBranchNode => {
    const gymBranches = branchesByGym.get(gym.id) ?? [];
    const admins = uniqueAssignments(gymBranches.flatMap((branch) => branch.admins));
    const gymMetrics = metrics.byGym.get(gym.id) ?? emptyMetrics();
    const totalCapacity = gymBranches.reduce((total, branch) => total + branch.branch.capacity, 0);
    return {
      gym,
      organization: gym.organization_id ? organizationById.get(gym.organization_id) ?? null : null,
      branches: gymBranches,
      admins,
      metrics: gymMetrics,
      totalCapacity,
      warnings: buildGymWarnings(gym, gymBranches, gymMetrics, totalCapacity, organizationById)
    };
  });
  const allWarnings = [...gymNodes.flatMap((gym) => gym.warnings), ...branchNodes.flatMap((branch) => branch.warnings)];
  const visibleBranchIds = new Set(branchNodes.map((node) => node.branch.id));
  const approvalRequests = mapGymBranchApprovals(approvalRowsResult.data ?? [], organizationById, gymNodes, branchNodes, profileById)
    .filter((approval) => {
      if (approval.gymId && visibleGymIds.has(approval.gymId)) {
        return true;
      }
      if (approval.branchId && visibleBranchIds.has(approval.branchId)) {
        return true;
      }
      return filters.organizationId !== "all" && approval.organizationId === filters.organizationId;
    });
  const auditTimeline = mapGymBranchAuditRows(auditRowsResult.data ?? [], profileById)
    .filter((item) => {
      if (item.entityType === "gym" && item.entityId && visibleGymIds.has(item.entityId)) {
        return true;
      }
      if (item.entityType === "branch" && item.entityId && visibleBranchIds.has(item.entityId)) {
        return true;
      }
      return item.action.startsWith("gym_branch.");
    });
  const unresolvedBranchRecords = gymNodes.reduce((total, node) => (
    total + node.metrics.unassignedMembers + node.metrics.unassignedPayments + node.metrics.unassignedAttendanceSessions
  ), 0);

  return {
    summary: {
      organizations: organizations.length,
      gyms: gymNodes.length,
      activeGyms: gymNodes.filter((node) => node.gym.status === "active").length,
      branches: branchNodes.length,
      activeBranches: branchNodes.filter((node) => node.branch.status === "active").length,
      branchesWithoutSettings: branchNodes.filter((node) => !node.settings).length,
      branchesWithoutAdmins: branchNodes.filter((node) => node.admins.length === 0).length,
      consistencyWarnings: allWarnings.length,
      pendingApprovals: approvalRequests.filter((approval) => approval.status === "pending").length,
      unresolvedBranchRecords
    },
    organizations,
    gyms: gymNodes,
    orphanBranches,
    adminCandidates: profiles,
    approvalRequests,
    auditTimeline,
    filters,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalGyms,
      totalPages: Math.max(1, Math.ceil(totalGyms / filters.pageSize))
    }
  };
}

export function normalizeGymBranchFilters(input: Partial<GymBranchManagementData["filters"]>): GymBranchManagementData["filters"] {
  const pageSize = clampNumber(Number(input.pageSize ?? 20), 5, 50);
  return {
    query: String(input.query ?? "").trim().slice(0, 120),
    organizationId: String(input.organizationId ?? "all").trim() || "all",
    status: String(input.status ?? "all").trim() || "all",
    page: Math.max(1, Number(input.page ?? 1) || 1),
    pageSize
  };
}

async function searchBranchesForHierarchy(filters: GymBranchManagementData["filters"]): Promise<BranchRow[]> {
  const supabase = await createSupabaseServerClient();
  const searchTerm = toPostgrestSearchTerm(filters.query);
  if (!searchTerm) {
    return [];
  }
  let query = supabase
    .from("branches")
    .select("*")
    .or(`name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%,branch_code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    .limit(1000);

  if (filters.organizationId !== "all") {
    query = query.eq("organization_id", filters.organizationId);
  }
  if (filters.status !== "all") {
    query = query.eq("status", filters.status as BranchRow["status"]);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function getVisibleBranches(gymIds: string[], filters: GymBranchManagementData["filters"]): Promise<BranchRow[]> {
  const supabase = await createSupabaseServerClient();
  const branchResults = await Promise.all([
    gymIds.length > 0 ? applyBranchQueryFilters(supabase.from("branches").select("*").in("gym_id", gymIds), filters).order("created_at", { ascending: false }).limit(5000) : emptyResult<BranchRow>(),
    applyBranchQueryFilters(supabase.from("branches").select("*").is("gym_id", null), filters).order("created_at", { ascending: false }).limit(500)
  ]);
  const firstError = branchResults.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }
  return uniqueRows(branchResults.flatMap((result) => result.data ?? []));
}

async function getMemberMetricRows(supabase: SupabaseServerClient, gymIds: string[]): Promise<QueryResult<MemberRow>> {
  const result = await supabase.from("members").select("id, gym_id, branch_id, status").in("gym_id", gymIds).limit(100000);
  if (!isMissingBranchIdColumn(result.error)) {
    return { data: result.data ?? [], error: result.error };
  }

  const legacyResult = await supabase.from("members").select("id, gym_id, status").in("gym_id", gymIds).limit(100000);
  return {
    data: (legacyResult.data ?? []).map((row) => ({ ...row, branch_id: null })),
    error: legacyResult.error
  };
}

async function getPaymentMetricRows(supabase: SupabaseServerClient, gymIds: string[]): Promise<QueryResult<PaymentRow>> {
  const result = await supabase.from("payments").select("id, gym_id, branch_id, status, amount").in("gym_id", gymIds).limit(100000);
  if (!isMissingBranchIdColumn(result.error)) {
    return { data: result.data ?? [], error: result.error };
  }

  const legacyResult = await supabase.from("payments").select("id, gym_id, status, amount").in("gym_id", gymIds).limit(100000);
  return {
    data: (legacyResult.data ?? []).map((row) => ({ ...row, branch_id: null })),
    error: legacyResult.error
  };
}

async function getAttendanceMetricRows(supabase: SupabaseServerClient, gymIds: string[]): Promise<QueryResult<AttendanceSessionRow>> {
  const result = await supabase.from("attendance_sessions").select("id, gym_id, branch_id, status").in("gym_id", gymIds).eq("status", "inside").limit(100000);
  if (!isMissingBranchIdColumn(result.error)) {
    return { data: result.data ?? [], error: result.error };
  }

  const legacyResult = await supabase.from("attendance_sessions").select("id, gym_id, status").in("gym_id", gymIds).eq("status", "inside").limit(100000);
  return {
    data: (legacyResult.data ?? []).map((row) => ({ ...row, branch_id: null })),
    error: legacyResult.error
  };
}

async function getPendingGymBranchApprovalRows(supabase: SupabaseServerClient): Promise<QueryResult<GymBranchApprovalRow>> {
  const client = supabase as GymBranchApprovalClient;
  const result = await client
    .from("gym_branch_approval_requests")
    .select("id, organization_id, gym_id, branch_id, action, status, requested_by, target_user_id, reason, requested_at, expires_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(100);
  if (isMissingTable(result.error, "gym_branch_approval_requests")) {
    return { data: [], error: null };
  }
  return { data: result.data ?? [], error: result.error };
}

async function getRecentGymBranchAuditRows(supabase: SupabaseServerClient): Promise<QueryResult<AuditLogRow>> {
  const result = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
    .or("entity_type.eq.gym,entity_type.eq.branch,action.ilike.gym_branch.%")
    .order("created_at", { ascending: false })
    .limit(50);
  return { data: result.data ?? [], error: result.error };
}

function isMissingBranchIdColumn(error: QueryError | null) {
  return Boolean(error && (error.code === "42703" || error.message.includes("branch_id does not exist")));
}

function isMissingTable(error: QueryError | null, table: string) {
  return Boolean(error && (error.code === "42P01" || error.message.includes(`'public.${table}'`) || error.message.includes(`relation "${table}" does not exist`)));
}

function applyBranchQueryFilters<T extends { eq: (column: string, value: string) => T; or: (filters: string) => T }>(query: T, filters: GymBranchManagementData["filters"]) {
  let next = query;
  if (filters.organizationId !== "all") {
    next = next.eq("organization_id", filters.organizationId);
  }
  if (filters.status !== "all") {
    next = next.eq("status", filters.status as BranchRow["status"]);
  }
  if (filters.query) {
    const searchTerm = toPostgrestSearchTerm(filters.query);
    if (searchTerm) {
      next = next.or(`name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%,branch_code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }
  }
  return next;
}

function buildOperationalMetrics(branches: BranchRow[], members: MemberRow[], payments: PaymentRow[], attendanceSessions: AttendanceSessionRow[]) {
  const byGym = new Map<string, GymBranchMetrics>();
  const byBranch = new Map<string, GymBranchMetrics>();
  const singleBranchByGym = getSingleBranchByGym(branches);

  for (const member of members) {
    if (!member.gym_id) {
      continue;
    }
    const summary = ensureMetrics(byGym, member.gym_id);
    const branchSummary = member.branch_id ? ensureMetrics(byBranch, member.branch_id) : getFallbackSingleBranchMetrics(byBranch, singleBranchByGym, member.gym_id);
    if (member.status === "active") {
      summary.activeMembers += 1;
      if (branchSummary) {
        branchSummary.activeMembers += 1;
      } else {
        summary.unassignedMembers += 1;
      }
    }
  }
  for (const payment of payments) {
    if (!payment.gym_id) {
      continue;
    }
    const summary = ensureMetrics(byGym, payment.gym_id);
    const branchSummary = payment.branch_id ? ensureMetrics(byBranch, payment.branch_id) : getFallbackSingleBranchMetrics(byBranch, singleBranchByGym, payment.gym_id);
    summary.payments += 1;
    if (branchSummary) {
      branchSummary.payments += 1;
    } else {
      summary.unassignedPayments += 1;
    }
    if (payment.status === "paid" || payment.status === "partially_refunded") {
      summary.revenue += Number(payment.amount ?? 0);
      if (branchSummary) {
        branchSummary.revenue += Number(payment.amount ?? 0);
      }
    }
  }
  for (const session of attendanceSessions) {
    if (!session.gym_id) {
      continue;
    }
    const summary = ensureMetrics(byGym, session.gym_id);
    const branchSummary = session.branch_id ? ensureMetrics(byBranch, session.branch_id) : getFallbackSingleBranchMetrics(byBranch, singleBranchByGym, session.gym_id);
    summary.activeAttendanceSessions += 1;
    if (branchSummary) {
      branchSummary.activeAttendanceSessions += 1;
    } else {
      summary.unassignedAttendanceSessions += 1;
    }
  }
  return { byGym, byBranch };
}

function mapGymBranchApprovals(
  approvals: GymBranchApprovalRow[],
  organizationById: Map<string, Pick<OrganizationRow, "id" | "name" | "slug" | "status">>,
  gyms: GymBranchNode[],
  branches: BranchNode[],
  profileById: Map<string, GymBranchProfile>
): GymBranchApprovalRequest[] {
  const gymById = new Map(gyms.map((node) => [node.gym.id, node.gym]));
  const branchById = new Map(branches.map((node) => [node.branch.id, node.branch]));
  return approvals.map((approval) => {
    const requester = approval.requested_by ? profileById.get(approval.requested_by) ?? null : null;
    return {
      id: approval.id,
      organizationId: approval.organization_id,
      organizationName: organizationById.get(approval.organization_id)?.name ?? null,
      gymId: approval.gym_id,
      gymName: approval.gym_id ? gymById.get(approval.gym_id)?.name ?? null : null,
      branchId: approval.branch_id,
      branchName: approval.branch_id ? branchById.get(approval.branch_id)?.name ?? null : null,
      action: approval.action,
      status: approval.status,
      requestedBy: approval.requested_by,
      requestedByName: requester?.full_name || requester?.email || null,
      targetUserId: approval.target_user_id,
      reason: approval.reason,
      requestedAt: approval.requested_at,
      expiresAt: approval.expires_at
    };
  });
}

function mapGymBranchAuditRows(rows: AuditLogRow[], profileById: Map<string, GymBranchProfile>): GymBranchAuditItem[] {
  return rows.map((row) => {
    const actor = row.actor_id ? profileById.get(row.actor_id) ?? null : null;
    return {
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorId: row.actor_id,
      actorName: actor?.full_name || null,
      actorEmail: actor?.email || null,
      createdAt: row.created_at,
      metadata: row.metadata
    };
  });
}

function ensureMetrics(metrics: Map<string, GymBranchMetrics>, gymId: string) {
  const existing = metrics.get(gymId);
  if (existing) {
    return existing;
  }
  const next = emptyMetrics();
  metrics.set(gymId, next);
  return next;
}

function emptyMetrics(): GymBranchMetrics {
  return {
    activeMembers: 0,
    payments: 0,
    revenue: 0,
    activeAttendanceSessions: 0,
    unassignedMembers: 0,
    unassignedPayments: 0,
    unassignedAttendanceSessions: 0
  };
}

function buildGymWarnings(
  gym: GymRow,
  branches: BranchNode[],
  metrics: GymBranchMetrics,
  totalCapacity: number,
  organizationById: Map<string, Pick<OrganizationRow, "id" | "name" | "slug" | "status">>
): GymBranchWarning[] {
  const warnings: GymBranchWarning[] = [];
  if (!gym.organization_id || !organizationById.has(gym.organization_id)) {
    warnings.push({ severity: "critical", scope: "gym", entityId: gym.id, title: "Missing organization link", detail: "This gym is not linked to a valid organization." });
  }
  if (branches.length === 0) {
    warnings.push({ severity: "warning", scope: "gym", entityId: gym.id, title: "No branches", detail: "Create at least one branch before assigning gym admins or routing members." });
  }
  if (branches.length > 0 && branches.every((branch) => branch.branch.status !== "active")) {
    warnings.push({ severity: "warning", scope: "gym", entityId: gym.id, title: "No active branches", detail: "All branches under this gym are inactive, suspended, or archived." });
  }
  if (totalCapacity > 0 && metrics.activeMembers > totalCapacity) {
    warnings.push({ severity: "critical", scope: "gym", entityId: gym.id, title: "Capacity exceeded", detail: `${metrics.activeMembers} active members exceed total branch capacity of ${totalCapacity}.` });
  }
  if (branches.length > 1 && metrics.unassignedMembers > 0) {
    warnings.push({ severity: "critical", scope: "gym", entityId: gym.id, title: "Unassigned member scope", detail: `${metrics.unassignedMembers} active member record(s) are gym-scoped without branch assignment.` });
  }
  if (branches.length > 1 && metrics.unassignedPayments > 0) {
    warnings.push({ severity: "warning", scope: "gym", entityId: gym.id, title: "Unassigned payment scope", detail: `${metrics.unassignedPayments} payment record(s) are gym-scoped without branch assignment.` });
  }
  if (branches.length > 1 && metrics.unassignedAttendanceSessions > 0) {
    warnings.push({ severity: "warning", scope: "gym", entityId: gym.id, title: "Unassigned attendance scope", detail: `${metrics.unassignedAttendanceSessions} active attendance session(s) are gym-scoped without branch assignment.` });
  }
  if (branches.some((branch) => branch.branch.organization_id !== gym.organization_id)) {
    warnings.push({ severity: "critical", scope: "gym", entityId: gym.id, title: "Cross-organization branch link", detail: "One or more branches point to a different organization than the parent gym." });
  }
  return warnings;
}

function buildBranchWarnings(
  branch: BranchRow,
  settings: BranchSettingRow | null,
  admins: GymBranchAdminAssignment[],
  metrics: GymBranchMetrics,
  organizationById: Map<string, Pick<OrganizationRow, "id" | "name" | "slug" | "status">>,
  visibleGymIds: Set<string>
): GymBranchWarning[] {
  const warnings: GymBranchWarning[] = [];
  if (!organizationById.has(branch.organization_id)) {
    warnings.push({ severity: "critical", scope: "branch", entityId: branch.id, title: "Missing organization", detail: "This branch references an organization that is not available." });
  }
  if (!branch.gym_id) {
    warnings.push({ severity: "warning", scope: "branch", entityId: branch.id, title: "No gym link", detail: "Branch is not attached to a gym record." });
  } else if (!visibleGymIds.has(branch.gym_id)) {
    warnings.push({ severity: "critical", scope: "branch", entityId: branch.id, title: "Invalid gym link", detail: "Branch points to a gym outside the current filtered or valid hierarchy." });
  }
  if (!settings) {
    warnings.push({ severity: "warning", scope: "branch", entityId: branch.id, title: "Settings missing", detail: "Branch settings have not been configured." });
  }
  if (admins.length === 0) {
    warnings.push({ severity: "warning", scope: "branch", entityId: branch.id, title: "No gym admin", detail: "No active gym admin assignment exists for this branch." });
  }
  if (!branch.operating_hours || (typeof branch.operating_hours === "object" && !Array.isArray(branch.operating_hours) && Object.keys(branch.operating_hours).length === 0)) {
    warnings.push({ severity: "warning", scope: "branch", entityId: branch.id, title: "Operating hours missing", detail: "Configure operating hours for attendance, bookings, and communication timing." });
  }
  if (branch.capacity > 0 && metrics.activeMembers > branch.capacity) {
    warnings.push({ severity: "critical", scope: "branch", entityId: branch.id, title: "Branch capacity exceeded", detail: `${metrics.activeMembers} active member record(s) exceed branch capacity of ${branch.capacity}.` });
  }
  return warnings;
}

function uniqueAssignments(assignments: GymBranchAdminAssignment[]) {
  const byUser = new Map<string, GymBranchAdminAssignment>();
  for (const assignment of assignments) {
    if (assignment.status === "active" && !byUser.has(assignment.user_id)) {
      byUser.set(assignment.user_id, assignment);
    }
  }
  return Array.from(byUser.values());
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }
  return grouped;
}

function getSingleBranchByGym(branches: BranchRow[]) {
  const grouped = groupBy(branches.filter((branch) => branch.gym_id), (branch) => branch.gym_id as string);
  const result = new Map<string, string>();
  for (const [gymId, gymBranches] of grouped) {
    if (gymBranches.length === 1 && gymBranches[0]) {
      result.set(gymId, gymBranches[0].id);
    }
  }
  return result;
}

function getFallbackSingleBranchMetrics(metrics: Map<string, GymBranchMetrics>, singleBranchByGym: Map<string, string>, gymId: string) {
  const branchId = singleBranchByGym.get(gymId);
  return branchId ? ensureMetrics(metrics, branchId) : null;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function uniqueRows<T extends { id: string }>(rows: T[]) {
  const byId = new Map<string, T>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function toPostgrestSearchTerm(value: string) {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 80);
}

function emptyResult<T>(): Promise<QueryResult<T>> {
  return Promise.resolve({ data: [], error: null });
}
