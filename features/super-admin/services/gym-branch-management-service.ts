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

export type GymBranchManagementData = {
  summary: GymBranchManagementSummary;
  organizations: Array<Pick<OrganizationRow, "id" | "name" | "slug" | "status">>;
  gyms: GymBranchNode[];
  orphanBranches: BranchNode[];
  adminCandidates: GymBranchProfile[];
  filters: {
    query: string;
    organizationId: string;
    status: string;
  };
};

type MemberRow = Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "gym_id" | "status">;
type PaymentRow = Pick<Database["public"]["Tables"]["payments"]["Row"], "id" | "gym_id" | "status" | "amount">;
type AttendanceSessionRow = Pick<Database["public"]["Tables"]["attendance_sessions"]["Row"], "id" | "gym_id" | "status">;

export async function getGymBranchManagementData(input: Partial<GymBranchManagementData["filters"]> = {}): Promise<GymBranchManagementData> {
  const supabase = await createSupabaseServerClient();
  const filters = normalizeGymBranchFilters(input);
  const [
    organizationsResult,
    gymsResult,
    branchesResult,
    settingsResult,
    branchUsersResult,
    domainsResult,
    profilesResult,
    membersResult,
    paymentsResult,
    attendanceResult
  ] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status").order("name", { ascending: true }).limit(5000),
    supabase.from("gyms").select("*").order("created_at", { ascending: false }).limit(10000),
    supabase.from("branches").select("*").order("created_at", { ascending: false }).limit(20000),
    supabase.from("branch_settings").select("*").order("updated_at", { ascending: false }).limit(20000),
    supabase.from("branch_users").select("*").in("role_name", ["gym_admin"]).order("updated_at", { ascending: false }).limit(20000),
    supabase.from("tenant_domains").select("*").order("updated_at", { ascending: false }).limit(20000),
    supabase.from("profiles").select("id, full_name, email, phone, status, gym_id").in("status", ["active", "invited"]).order("full_name", { ascending: true }).limit(5000),
    supabase.from("members").select("id, gym_id, status").limit(100000),
    supabase.from("payments").select("id, gym_id, status, amount").limit(100000),
    supabase.from("attendance_sessions").select("id, gym_id, status").eq("status", "inside").limit(100000)
  ]);

  const firstError = [
    organizationsResult,
    gymsResult,
    branchesResult,
    settingsResult,
    branchUsersResult,
    domainsResult,
    profilesResult,
    membersResult,
    paymentsResult,
    attendanceResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const organizations = organizationsResult.data ?? [];
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const profiles = profilesResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const gyms = applyGymFilters(gymsResult.data ?? [], branchesResult.data ?? [], organizations, filters);
  const visibleGymIds = new Set(gyms.map((gym) => gym.id));
  const branches = (branchesResult.data ?? []).filter((branch) => {
    if (filters.organizationId !== "all" && branch.organization_id !== filters.organizationId) {
      return false;
    }
    if (branch.gym_id && !visibleGymIds.has(branch.gym_id)) {
      return false;
    }
    if (filters.status !== "all" && branch.status !== filters.status) {
      return false;
    }
    if (!filters.query) {
      return true;
    }
    return branchMatchesSearch(branch, filters.query);
  });
  const settingsByBranch = new Map((settingsResult.data ?? []).map((settings) => [settings.branch_id, settings]));
  const domainsByBranch = groupBy(domainsResult.data ?? [], (domain) => domain.branch_id ?? "organization");
  const branchUsers = branchUsersResult.data ?? [];
  const adminsByBranch = groupBy(
    branchUsers.map((assignment) => ({ ...assignment, profile: profileById.get(assignment.user_id) ?? null })),
    (assignment) => assignment.branch_id
  );
  const metricsByGym = buildGymMetrics(membersResult.data ?? [], paymentsResult.data ?? [], attendanceResult.data ?? []);

  const branchNodes = branches.map((branch): BranchNode => {
    const settings = settingsByBranch.get(branch.id) ?? null;
    const admins = adminsByBranch.get(branch.id) ?? [];
    const metrics = branch.gym_id ? metricsByGym.get(branch.gym_id) ?? emptyMetrics() : emptyMetrics();
    return {
      branch,
      settings,
      domains: domainsByBranch.get(branch.id) ?? [],
      admins,
      metrics,
      warnings: buildBranchWarnings(branch, settings, admins, organizationById, visibleGymIds)
    };
  });
  const branchesByGym = groupBy(branchNodes.filter((node) => node.branch.gym_id), (node) => node.branch.gym_id as string);
  const orphanBranches = branchNodes.filter((node) => !node.branch.gym_id);
  const gymNodes = gyms.map((gym): GymBranchNode => {
    const gymBranches = branchesByGym.get(gym.id) ?? [];
    const admins = uniqueAssignments(gymBranches.flatMap((branch) => branch.admins));
    const metrics = metricsByGym.get(gym.id) ?? emptyMetrics();
    const totalCapacity = gymBranches.reduce((total, branch) => total + branch.branch.capacity, 0);
    return {
      gym,
      organization: gym.organization_id ? organizationById.get(gym.organization_id) ?? null : null,
      branches: gymBranches,
      admins,
      metrics,
      totalCapacity,
      warnings: buildGymWarnings(gym, gymBranches, metrics, totalCapacity, organizationById)
    };
  });
  const allWarnings = [...gymNodes.flatMap((gym) => gym.warnings), ...branchNodes.flatMap((branch) => branch.warnings)];

  return {
    summary: {
      organizations: organizations.length,
      gyms: gymNodes.length,
      activeGyms: gymNodes.filter((node) => node.gym.status === "active").length,
      branches: branchNodes.length,
      activeBranches: branchNodes.filter((node) => node.branch.status === "active").length,
      branchesWithoutSettings: branchNodes.filter((node) => !node.settings).length,
      branchesWithoutAdmins: branchNodes.filter((node) => node.admins.length === 0).length,
      consistencyWarnings: allWarnings.length
    },
    organizations,
    gyms: gymNodes,
    orphanBranches,
    adminCandidates: profiles,
    filters
  };
}

