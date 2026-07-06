import { addDays, differenceInCalendarDays, formatISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import QRCode from "qrcode";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceDashboardData, MemberAttendancePortal, QrTokenRow, TrainerAttendanceView } from "@/types/attendance";
import type { MemberRow, MembershipRow } from "@/types/membership";
import type { TrainerAssignmentRow } from "@/types/training";
import {
  buildQrPayload,
  calculateCurrentStreak,
  formatHourLabel,
  generateQrTokenValue,
  getInactiveBucket,
  hashQrToken,
  isVisitInCurrentMonth
} from "../lib/business-rules";
import { getGeofenceRadiusMeters, isGeofenceEnabled } from "../lib/geofence";

type AttendanceReportFilter = {
  gymId: string | null;
  type: "daily" | "weekly" | "monthly" | "custom" | "exceptions";
  from?: string | undefined;
  to?: string | undefined;
};

const SYNC_ATTENDANCE_REPORT_ROW_LIMIT = 2_000;

export async function listAccessDevices(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("access_devices").select("*").order("name", { ascending: true });

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getAttendanceDashboard(gymId: string | null): Promise<AttendanceDashboardData> {
  const supabase = await createSupabaseServerClient();
  const sessionsBase = () => {
    let query = supabase.from("attendance_sessions").select("*");
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };
  const hourlyBase = () => {
    let query = supabase.from("attendance_hourly_traffic").select("*");
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };
  const dailyBase = () => {
    let query = supabase.from("attendance_daily_summary").select("*");
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };
  const alertsBase = () => {
    let query = supabase.from("attendance_alerts").select("*");
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };
  const frequencyBase = () => {
    let query = supabase.from("attendance_member_frequency").select("*");
    if (gymId) {
      query = query.eq("gym_id", gymId);
    }
    return query;
  };
  const today = formatISO(new Date(), { representation: "date" });
  const weekStart = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), { representation: "date" });
  const monthStart = formatISO(startOfMonth(new Date()), { representation: "date" });
  const last14Days = formatISO(subDays(new Date(), 14), { representation: "date" });

  const [
    todayResult,
    weekResult,
    monthResult,
    currentResult,
    recentResult,
    hourlyResult,
    dailyResult,
    alertsResult,
    frequencyResult
  ] = await Promise.all([
    sessionsBase().gte("check_in_at", `${today}T00:00:00.000Z`).lte("check_in_at", `${today}T23:59:59.999Z`),
    sessionsBase().gte("check_in_at", `${weekStart}T00:00:00.000Z`),
    sessionsBase().gte("check_in_at", `${monthStart}T00:00:00.000Z`),
    sessionsBase().eq("status", "inside").order("check_in_at", { ascending: false }),
    sessionsBase().order("check_in_at", { ascending: false }).limit(30),
    hourlyBase().eq("attendance_date", today).order("hour_of_day", { ascending: true }),
    dailyBase().gte("attendance_date", last14Days).order("attendance_date", { ascending: true }),
    alertsBase().eq("status", "open").order("created_at", { ascending: false }).limit(10),
    frequencyBase()
  ]);

  const results = [todayResult, weekResult, monthResult, currentResult, recentResult, hourlyResult, dailyResult, alertsResult, frequencyResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const todaySessions = todayResult.data ?? [];
  const weekSessions = weekResult.data ?? [];
  const monthSessions = monthResult.data ?? [];
  const currentSessions = currentResult.data ?? [];
  const recentSessions = recentResult.data ?? [];
  const memberIds = Array.from(new Set([...currentSessions.map((session) => session.member_id), ...recentSessions.map((session) => session.member_id)]));
  const membersById = await getMembersById(memberIds);
  const durations = monthSessions.map((session) => session.duration_minutes).filter((value): value is number => typeof value === "number");
  const averageDuration = durations.length > 0 ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length) : 0;
  const hourlyTraffic = (hourlyResult.data ?? []).map((row) => ({ hour: formatHourLabel(row.hour_of_day ?? 0), visits: row.check_in_count ?? 0 }));
  const peakHourRow = [...hourlyTraffic].sort((a, b) => b.visits - a.visits)[0] ?? null;
  const frequencyRows = frequencyResult.data ?? [];
  const inactiveMembers = frequencyRows
    .map((row) => ({
      id: row.member_id ?? "",
      member_code: row.member_code ?? "",
      full_name: row.full_name ?? "",
      phone: "",
      lastVisitAt: row.last_visit_at,
      inactiveDays: row.last_visit_at ? differenceInCalendarDays(new Date(), new Date(row.last_visit_at)) : 999
    }))
    .filter((row) => row.id && row.inactiveDays >= 7)
    .slice(0, 12);

  return {
    metrics: {
      todayCheckIns: todaySessions.length,
      currentInside: currentSessions.length,
      dailyAttendance: todaySessions.length,
      weeklyAttendance: weekSessions.length,
      monthlyAttendance: monthSessions.length,
      averageDuration,
      peakHour: peakHourRow ? Number(peakHourRow.hour.slice(0, 2)) : null,
      capacityPercentage: Math.min(Math.round((currentSessions.length / 120) * 100), 100),
      inactive7Days: frequencyRows.filter((row) => getInactiveBucket(row.last_visit_at) === "inactive_7_days").length,
      inactive15Days: frequencyRows.filter((row) => getInactiveBucket(row.last_visit_at) === "inactive_15_days").length,
      inactive30Days: frequencyRows.filter((row) => getInactiveBucket(row.last_visit_at) === "inactive_30_days").length
    },
    currentSessions: currentSessions.map((session) => ({ ...session, member: pickMember(membersById.get(session.member_id)) })),
    recentSessions: recentSessions.map((session) => ({ ...session, member: pickMember(membersById.get(session.member_id)) })),
    hourlyTraffic,
    dailyTrend: (dailyResult.data ?? []).map((row) => ({
      date: row.attendance_date ?? "",
      visits: row.total_check_ins ?? 0,
      uniqueMembers: row.unique_members ?? 0
    })),
    alerts: alertsResult.data ?? [],
    inactiveMembers
  };
}

