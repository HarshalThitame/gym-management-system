import { addDays, formatISO, startOfMonth } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  MemberDirectoryItem,
  MemberProfile,
  MemberRow,
  MembershipMetrics,
  MembershipPlanRow,
  MembershipRow
} from "@/types/membership";

type ListMembersInput = {
  gymId: string | null;
  query?: string | undefined;
  memberStatus?: string | undefined;
  membershipStatus?: string | undefined;
  planType?: string | undefined;
  expiry?: string | undefined;
  page?: number;
  pageSize?: number;
};

type ReportFilter = {
  gymId: string | null;
  type: "active" | "expired" | "upcoming" | "revenue" | "growth";
};

export async function listMembershipPlans(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("membership_plans")
    .select("*")
    .order("status", { ascending: true })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (gymId) {
    query.eq("gym_id", gymId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listActiveMembershipPlans(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("membership_plans")
    .select("*")
    .eq("status", "active")
    .order("display_order", { ascending: true })
    .order("price_amount", { ascending: true });

  if (gymId) {
    query.eq("gym_id", gymId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getMembershipPlan(planId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("membership_plans").select("*").eq("id", planId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getMembershipMetrics(gymId: string | null): Promise<MembershipMetrics> {
  const supabase = await createSupabaseServerClient();
  const today = todayDate();
  const weekEnd = formatISO(addDays(new Date(), 7), { representation: "date" });
  const monthEnd = formatISO(addDays(new Date(), 30), { representation: "date" });
  const monthStart = formatISO(startOfMonth(new Date()), { representation: "date" });
  const membersCountQuery = () => {
    let query = supabase.from("members").select("id", { count: "exact", head: true });
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };
  const membershipsCountQuery = () => {
    let query = supabase.from("memberships").select("id", { count: "exact", head: true });
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };

  const [
    totalMembersResult,
    activeMembersResult,
    expiredStatusResult,
    expiredDateResult,
    expiringTodayResult,
    expiringWeekResult,
    expiringMonthResult,
    renewalsThisMonthResult,
    newMembersThisMonthResult
  ] = await Promise.all([
    membersCountQuery(),
    membershipsCountQuery().eq("status", "active"),
    membershipsCountQuery().eq("status", "expired"),
    membershipsCountQuery().neq("status", "expired").lt("end_date", today),
    membershipsCountQuery().in("status", ["active", "frozen"]).eq("end_date", today),
    membershipsCountQuery().in("status", ["active", "frozen"]).gte("end_date", today).lte("end_date", weekEnd),
    membershipsCountQuery().in("status", ["active", "frozen"]).gte("end_date", today).lte("end_date", monthEnd),
    membershipsCountQuery().not("renewal_of_membership_id", "is", null).gte("created_at", `${monthStart}T00:00:00.000Z`),
    membersCountQuery().gte("joined_at", monthStart).lte("joined_at", today)
  ]);

  const firstError = [
    totalMembersResult,
    activeMembersResult,
    expiredStatusResult,
    expiredDateResult,
    expiringTodayResult,
    expiringWeekResult,
    expiringMonthResult,
    renewalsThisMonthResult,
    newMembersThisMonthResult
  ].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    totalMembers: totalMembersResult.count ?? 0,
    activeMembers: activeMembersResult.count ?? 0,
    expiredMembers: (expiredStatusResult.count ?? 0) + (expiredDateResult.count ?? 0),
    expiringToday: expiringTodayResult.count ?? 0,
    expiringThisWeek: expiringWeekResult.count ?? 0,
    expiringThisMonth: expiringMonthResult.count ?? 0,
    renewalsThisMonth: renewalsThisMonthResult.count ?? 0,
    newMembersThisMonth: newMembersThisMonthResult.count ?? 0
  };
}

export async function listMembers(input: ListMembersInput) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const candidateMemberIds = await getFilteredMembershipMemberIds(input);

  let query = supabase
    .from("members")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.gymId) {
    query = query.eq("gym_id", input.gymId);
  }

  if (input.query) {
    const escaped = input.query.replace(/[%_,]/g, "");
    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,member_code.ilike.%${escaped}%`);
  }

  if (input.memberStatus && input.memberStatus !== "all") {
    query = query.eq("status", input.memberStatus as MemberRow["status"]);
  }

  if (candidateMemberIds) {
    if (candidateMemberIds.length === 0) {
      return { members: [], total: 0, page, pageSize };
    }

    query = query.in("id", candidateMemberIds);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const members = data ?? [];
  const enriched = await attachCurrentMemberships(members);

  return {
    members: enriched,
    total: count ?? enriched.length,
    page,
    pageSize
  };
}

export async function getMemberProfile(memberId: string): Promise<MemberProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return null;
  }

  const [membershipsResult, historyResult, documentsResult] = await Promise.all([
    supabase.from("memberships").select("*").eq("member_id", member.id).order("created_at", { ascending: false }),
    supabase.from("membership_history").select("*").eq("member_id", member.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("member_documents").select("*").eq("member_id", member.id).order("created_at", { ascending: false })
  ]);

  if (membershipsResult.error) {
    throw new Error(membershipsResult.error.message);
  }

  if (historyResult.error) {
    throw new Error(historyResult.error.message);
  }

  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }

  const memberships = membershipsResult.data ?? [];
  const planIds = Array.from(new Set(memberships.map((membership) => membership.membership_plan_id)));
  const { data: plans, error: plansError } = planIds.length > 0
    ? await supabase.from("membership_plans").select("*").in("id", planIds)
    : { data: [], error: null };

  if (plansError) {
    throw new Error(plansError.message);
  }

  const plansById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const currentMembership = memberships.find((membership) => ["pending", "active", "frozen", "suspended"].includes(membership.status)) ?? null;

  return {
    member,
    currentMembership,
    currentPlan: currentMembership ? plansById.get(currentMembership.membership_plan_id) ?? null : null,
    memberships,
    plansById,
    history: historyResult.data ?? [],
    documents: documentsResult.data ?? []
  };
}

export async function getMemberDashboard(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("*").eq("user_id", userId).maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return null;
  }

  return getMemberProfile(member.id);
}

export async function getMembershipReportRows(filter: ReportFilter) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("memberships")
    .select("*")
    .order("end_date", { ascending: true });

  if (filter.gymId) {
    query = query.eq("gym_id", filter.gymId);
  }

  if (filter.type === "active") {
    query = query.eq("status", "active");
  }

  if (filter.type === "expired") {
    query = query.eq("status", "expired");
  }

  if (filter.type === "upcoming") {
    query = query.eq("status", "active").gte("end_date", todayDate()).lte("end_date", formatISO(addDays(new Date(), 30), { representation: "date" }));
  }

  const { data: memberships, error } = await query.limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = memberships ?? [];
  const memberIds: string[] = Array.from(new Set(rows.map((membership) => membership.member_id)));
  const planIdsForRows: string[] = Array.from(new Set(rows.map((membership) => membership.membership_plan_id)));

  const [membersResult, plansResult] = await Promise.all([
    memberIds.length > 0 ? supabase.from("members").select("id,member_code,full_name,email,phone").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    planIdsForRows.length > 0 ? supabase.from("membership_plans").select("id,name,plan_type").in("id", planIdsForRows) : Promise.resolve({ data: [], error: null })
  ]);

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (plansResult.error) {
    throw new Error(plansResult.error.message);
  }

  const membersById = new Map((membersResult.data ?? []).map((member) => [member.id, member]));
  const plansById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan]));

  return rows.map((membership) => ({
    membership,
    member: membersById.get(membership.member_id) ?? null,
    plan: plansById.get(membership.membership_plan_id) ?? null
  }));
}

async function getFilteredMembershipMemberIds(input: ListMembersInput) {
  if (
    (!input.membershipStatus || input.membershipStatus === "all") &&
    (!input.planType || input.planType === "all") &&
    (!input.expiry || input.expiry === "all")
  ) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  let planIds: string[] | null = null;

  if (input.planType && input.planType !== "all") {
    let planQuery = supabase.from("membership_plans").select("id").eq("plan_type", input.planType as MembershipPlanRow["plan_type"]);

    if (input.gymId) {
      planQuery = planQuery.eq("gym_id", input.gymId);
    }

    const { data: plans, error } = await planQuery;

    if (error) {
      throw new Error(error.message);
    }

    planIds = (plans ?? []).map((plan) => plan.id);

    if (planIds.length === 0) {
      return [];
    }
  }

  let membershipQuery = supabase.from("memberships").select("member_id,status,end_date,membership_plan_id");

  if (input.gymId) {
    membershipQuery = membershipQuery.eq("gym_id", input.gymId);
  }

  if (input.membershipStatus && input.membershipStatus !== "all") {
    membershipQuery = membershipQuery.eq("status", input.membershipStatus as MembershipRow["status"]);
  }

  if (planIds) {
    membershipQuery = membershipQuery.in("membership_plan_id", planIds);
  }

  if (input.expiry === "today") {
    membershipQuery = membershipQuery.eq("end_date", todayDate());
  }

  if (input.expiry === "week") {
    membershipQuery = membershipQuery.gte("end_date", todayDate()).lte("end_date", formatISO(addDays(new Date(), 7), { representation: "date" }));
  }

  if (input.expiry === "month") {
    membershipQuery = membershipQuery.gte("end_date", todayDate()).lte("end_date", formatISO(addDays(new Date(), 30), { representation: "date" }));
  }

  if (input.expiry === "expired") {
    membershipQuery = membershipQuery.or(`status.eq.expired,end_date.lt.${todayDate()}`);
  }

  const { data, error } = await membershipQuery.limit(10_000);

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(new Set((data ?? []).map((membership) => membership.member_id)));
}

async function attachCurrentMemberships(members: MemberRow[]): Promise<MemberDirectoryItem[]> {
  if (members.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const memberIds = members.map((member) => member.id);
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("*")
    .in("member_id", memberIds)
    .in("status", ["pending", "active", "frozen", "suspended"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const currentByMemberId = new Map<string, MembershipRow>();

  for (const membership of memberships ?? []) {
    if (!currentByMemberId.has(membership.member_id)) {
      currentByMemberId.set(membership.member_id, membership);
    }
  }

  const planIds = Array.from(new Set((memberships ?? []).map((membership) => membership.membership_plan_id)));
  const { data: plans, error: plansError } = planIds.length > 0
    ? await supabase.from("membership_plans").select("*").in("id", planIds)
    : { data: [], error: null };

  if (plansError) {
    throw new Error(plansError.message);
  }

  const plansById = new Map((plans ?? []).map((plan) => [plan.id, plan]));

  return members.map((member) => {
    const currentMembership = currentByMemberId.get(member.id) ?? null;

    return {
      ...member,
      current_membership: currentMembership,
      current_plan: currentMembership ? plansById.get(currentMembership.membership_plan_id) ?? null : null
    };
  });
}

function todayDate() {
  return formatISO(new Date(), { representation: "date" });
}
