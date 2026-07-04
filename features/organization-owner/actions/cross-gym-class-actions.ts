"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrgFeatureAccess } from "@/features/entitlement";
import { getOrgOwnerContext } from "./action-utils";

export type CrossGymClassRule = {
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

export type CrossGymClassBooking = {
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

export type CrossGymClassSummary = {
  totalBookings: number;
  todayBookings: number;
  activeRules: number;
  classesAvailable: number;
  fromGyms: string[];
  toGyms: string[];
};

const BASE_PATH = "/organization/classes";

async function requireCrossGymClassAccess(organizationId: string) {
  const ctx = await getOrgOwnerContext(BASE_PATH);
  const scoped = await requireOrgFeatureAccess(ctx.organizationId, "cross_branch_class_booking");

  if (organizationId !== scoped.organizationId) {
    throw new Error("Organization scope mismatch.");
  }

  return scoped.organizationId;
}

async function assertGymsBelongToOrganization(
  db: { from(table: string): any },
  organizationId: string,
  gymIds: Array<string | null | undefined>,
) {
  const uniqueGymIds = [...new Set(gymIds.filter((gymId): gymId is string => Boolean(gymId)))];
  if (uniqueGymIds.length === 0) return;

  const { data, error } = await db
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", uniqueGymIds);

  if (error) throw new Error(error.message);

  if ((data ?? []).length !== uniqueGymIds.length) {
    throw new Error("Selected gyms must belong to your organization.");
  }
}

export async function getCrossGymClassSummary(organizationId: string): Promise<CrossGymClassSummary> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const db = await createSupabaseServerClient() as any;

  const { data: gyms } = await db
    .from("gyms")
    .select("id, name")
    .eq("organization_id", scopedOrganizationId);
  const gymIds = ((gyms ?? []) as { id: string }[]).map((g) => g.id);

  if (gymIds.length === 0) {
    return { totalBookings: 0, todayBookings: 0, activeRules: 0, classesAvailable: 0, fromGyms: [], toGyms: [] };
  }

  const today = new Date().toISOString().slice(0, 10);

  const [bookingsResult, todayBookingsResult, rulesResult, classesResult] = await Promise.all([
    db.from("class_bookings").select("id, session_id, member_id, gym_id, created_at, class_sessions!inner(gym_id, session_date, class_id)").in("gym_id", gymIds).in("status", ["booked", "checked_in", "attended"]),
    db.from("class_bookings").select("id", { count: "exact", head: true }).in("gym_id", gymIds).in("status", ["booked", "checked_in", "attended"]).gte("created_at", `${today}T00:00:00.000Z`).lte("created_at", `${today}T23:59:59.999Z`),
    db.from("cross_branch_class_booking_rules").select("id", { count: "exact", head: true }).eq("organization_id", scopedOrganizationId).eq("is_active", true),
    db.from("class_sessions").select("id", { count: "exact", head: true }).in("gym_id", gymIds).gte("session_date", today).eq("status", "scheduled"),
  ]);

  const bookings = bookingsResult.data ?? [];
  const memberIds = [...new Set(bookings.map((b: any) => b.member_id).filter(Boolean))];
  let crossGymCount = 0;
  const fromGymSet = new Set<string>();
  const toGymSet = new Set<string>();

  if (memberIds.length > 0 && bookings.length > 0) {
    const { data: members } = await db
      .from("members")
      .select("id, gym_id")
      .in("id", memberIds);
    const memberGymMap = new Map<string, string>((members ?? []).map((m: any) => [m.id as string, m.gym_id as string]));

    for (const b of bookings as Array<Record<string, unknown>>) {
      const memberGymId = memberGymMap.get(b.member_id as string);
      const sessionGymId = ((b.class_sessions as unknown as Record<string, unknown>)?.gym_id as string | undefined);
      if (memberGymId && sessionGymId && memberGymId !== sessionGymId) {
        crossGymCount++;
        if (memberGymId) fromGymSet.add(memberGymId);
        if (sessionGymId) toGymSet.add(sessionGymId);
      }
    }
  }

  return {
    totalBookings: crossGymCount,
    todayBookings: todayBookingsResult.count ?? 0,
    activeRules: rulesResult.count ?? 0,
    classesAvailable: classesResult.count ?? 0,
    fromGyms: Array.from(fromGymSet),
    toGyms: Array.from(toGymSet),
  };
}

export async function getCrossGymClassBookings(
  organizationId: string,
  filters?: { page?: number; pageSize?: number; gymId?: string; dateFrom?: string; dateTo?: string }
): Promise<{ bookings: CrossGymClassBooking[]; total: number }> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const db = await createSupabaseServerClient() as any;
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  const { data: gyms } = await db
    .from("gyms")
    .select("id, name")
    .eq("organization_id", scopedOrganizationId);
  const gymsMap = new Map<string, string>((gyms ?? []).map((g: any) => [g.id as string, g.name as string]));
  const gymIds = (gyms ?? []).map((g: any) => g.id);

  if (gymIds.length === 0) {
    return { bookings: [], total: 0 };
  }

  if (filters?.gymId && filters.gymId !== "all" && !gymIds.includes(filters.gymId)) {
    return { bookings: [], total: 0 };
  }

  const targetGymIds = filters?.gymId && filters.gymId !== "all" ? [filters.gymId] : gymIds;

  let query = db
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
  const memberIds = [...new Set(bookingRows.map((b: any) => b.member_id).filter(Boolean))];

  const memberGymMap = new Map<string, string>();
  const memberNameMap = new Map<string, string>();

  if (memberIds.length > 0) {
    const membersResult = await db.from("members").select("id, gym_id, full_name").in("id", memberIds);
    const profilesResult = await db.from("profiles").select("id, full_name").in("id", memberIds);
    for (const m of (membersResult.data ?? []) as Array<Record<string, unknown>>) {
      if (m.gym_id) memberGymMap.set(m.id as string, m.gym_id as string);
      if (m.full_name) memberNameMap.set(m.id as string, m.full_name as string);
    }
    for (const p of (profilesResult.data ?? []) as Array<Record<string, unknown>>) {
      if (!memberNameMap.has(p.id as string) && p.full_name) memberNameMap.set(p.id as string, p.full_name as string);
    }
  }

  const results: CrossGymClassBooking[] = [];

  for (const b of bookingRows as Array<Record<string, unknown>>) {
    const memberGymId = memberGymMap.get(b.member_id as string);
    const sessionData = b.class_sessions as unknown as { gym_id: string; session_date: string; class_id: string };
    const sessionGymId = sessionData?.gym_id;

    if (memberGymId && sessionGymId && memberGymId !== sessionGymId) {
      const mgId: string = memberGymId;
      const sgId: string = sessionGymId;
      results.push({
        id: b.id as string,
        session_id: b.session_id as string,
        member_id: b.member_id as string,
        member_name: memberNameMap.get(b.member_id as string) ?? "Unknown",
        from_gym_id: mgId,
        from_gym_name: gymsMap.get(mgId) ?? "Unknown",
        to_gym_id: sgId,
        to_gym_name: gymsMap.get(sgId) ?? "Unknown",
        class_id: sessionData?.class_id ?? "",
        session_date: sessionData?.session_date ?? "",
        status: b.status as string,
        created_at: b.created_at as string,
      });
    }
  }

  return { bookings: results, total: count ?? 0 };
}

