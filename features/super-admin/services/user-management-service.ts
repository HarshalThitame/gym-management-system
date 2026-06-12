import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { RoleName, ProfileStatus } from "@/types/auth";
import type { OrganizationRow } from "@/types/enterprise";

export const userSortOptions = ["created_desc", "name_asc", "email_asc", "role_asc"] as const;
export type UserSortOption = (typeof userSortOptions)[number];

export type UserManagementFilters = {
  query: string;
  role: string;
  status: string;
  organizationId: string;
  sort: UserSortOption;
  page: number;
  pageSize: number;
};

export type UserManagementPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export type UserManagementRecord = {
  user: ProfileRow;
  roles: RoleName[];
  primaryRole: RoleName | null;
  organizations: Array<{ id: string; name: string; slug: string }>;
  gyms: Array<{ id: string; name: string; slug: string }>;
  branches: Array<{ id: string; name: string; branchCode: string }>;
  loginCount: number;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  hasActiveSessions: boolean;
  pendingApprovals: number;
};

export type UserManagementSummary = {
  totalUsers: number;
  activeUsers: number;
  invitedUsers: number;
  suspendedUsers: number;
  archivedUsers: number;
  superAdmins: number;
  orgOwners: number;
  gymAdmins: number;
  trainers: number;
  members: number;
  receptionStaff: number;
};

export type UserManagementData = {
  records: UserManagementRecord[];
  organizations: Array<Pick<OrganizationRow, "id" | "name" | "slug" | "status">>;
  filters: UserManagementFilters;
  pagination: UserManagementPagination;
  summary: UserManagementSummary;
};

export type LoginHistoryEntry = {
  id: string;
  userId: string;
  email: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: Json;
  status: "success" | "failed" | "locked" | "reset_requested" | "reset_completed" | "force_logout";
  failureReason: string | null;
  createdAt: string;
};

export type UserActivityEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  severity: "info" | "notice" | "warning" | "critical";
  createdAt: string;
  metadata: Json;
  ipAddress: string | null;
  userAgent: string | null;
  source: "activity_events" | "audit_logs" | "login_history";
};

export type UserDetailData = {
  record: UserManagementRecord;
  loginHistory: LoginHistoryEntry[];
  activityTimeline: UserActivityEvent[];
  loginHistoryPagination: UserManagementPagination;
  activityPagination: UserManagementPagination;
};

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "gym_id" | "full_name" | "email" | "phone" | "avatar_url" | "status" | "created_at" | "updated_at">;
type BranchUserRow = Pick<Database["public"]["Tables"]["branch_users"]["Row"], "id" | "user_id" | "organization_id" | "branch_id" | "role_name" | "status">;
type LoginHistoryRow = {
  id: string;
  user_id: string;
  email: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: string;
  metadata: Json | null;
};
type ActivityEventRow = Pick<Database["public"]["Tables"]["activity_events"]["Row"], "id" | "event_type" | "entity_type" | "entity_id" | "actor_id" | "severity" | "metadata" | "ip_address" | "user_agent" | "created_at">;
type AuditLogRow = Pick<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "action" | "entity_type" | "entity_id" | "actor_id" | "metadata" | "ip_address" | "user_agent" | "created_at">;

const defaultFilters: UserManagementFilters = {
  query: "",
  role: "all",
  status: "all",
  organizationId: "all",
  sort: "created_desc",
  page: 1,
  pageSize: 25
};