export async function getMemberAttendancePortal(userId: string): Promise<MemberAttendancePortal | null> {
  const supabase = await createSupabaseServerClient();
  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const member = members?.[0] ?? null;

  if (!member) {
    return null;
  }

  const [token, visitsResult, activeSessionResult] = await Promise.all([
    ensureActiveQrToken(member, userId),
    supabase.from("attendance_sessions").select("*").eq("member_id", member.id).order("check_in_at", { ascending: false }).limit(80),
    supabase.from("attendance_sessions").select("*").eq("member_id", member.id).eq("status", "inside").order("check_in_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  if (visitsResult.error) {
    throw new Error(visitsResult.error.message);
  }

  if (activeSessionResult.error) {
    throw new Error(activeSessionResult.error.message);
  }

  const visits = visitsResult.data ?? [];
  const activeSession = activeSessionResult.data ?? null;
  const resolvedBranchId = member.branch_id ?? activeSession?.branch_id ?? null;
  const locationTracking = resolvedBranchId
    ? await getMemberLocationTracking(resolvedBranchId)
    : {
        activeSessionId: activeSession?.id ?? null,
        branchId: null,
        branchName: null,
        enabled: false,
        radiusMeters: 150,
        coordinatesConfigured: false
      };
  const durations = visits.map((visit) => visit.duration_minutes).filter((value): value is number => typeof value === "number");
  const qrPayload = token ? buildQrPayload(token.token_value) : "";
  const qrSvg = qrPayload ? await QRCode.toString(qrPayload, { type: "svg", margin: 2, width: 240, color: { dark: "#111315", light: "#ffffff" } }) : "";

  return {
    member,
    qrToken: token,
    qrSvg,
    qrPayload,
    activeSession,
    locationTracking: {
      ...locationTracking,
      activeSessionId: activeSession?.id ?? null
    },
    metrics: {
      attendanceCount: visits.length,
      lastVisitAt: visits[0]?.check_in_at ?? null,
      currentStreak: calculateCurrentStreak(visits.map((visit) => visit.check_in_at)),
      monthlyVisits: visits.filter((visit) => isVisitInCurrentMonth(visit.check_in_at)).length,
      averageDuration: durations.length > 0 ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length) : 0
    },
    visits
  };
}

async function getMemberLocationTracking(branchId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: branch }, { data: settingsRow }] = await Promise.all([
    supabase.from("branches").select("id, name, latitude, longitude").eq("id", branchId).maybeSingle(),
    supabase.from("branch_settings").select("attendance_settings").eq("branch_id", branchId).maybeSingle()
  ]);

  const attendanceSettings = settingsRow?.attendance_settings ?? {};
  const enabled = isGeofenceEnabled(attendanceSettings);
  const radiusMeters = getGeofenceRadiusMeters(attendanceSettings);
  const coordinatesConfigured = branch?.latitude !== null && branch?.longitude !== null;

  return {
    branchId: branch?.id ?? branchId,
    branchName: branch?.name ?? null,
    enabled: enabled && coordinatesConfigured,
    radiusMeters,
    coordinatesConfigured
  };
}

