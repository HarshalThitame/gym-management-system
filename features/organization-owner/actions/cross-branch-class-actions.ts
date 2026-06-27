"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOrgFeatureAccess } from "@/features/entitlement";

export type CrossBranchClassRule = {
  id: string;
  organization_id: string;
  name: string;
  from_gym_id: string | null;
  to_gym_id: string;
  is_allowed: boolean;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CrossBranchClassBooking = {
  id: string;
  session_id: string;
  member_id: string;
  member_name: string;
  from_gym_id: string;
  from_gym_name: string;
  to_gym_id: string;
  to_gym_name: string;
  class_id: string;
  session_date: string;
  status: string;
  created_at: string;
};

export type CrossBranchClassSummary = {
  totalBookings: number;
  todayBookings: number;
  activeRules: number;
  classesAvailable: number;
  fromGyms: string[];
  toGyms: string[];
};

export async function getCrossBranchClassSummary(organizationId: string): Promise<CrossBranchClassSummary> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("organization_id", organizationId);
  const gymIds = (gyms ?? []).map((g) => g.id);

  if (gymIds.length === 0) {
    return { totalBookings: 0, todayBookings: 0, activeRules: 0, classesAvailable: 0, fromGyms: [], toGyms: [] };
  }

  const today = new Date().toISOString().slice(0, 10);

  const [bookingsResult, todayBookingsResult, rulesResult, classesResult] = await Promise.all([
    supabase.from("class_bookings").select("id, session_id, member_id, gym_id, created_at, class_sessions!inner(gym_id, session_date, class_id)").in("gym_id", gymIds).in("status", ["booked", "checked_in", "attended"]),
    supabase.from("class_bookings").select("id", { count: "exact", head: true }).in("gym_id", gymIds).in("status", ["booked", "checked_in", "attended"]).gte("created_at", `${today}T00:00:00.000Z`).lte("created_at", `${today}T23:59:59.999Z`),
    supabase.from("cross_branch_class_booking_rules").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("class_sessions").select("id", { count: "exact", head: true }).in("gym_id", gymIds).gte("session_date", today).eq("status", "scheduled"),
  ]);

  const bookings = bookingsResult.data ?? [];
  const memberIds = [...new Set(bookings.map((b) => b.member_id).filter(Boolean))];
  let crossBranchCount = 0;
  const fromGymSet = new Set<string>();
  const toGymSet = new Set<string>();

  if (memberIds.length > 0 && bookings.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, gym_id")
      .in("id", memberIds);
    const memberGymMap = new Map((members ?? []).map((m) => [m.id, m.gym_id]));

    for (const b of bookings) {
      const memberGymId = memberGymMap.get(b.member_id);
      const sessionGymId = (b.class_sessions as unknown as { gym_id: string }).gym_id;
      if (memberGymId && sessionGymId && memberGymId !== sessionGymId) {
        crossBranchCount++;
        if (memberGymId) fromGymSet.add(memberGymId);
        if (sessionGymId) toGymSet.add(sessionGymId);
      }
    }
  }

  return {
    totalBookings: crossBranchCount,
    todayBookings: todayBookingsResult.count ?? 0,
    activeRules: rulesResult.count ?? 0,
    classesAvailable: classesResult.count ?? 0,
    fromGyms: Array.from(fromGymSet),
    toGyms: Array.from(toGymSet),
  };
}