export async function getUserManagementData(input: Partial<UserManagementFilters> = {}): Promise<UserManagementData> {
  const supabase = await createSupabaseServerClient();
  const filters = normalizeUserManagementFilters(input);

  const [profilesResult, organizationsResult, branchUsersResult] = await Promise.all([
    queryProfilesPage(supabase, filters),
    supabase.from("organizations").select("id, name, slug, status").order("name", { ascending: true }).limit(5000),
    (supabase as any).from("branch_users").select("id, user_id, organization_id, branch_id, role_name, status").in("status", ["active", "invited"]).limit(20000)
  ]);

  if (profilesResult.error) throw new Error(String(profilesResult.error));
  if (organizationsResult.error) throw new Error(String(organizationsResult.error));
  if (branchUsersResult.error) throw new Error(String(branchUsersResult.error));

  const organizations = organizationsResult.data ?? [];
  const allAssignments = (branchUsersResult.data ?? []) as BranchUserRow[];
  const profiles = profilesResult.data ?? [];

  const userIds = profiles.map((p) => p.id);
  const assignmentByUser = groupAssignmentsByUser(allAssignments.filter((a) => userIds.includes(a.user_id)));
  const orgById = new Map(organizations.map((o) => [o.id, o]));

  const records: UserManagementRecord[] = profiles.map((profile) => {
    const assignments = assignmentByUser.get(profile.id) ?? [];
    const roles = Array.from(new Set(assignments.map((a) => a.role_name))) as RoleName[];
    const activeAssignments = assignments.filter((a) => a.status === "active");
    const uniqueOrgIds = Array.from(new Set(assignments.map((a) => a.organization_id).filter(Boolean)));
    const uniqueGymIds: string[] = [];
    const uniqueBranchIds = Array.from(new Set(assignments.map((a) => a.branch_id).filter(Boolean)));

    return {
      user: profile,
      roles,
      primaryRole: roles[0] ?? null,
      organizations: uniqueOrgIds.map((id) => orgById.get(id)).filter((o): o is NonNullable<typeof o> => o != null).map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
      gyms: [],
      branches: [],
      loginCount: 0,
      lastLoginAt: null,
      lastActivityAt: null,
      hasActiveSessions: activeAssignments.length > 0,
      pendingApprovals: 0
    };
  });

  const sortedRecords = sortRecords(records, filters.sort);
  const summary = buildUserManagementSummary(records);

  return {
    records: sortedRecords,
    organizations,
    filters,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: profilesResult.count ?? records.length,
      totalPages: Math.max(1, Math.ceil((profilesResult.count ?? records.length) / filters.pageSize)),
      from: (profilesResult.count ?? records.length) === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1,
      to: Math.min(filters.page * filters.pageSize, profilesResult.count ?? records.length)
    },
    summary
  };
}

export async function getUserDetailData(
  userId: string,
  loginPage = 1,
  loginPageSize = 20,
  activityPage = 1,
  activityPageSize = 20
): Promise<UserDetailData | null> {
  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, gym_id, full_name, email, phone, avatar_url, status, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) return null;

  const { data: assignments } = await (supabase as any)
    .from("branch_users")
    .select("id, user_id, organization_id, branch_id, role_name, status")
    .eq("user_id", userId)
    .limit(500);

  const safeAssignments = (assignments ?? []) as Array<{ role_name: string; status: string; organization_id: string; user_id: string }>;
  const roles = Array.from(new Set(safeAssignments.map((a) => a.role_name))) as RoleName[];
  const activeAssignments = safeAssignments.filter((a) => a.status === "active");

  const uniqueOrgIds = Array.from(new Set(safeAssignments.map((a) => a.organization_id).filter(Boolean)));
  const organizations = uniqueOrgIds.length > 0
    ? (await supabase.from("organizations").select("id, name, slug").in("id", uniqueOrgIds)).data ?? []
    : [];

  const [loginResult, activityResult, auditResult] = await Promise.all([
    getLoginHistoryForUser(supabase, userId, loginPage, loginPageSize),
    getActivityEventsForUser(supabase, userId, activityPage, activityPageSize),
    getAuditLogsForUser(supabase, userId, activityPage, activityPageSize)
  ]);

  const loginHistory: LoginHistoryEntry[] = ((loginResult.data ?? []) as LoginHistoryRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: null,
    status: row.status as LoginHistoryEntry["status"],
    failureReason: row.failure_reason,
    createdAt: row.created_at
  }));

  const activityTimeline = mergeAndSortActivity(
    (activityResult.data ?? []).map(activityToEvent),
    (auditResult.data ?? []).map(auditToEvent),
    loginHistory.slice(0, 50).map(loginToEvent)
  );

  const record: UserManagementRecord = {
    user: profile,
    roles,
    primaryRole: roles[0] ?? null,
    organizations,
    gyms: [],
    branches: [],
    loginCount: loginResult.count ?? loginHistory.length,
    lastLoginAt: loginHistory.find((e) => e.status === "success")?.createdAt ?? null,
    lastActivityAt: activityTimeline[0]?.createdAt ?? null,
    hasActiveSessions: activeAssignments.length > 0,
    pendingApprovals: 0
  };

  return {
    record,
    loginHistory,
    activityTimeline,
    loginHistoryPagination: buildPagination(loginPage, loginPageSize, loginResult.count ?? loginHistory.length),
    activityPagination: buildPagination(activityPage, activityPageSize, activityTimeline.length)
  };
}