export async function getCrossGymClassRules(
  organizationId: string
): Promise<CrossGymClassRule[]> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const db = await createSupabaseServerClient() as any;
  const { data, error } = await db
    .from("cross_branch_class_booking_rules")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .order("priority", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCrossGymClassRule(
  organizationId: string,
  input: { name: string; fromGymId?: string | null; toGymId: string; isAllowed?: boolean; priority?: number }
): Promise<CrossGymClassRule> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) throw new Error("Server configuration error.");
  const client = adminClient as any;
  await assertGymsBelongToOrganization(client, scopedOrganizationId, [input.fromGymId, input.toGymId]);
  const { data, error } = await client
    .from("cross_branch_class_booking_rules")
    .insert({
      organization_id: scopedOrganizationId,
      name: input.name,
      from_gym_id: input.fromGymId ?? null,
      to_gym_id: input.toGymId,
      is_allowed: input.isAllowed ?? true,
      priority: input.priority ?? 0,
      is_active: true,
    })
    .select("*")
    .single() as { data: CrossGymClassRule; error: unknown };

  if (error) throw new Error(String(error));
  return data;
}

export async function updateCrossGymClassRule(
  organizationId: string,
  ruleId: string,
  input: { name?: string; fromGymId?: string | null; toGymId?: string; isAllowed?: boolean; isActive?: boolean; priority?: number }
): Promise<CrossGymClassRule> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) throw new Error("Server configuration error.");
  const client = adminClient as any;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) update.name = input.name;
  if (input.fromGymId !== undefined) update.from_gym_id = input.fromGymId ?? null;
  if (input.toGymId !== undefined) update.to_gym_id = input.toGymId;
  if (input.isAllowed !== undefined) update.is_allowed = input.isAllowed;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  if (input.priority !== undefined) update.priority = input.priority;

  await assertGymsBelongToOrganization(client, scopedOrganizationId, [input.fromGymId, input.toGymId]);

  const { data, error } = await client
    .from("cross_branch_class_booking_rules")
    .update(update)
    .eq("id", ruleId)
    .eq("organization_id", scopedOrganizationId)
    .select("*")
    .single() as { data: CrossGymClassRule; error: unknown };

  if (error) throw new Error(String(error));
  return data;
}

export async function deleteCrossGymClassRule(
  organizationId: string,
  ruleId: string
): Promise<void> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) throw new Error("Server configuration error.");
  const client = adminClient as any;
  const { error } = await client
    .from("cross_branch_class_booking_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", scopedOrganizationId) as { error: unknown };

  if (error) throw new Error(String(error));
}

export async function getAvailableCrossGymClasses(
  organizationId: string
): Promise<{ gymId: string; gymName: string; availableClasses: number; upcomingSessions: number }[]> {
  const scopedOrganizationId = await requireCrossGymClassAccess(organizationId);

  const db = await createSupabaseServerClient() as any;
  const today = new Date().toISOString().slice(0, 10);

  const { data: gyms } = await db
    .from("gyms")
    .select("id, name")
    .eq("organization_id", scopedOrganizationId)
    .eq("status", "active");

  const gymList = gyms ?? [];
  const result: { gymId: string; gymName: string; availableClasses: number; upcomingSessions: number }[] = [];

  for (const gym of gymList) {
    const { count: sessionsCount } = await db
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .gte("session_date", today)
      .eq("status", "scheduled");

    const { count: distinctClasses } = await db
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