export async function getTrainerAttendanceView(userId: string, gymId: string | null): Promise<TrainerAttendanceView> {
  const supabase = await createSupabaseServerClient();
  let trainerQuery = supabase.from("trainers").select("*").eq("user_id", userId);

  if (gymId) {
    trainerQuery = trainerQuery.eq("gym_id", gymId);
  }

  const { data: trainer, error: trainerError } = await trainerQuery.maybeSingle();

  if (trainerError) {
    throw new Error(trainerError.message);
  }

  if (!trainer) {
    return { assignedMembers: [], hourlyTraffic: [] };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("trainer_assignments")
    .select("*")
    .eq("trainer_id", trainer.id)
    .eq("status", "active");

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const memberIds = (assignments ?? []).map((assignment: TrainerAssignmentRow) => assignment.member_id);
  if (memberIds.length === 0) {
    return { assignedMembers: [], hourlyTraffic: [] };
  }

  const [membersById, sessionsResult] = await Promise.all([
    getMembersById(memberIds),
    supabase.from("attendance_sessions").select("*").in("member_id", memberIds).order("check_in_at", { ascending: false }).limit(1000)
  ]);

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message);
  }

  const sessions = sessionsResult.data ?? [];
  const assignedMembers = memberIds
    .map((memberId) => {
      const member = membersById.get(memberId);
      if (!member) {
        return null;
      }
      const memberSessions = sessions.filter((session) => session.member_id === member.id);
      const lastVisit = memberSessions[0]?.check_in_at ?? null;
      const durations = memberSessions.map((session) => session.duration_minutes).filter((value): value is number => typeof value === "number");
      return {
        id: member.id,
        member_code: member.member_code,
        full_name: member.full_name,
        phone: member.phone,
        visitCount: memberSessions.length,
        lastVisitAt: lastVisit,
        averageDuration: durations.length > 0 ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length) : 0,
        inactiveDays: lastVisit ? differenceInCalendarDays(new Date(), new Date(lastVisit)) : 999
      };
    })
    .filter((member): member is TrainerAttendanceView["assignedMembers"][number] => Boolean(member));

  const hourlyCounts = new Map<number, number>();
  for (const session of sessions) {
    const hour = new Date(session.check_in_at).getHours();
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
  }

  return {
    assignedMembers,
    hourlyTraffic: Array.from({ length: 24 }, (_, hour) => ({ hour: formatHourLabel(hour), visits: hourlyCounts.get(hour) ?? 0 }))
  };
}

export async function getAttendanceReportRows(filter: AttendanceReportFilter) {
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  if (filter.type === "exceptions") {
    let query = supabase.from("access_logs").select("*").eq("decision", "denied").order("occurred_at", { ascending: false }).limit(SYNC_ATTENDANCE_REPORT_ROW_LIMIT);
    if (filter.gymId) {
      query = query.eq("gym_id", filter.gymId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return { type: "exceptions" as const, rows: data ?? [] };
  }

  let query = supabase.from("attendance_sessions").select("*").order("check_in_at", { ascending: false }).limit(SYNC_ATTENDANCE_REPORT_ROW_LIMIT);
  if (filter.gymId) {
    query = query.eq("gym_id", filter.gymId);
  }

  if (filter.type === "daily") {
    query = query.gte("check_in_at", `${formatISO(now, { representation: "date" })}T00:00:00.000Z`);
  }
  if (filter.type === "weekly") {
    query = query.gte("check_in_at", `${formatISO(startOfWeek(now, { weekStartsOn: 1 }), { representation: "date" })}T00:00:00.000Z`);
  }
  if (filter.type === "monthly") {
    query = query.gte("check_in_at", `${formatISO(startOfMonth(now), { representation: "date" })}T00:00:00.000Z`);
  }
  if (filter.type === "custom" && filter.from) {
    query = query.gte("check_in_at", `${filter.from}T00:00:00.000Z`);
  }
  if (filter.type === "custom" && filter.to) {
    query = query.lte("check_in_at", `${filter.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return { type: "sessions" as const, rows: data ?? [] };
}

export async function ensureActiveQrToken(member: MemberRow, actorId: string | null): Promise<QrTokenRow | null> {
  const supabase = await createSupabaseServerClient();
  const writeClient = getSupabaseAdminClient() ?? supabase;
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("qr_tokens")
    .select("*")
    .eq("member_id", member.id)
    .eq("purpose", "attendance")
    .eq("status", "active")
    .gt("expires_at", now)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  await writeClient
    .from("qr_tokens")
    .update({ status: "expired" })
    .eq("member_id", member.id)
    .eq("purpose", "attendance")
    .eq("status", "active");

  const tokenValue = generateQrTokenValue();
  const { data, error } = await writeClient
    .from("qr_tokens")
    .insert({
      gym_id: member.gym_id,
      member_id: member.id,
      token_value: tokenValue,
      token_hash: hashQrToken(tokenValue),
      expires_at: addDays(new Date(), 90).toISOString(),
      created_by: actorId
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getMembersById(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, MemberRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("members").select("*").in("id", memberIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((member) => [member.id, member]));
}

export async function getActiveMembershipForMember(memberId: string): Promise<MembershipRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("member_id", memberId)
    .in("status", ["pending", "active", "frozen", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function pickMember(member?: MemberRow) {
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    member_code: member.member_code,
    full_name: member.full_name,
    phone: member.phone
  };
}