export function normalizeUserManagementFilters(input: Partial<UserManagementFilters>, maxPageSize = 100): UserManagementFilters {
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? defaultFilters.pageSize) || defaultFilters.pageSize, 5), maxPageSize);
  const page = Math.max(Number(input.page ?? defaultFilters.page) || defaultFilters.page, 1);
  const sort = userSortOptions.includes(input.sort ?? defaultFilters.sort) ? input.sort ?? defaultFilters.sort : defaultFilters.sort;

  return {
    query: String(input.query ?? defaultFilters.query).trim().slice(0, 120),
    role: String(input.role ?? defaultFilters.role).trim() || "all",
    status: String(input.status ?? defaultFilters.status).trim() || "all",
    organizationId: String(input.organizationId ?? defaultFilters.organizationId).trim() || "all",
    sort,
    page,
    pageSize
  };
}

async function queryProfilesPage(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, filters: UserManagementFilters) {
  let query = supabase
    .from("profiles")
    .select("id, gym_id, full_name, email, phone, avatar_url, status, created_at, updated_at", { count: "exact" });

  if (filters.status !== "all") {
    query = query.eq("status", filters.status as ProfileStatus);
  }

  const safeQuery = sanitizeSearch(filters.query);
  if (safeQuery) {
    query = query.or([
      `full_name.ilike.%${safeQuery}%`,
      `email.ilike.%${safeQuery}%`,
      `phone.ilike.%${safeQuery}%`
    ].join(","));
  }

  const rangeFrom = (filters.page - 1) * filters.pageSize;
  const rangeTo = rangeFrom + filters.pageSize - 1;
  const dbSort = dbSortFor(filters.sort);

  const { data, error, count } = await query
    .order(dbSort.column, { ascending: dbSort.ascending })
    .range(rangeFrom, rangeTo);

  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, error };
}

async function getLoginHistoryForUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, page: number, pageSize: number) {
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const { data, error, count } = await (supabase as any)
    .from("login_history")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (error) {
    if (isMissingTable(error, "login_history")) {
      return { data: [] as LoginHistoryRow[], count: 0, error: null };
    }
    throw new Error(error.message);
  }

  return { data: data ?? [], count: count ?? 0, error };
}