export async function getCrossBranchClassBookings(
  organizationId: string,
  filters?: { page?: number; pageSize?: number; gymId?: string; dateFrom?: string; dateTo?: string }
): Promise<{ bookings: CrossBranchClassBooking[]; total: number }> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("organization_id", organizationId);
  const gymsMap = new Map((gyms ?? []).map((g) => [g.id, g.name]));
  const gymIds = (gyms ?? []).map((g) => g.id);

  if (gymIds.length === 0) {
    return { bookings: [], total: 0 };
  }

  const targetGymIds = filters?.gymId && filters.gymId !== "all" ? [filters.gymId] : gymIds;

  let query = supabase
    .from("class_bookings")
    .select("id, session_id, member_id, gym_id, status, created_at, class_sessions!inner(gym_id, session_date, class_id)", { count: "exact" })
    .in("gym_id", targetGymIds)
    .in("status", ["booked", "checked_in", "attended"]);

  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

  const { data: bookings, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);

  const bookingRows = bookings ?? [];
  const memberIds = [...new Set(bookingRows.map((b) => b.member_id).filter(Boolean))];

  const memberGymMap = new Map<string, string>();
  const memberNameMap = new Map<string, string>();

  if (memberIds.length > 0) {
    const membersResult = await supabase.from("members").select("id, gym_id, full_name").in("id", memberIds);
    const profilesResult = await supabase.from("profiles").select("id, full_name").in("id", memberIds);
    for (const m of (membersResult.data ?? [])) {
      if (m.gym_id) memberGymMap.set(m.id, m.gym_id);
      if (m.full_name) memberNameMap.set(m.id, m.full_name);
    }
    for (const p of (profilesResult.data ?? [])) {
      if (!memberNameMap.has(p.id) && p.full_name) memberNameMap.set(p.id, p.full_name);
    }
  }

  const results: CrossBranchClassBooking[] = [];

  for (const b of bookingRows) {
    const memberGymId = memberGymMap.get(b.member_id);
    const sessionData = b.class_sessions as unknown as { gym_id: string; session_date: string; class_id: string };
    const sessionGymId = sessionData?.gym_id;

    if (memberGymId && sessionGymId && memberGymId !== sessionGymId) {
      results.push({
        id: b.id,
        session_id: b.session_id,
        member_id: b.member_id,
        member_name: memberNameMap.get(b.member_id) ?? "Unknown",
        from_gym_id: memberGymId,
        from_gym_name: gymsMap.get(memberGymId) ?? "Unknown",
        to_gym_id: sessionGymId,
        to_gym_name: gymsMap.get(sessionGymId) ?? "Unknown",
        class_id: sessionData?.class_id ?? "",
        session_date: sessionData?.session_date ?? "",
        status: b.status,
        created_at: b.created_at,
      });
    }
  }

  return { bookings: results, total: count ?? 0 };
}

export async function getCrossBranchClassRules(
  organizationId: string
): Promise<CrossBranchClassRule[]> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("cross_branch_class_booking_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("priority", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCrossBranchClassRule(
  organizationId: string,
  input: { name: string; fromGymId?: string | null; toGymId: string; isAllowed?: boolean; priority?: number }
): Promise<CrossBranchClassRule> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("cross_branch_class_booking_rules")
    .insert({
      organization_id: organizationId,
      name: input.name,
      from_gym_id: input.fromGymId ?? null,
      to_gym_id: input.toGymId,
      is_allowed: input.isAllowed ?? true,
      priority: input.priority ?? 0,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCrossBranchClassRule(
  organizationId: string,
  ruleId: string,
  input: { name?: string; fromGymId?: string | null; toGymId?: string; isAllowed?: boolean; isActive?: boolean; priority?: number }
): Promise<CrossBranchClassRule> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) update.name = input.name;
  if (input.fromGymId !== undefined) update.from_gym_id = input.fromGymId ?? null;
  if (input.toGymId !== undefined) update.to_gym_id = input.toGymId;
  if (input.isAllowed !== undefined) update.is_allowed = input.isAllowed;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  if (input.priority !== undefined) update.priority = input.priority;

  const { data, error } = await supabase
    .from("cross_branch_class_booking_rules")
    .update(update)
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCrossBranchClassRule(
  organizationId: string,
  ruleId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { error } = await supabase
    .from("cross_branch_class_booking_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function getAvailableCrossBranchClasses(
  organizationId: string
): Promise<{ gymId: string; gymName: string; availableClasses: number; upcomingSessions: number }[]> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_class_booking");

  const supabase: SupabaseClient = await createSupabaseServerClient() as unknown as SupabaseClient;
  const today = new Date().toISOString().slice(0, 10);

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const gymList = gyms ?? [];
  const result: { gymId: string; gymName: string; availableClasses: number; upcomingSessions: number }[] = [];

  for (const gym of gymList) {
    const { count: sessionsCount } = await supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .gte("session_date", today)
      .eq("status", "scheduled");

    const { count: distinctClasses } = await supabase
      .from("class_sessions")
      .select("class_id", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .gte("session_date", today)
      .eq("status", "scheduled");

    result.push({
      gymId: gym.id,
      gymName: gym.name,
      availableClasses: distinctClasses ?? 0,
      upcomingSessions: sessionsCount ?? 0,
    });
  }

  return result;
}
