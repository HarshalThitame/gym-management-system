import { addDays, endOfDay, formatISO, startOfDay } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyReceptionScopeFilters } from "@/features/reception/lib/operation-guards";
import type { AppointmentDashboard, AppointmentRow, AppointmentWithDetails } from "@/types/appointments";

type AppointmentScope = {
  branchId?: string | null;
  organizationId?: string | null;
};

export async function getAppointmentDashboard(gymId: string, scope: AppointmentScope = {}): Promise<AppointmentDashboard> {
  const supabase = await createSupabaseServerClient();
  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekEnd = endOfDay(addDays(new Date(), 7));
  const todayISO = formatISO(today);
  const todayEndISO = formatISO(todayEnd);
  const weekEndISO = formatISO(weekEnd);

  const [
    todayResult,
    upcomingResult,
    recentResult,
    pendingConfirmationsResult,
    completedResult,
    cancelledResult,
    noShowResult
  ] = await Promise.all([
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("*"), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .gte("starts_at", todayISO)
      .lte("starts_at", todayEndISO)
      .order("starts_at", { ascending: true })
      .limit(50),
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("*"), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", todayEndISO)
      .lte("starts_at", weekEndISO)
      .order("starts_at", { ascending: true })
      .limit(30),
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("*"), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .order("created_at", { ascending: false })
      .limit(10),
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .eq("status", "scheduled")
      .gte("starts_at", todayISO),
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .eq("status", "completed")
      .gte("starts_at", todayISO)
      .lte("starts_at", todayEndISO),
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .eq("status", "cancelled")
      .gte("starts_at", todayISO)
      .lte("starts_at", todayEndISO),
    applyReceptionScopeFilters(supabase
      .from("appointments")
      .select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
      .eq("status", "no_show")
      .gte("starts_at", todayISO)
      .lte("starts_at", todayEndISO)
  ]);

  const firstError = [todayResult, upcomingResult, recentResult, pendingConfirmationsResult, completedResult, cancelledResult, noShowResult]
    .find((r) => r.error)?.error;

  if (firstError) throw new Error(firstError.message);

  const today = await attachAppointmentDetails((todayResult.data ?? []) as AppointmentRow[]);
  const upcoming = await attachAppointmentDetails((upcomingResult.data ?? []) as AppointmentRow[]);
  const recent = await attachAppointmentDetails((recentResult.data ?? []) as AppointmentRow[]);

  return {
    metrics: {
      todayAppointments: today.length,
      todayCompleted: completedResult.count ?? 0,
      todayCancelled: cancelledResult.count ?? 0,
      todayNoShows: noShowResult.count ?? 0,
      upcomingAppointments: upcomingResult.count ?? 0,
      pendingConfirmations: pendingConfirmationsResult.count ?? 0
    },
    today,
    upcoming,
    recent
  };
}

export async function listAppointments(input: {
  gymId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
  trainerId?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("appointments")
    .select("*", { count: "exact" })
    .eq("gym_id", input.gymId)
    .order("starts_at", { ascending: false })
    .range(from, to);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  if (input.type && input.type !== "all") {
    query = query.eq("type", input.type);
  }

  if (input.memberId) {
    query = query.eq("member_id", input.memberId);
  }

  if (input.trainerId) {
    query = query.eq("trainer_id", input.trainerId);
  }

  if (input.dateFrom) {
    query = query.gte("starts_at", input.dateFrom);
  }

  if (input.dateTo) {
    query = query.lte("starts_at", input.dateTo);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AppointmentRow[];
  const appointments = await attachAppointmentDetails(rows);

  return { appointments, total: count ?? 0, page, pageSize };
}

export async function getMemberAppointments(memberId: string, gymId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .order("starts_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return attachAppointmentDetails((data ?? []) as AppointmentRow[]);
}

async function attachAppointmentDetails(appointments: AppointmentRow[]): Promise<AppointmentWithDetails[]> {
  if (appointments.length === 0) return [];

  const memberIds = [...new Set(appointments.map((a) => a.member_id).filter(Boolean))];
  const trainerIds = [...new Set(appointments.map((a) => a.trainer_id).filter(Boolean))];

  const supabase = await createSupabaseServerClient();

  const [membersResult, trainersResult] = await Promise.all([
    memberIds.length > 0
      ? supabase.from("members").select("id, full_name, phone, email, member_code").in("id", memberIds)
      : { data: [], error: null },
    trainerIds.length > 0
      ? supabase.from("trainers").select("id, display_name, employee_code").in("id", trainerIds)
      : { data: [], error: null }
  ]);

  const memberMap = new Map((membersResult.data ?? []).map((m) => [m.id, m]));
  const trainerMap = new Map((trainersResult.data ?? []).map((t) => [t.id, t]));

  return appointments.map((appointment) => ({
    ...appointment,
    member: memberMap.get(appointment.member_id) ?? null,
    trainer: trainerMap.get(appointment.trainer_id ?? "") ?? null
  }));
}