async function getActivityEventsForUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, page: number, pageSize: number) {
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const { data, error } = await supabase
    .from("activity_events")
    .select("id, event_type, entity_type, entity_id, actor_id, severity, metadata, ip_address, user_agent, created_at")
    .or(`actor_id.eq.${userId},entity_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (error) throw new Error(error.message);
  return { data: data ?? [] };
}

async function getAuditLogsForUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, page: number, pageSize: number) {
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, ip_address, user_agent, created_at")
    .or(`actor_id.eq.${userId},entity_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (error) throw new Error(error.message);
  return { data: data ?? [] };
}

function groupAssignmentsByUser(assignments: BranchUserRow[]) {
  const byUser = new Map<string, BranchUserRow[]>();
  for (const assignment of assignments) {
    const existing = byUser.get(assignment.user_id) ?? [];
    existing.push(assignment);
    byUser.set(assignment.user_id, existing);
  }
  return byUser;
}

function buildUserManagementSummary(records: UserManagementRecord[]): UserManagementSummary {
  return {
    totalUsers: records.length,
    activeUsers: records.filter((r) => r.user.status === "active").length,
    invitedUsers: records.filter((r) => r.user.status === "invited").length,
    suspendedUsers: records.filter((r) => r.user.status === "suspended").length,
    archivedUsers: records.filter((r) => r.user.status === "archived").length,
    superAdmins: records.filter((r) => r.roles.includes("super_admin")).length,
    orgOwners: records.filter((r) => r.roles.includes("organization_owner")).length,
    gymAdmins: records.filter((r) => r.roles.includes("gym_admin")).length,
    trainers: records.filter((r) => r.roles.includes("trainer")).length,
    members: records.filter((r) => r.roles.includes("member")).length,
    receptionStaff: records.filter((r) => r.roles.includes("reception_staff")).length
  };
}

function sortRecords(records: UserManagementRecord[], sort: UserSortOption) {
  const sorted = [...records];
  if (sort === "name_asc") {
    sorted.sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
  } else if (sort === "email_asc") {
    sorted.sort((a, b) => (a.user.email ?? "").localeCompare(b.user.email ?? ""));
  } else if (sort === "role_asc") {
    sorted.sort((a, b) => (a.primaryRole ?? "").localeCompare(b.primaryRole ?? ""));
  } else {
    sorted.sort((a, b) => new Date(b.user.created_at).getTime() - new Date(a.user.created_at).getTime());
  }
  return sorted;
}

function activityToEvent(row: ActivityEventRow): UserActivityEvent {
  return {
    id: row.id,
    action: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorName: null,
    severity: row.severity as UserActivityEvent["severity"],
    createdAt: row.created_at,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    source: "activity_events"
  };
}

function auditToEvent(row: AuditLogRow): UserActivityEvent {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorName: null,
    severity: severityFromAction(row.action),
    createdAt: row.created_at,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    source: "audit_logs"
  };
}

function loginToEvent(entry: LoginHistoryEntry): UserActivityEvent {
  return {
    id: `login_${entry.id}`,
    action: `login.${entry.status}`,
    entityType: "login_history",
    entityId: entry.id,
    actorId: entry.userId,
    actorName: null,
    severity: entry.status === "success" ? "info" : entry.status === "failed" ? "warning" : "critical",
    createdAt: entry.createdAt,
    metadata: { ipAddress: entry.ipAddress, deviceInfo: entry.deviceInfo, failureReason: entry.failureReason },
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    source: "login_history"
  };
}

function mergeAndSortActivity(...sources: UserActivityEvent[][]): UserActivityEvent[] {
  const byId = new Map<string, UserActivityEvent>();
  for (const events of sources) {
    for (const event of events) {
      byId.set(`${event.source}-${event.id}`, event);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 500);
}

function buildPagination(page: number, pageSize: number, total: number): UserManagementPagination {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total)
  };
}

function sanitizeSearch(value: string) {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 120);
}

function dbSortFor(sort: UserSortOption) {
  if (sort === "name_asc") return { column: "full_name" as const, ascending: true as const };
  if (sort === "email_asc") return { column: "email" as const, ascending: true as const };
  return { column: "created_at" as const, ascending: false as const };
}

function isMissingTable(error: { code?: string; message: string } | null, table: string) {
  return Boolean(error && (error.code === "42P01" || error.message.includes(`'public.${table}'`) || error.message.includes(`relation "${table}" does not exist`)));
}

function severityFromAction(action: string): UserActivityEvent["severity"] {
  if (/delete|purge|suspend|lock|critical|security|breach/i.test(action)) return "critical";
  if (/update|change|transfer|reset|invite|role/i.test(action)) return "notice";
  if (/create|activate|restore|approve/i.test(action)) return "info";
  return "warning";
}