export function normalizeGymBranchFilters(input: Partial<GymBranchManagementData["filters"]>): GymBranchManagementData["filters"] {
  return {
    query: String(input.query ?? "").trim().slice(0, 120),
    organizationId: String(input.organizationId ?? "all").trim() || "all",
    status: String(input.status ?? "all").trim() || "all"
  };
}

function applyGymFilters(
  gyms: GymRow[],
  branches: BranchRow[],
  organizations: Array<Pick<OrganizationRow, "id" | "name" | "slug" | "status">>,
  filters: GymBranchManagementData["filters"]
) {
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const branchesByGym = groupBy(branches.filter((branch) => branch.gym_id), (branch) => branch.gym_id as string);
  const query = filters.query.toLowerCase();
  return gyms.filter((gym) => {
    if (filters.organizationId !== "all" && gym.organization_id !== filters.organizationId) {
      return false;
    }
    if (filters.status !== "all" && gym.status !== filters.status) {
      return false;
    }
    if (!query) {
      return true;
    }
    const organization = gym.organization_id ? organizationById.get(gym.organization_id) : null;
    const branchText = (branchesByGym.get(gym.id) ?? []).map((branch) => `${branch.name} ${branch.slug} ${branch.branch_code} ${branch.city ?? ""}`).join(" ");
    return `${gym.name} ${gym.slug} ${organization?.name ?? ""} ${organization?.slug ?? ""} ${branchText}`.toLowerCase().includes(query);
  });
}

function branchMatchesSearch(branch: BranchRow, query: string) {
  const value = `${branch.name} ${branch.slug} ${branch.branch_code} ${branch.city ?? ""} ${branch.state ?? ""} ${branch.email ?? ""}`.toLowerCase();
  return value.includes(query.toLowerCase());
}

function buildGymMetrics(members: MemberRow[], payments: PaymentRow[], attendanceSessions: AttendanceSessionRow[]) {
  const metrics = new Map<string, GymBranchMetrics>();
  for (const member of members) {
    if (!member.gym_id) {
      continue;
    }
    const summary = ensureMetrics(metrics, member.gym_id);
    if (member.status === "active") {
      summary.activeMembers += 1;
    }
  }
  for (const payment of payments) {
    if (!payment.gym_id) {
      continue;
    }
    const summary = ensureMetrics(metrics, payment.gym_id);
    summary.payments += 1;
    if (payment.status === "paid" || payment.status === "partially_refunded") {
      summary.revenue += Number(payment.amount ?? 0);
    }
  }
  for (const session of attendanceSessions) {
    if (!session.gym_id) {
      continue;
    }
    ensureMetrics(metrics, session.gym_id).activeAttendanceSessions += 1;
  }
  return metrics;
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
    activeAttendanceSessions: 0
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
  if (branches.some((branch) => branch.branch.organization_id !== gym.organization_id)) {
    warnings.push({ severity: "critical", scope: "gym", entityId: gym.id, title: "Cross-organization branch link", detail: "One or more branches point to a different organization than the parent gym." });
  }
  return warnings;
}

function buildBranchWarnings(
  branch: BranchRow,
  settings: BranchSettingRow | null,
  admins: GymBranchAdminAssignment[],
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
