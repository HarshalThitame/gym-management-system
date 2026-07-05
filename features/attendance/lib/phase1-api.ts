import "server-only";

import { addDays, addSeconds, differenceInCalendarDays, endOfDay, formatISO, startOfDay, subDays } from "date-fns";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";
import { sendCampaignSms, sendCampaignWhatsApp } from "@/features/communications/lib/message-sender";
import { getIntegrationByProvider } from "@/features/integrations/services/integrations-service";
import {
  buildQrPayload,
  calculateVisitDurationMinutes,
  formatHourLabel,
  generateQrTokenValue,
  hashQrToken,
  validateMembershipForAccess,
} from "./business-rules";

type AppSupabase = ReturnType<typeof createAdminClient>;
type AttendanceSessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type QrTokenRow = Database["public"]["Tables"]["qr_tokens"]["Row"];
type AttendanceAlertSeverity = NonNullable<Database["public"]["Tables"]["attendance_alerts"]["Insert"]["severity"]>;
type AutomationRuleRow = Database["public"]["Tables"]["automation_rules"]["Row"];

export type AttendanceActorContext = Pick<AuthContext, "organizationId" | "profile" | "primaryRole" | "roles"> & {
  userId: string;
  gymId: string | null;
  branchId?: string | null;
};

type CheckInInput = {
  actor: AttendanceActorContext;
  memberId: string;
  source: Database["public"]["Tables"]["attendance_sessions"]["Insert"]["check_in_source"];
  deviceId?: string | null;
  qrTokenId?: string | null;
  branchId?: string | null;
  notes?: string | null;
};

type CheckOutInput = {
  actor: AttendanceActorContext;
  sessionId?: string | null;
  memberId?: string | null;
  deviceId?: string | null;
  checkoutMethod?: string | null;
  notes?: string | null;
};

type V1ListFilters = {
  gymIds: string[];
  gymId?: string | null;
  page: number;
  limit: number;
  memberId?: string | null;
  branchId?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export const DYNAMIC_ATTENDANCE_QR_PURPOSE = "attendance_dynamic" as const;
export const DYNAMIC_ATTENDANCE_QR_TTL_SECONDS = 12;
export const DYNAMIC_ATTENDANCE_QR_REFRESH_SECONDS = 10;

export type AttendanceQrValidationReason = "invalid" | "used" | "expired" | "wrong_gym";
export type DynamicAttendanceQrPayload = {
  memberId: string;
  branchId: string | null;
  expiresAt: string;
  qrCode: string;
  qrPayload: string;
  qrToken: QrTokenRow;
  refreshAfterSeconds: number;
};

export type BatchAttendanceResultItem = {
  memberId: string;
  success: boolean;
  status: number;
  message: string;
  code: string | null;
  sessionId: string | null;
  sessionType: string | null;
  sessionName: string | null;
  durationMinutes: number | null;
};

export type AttendanceAutomationConfig = {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  smsConfigured: boolean;
  whatsappConfigured: boolean;
  rules: Array<{
    id: string;
    name: string;
    eventType: string;
    status: string;
    priority: number;
    runCount: number;
    lastRunAt: string | null;
    alertType: string | null;
  }>;
};

export type SendAttendanceAlertResult = {
  memberId: string;
  memberName: string;
  alertType: AttendanceAutomationAlertType;
  message: string;
  channels: Array<{
    channel: AttendanceAutomationChannel;
    success: boolean;
    message: string;
    providerMessage?: unknown;
  }>;
  automationRuleId: string | null;
};

export type AttendanceAutomationAlertType = "streak_alert" | "churn_warning";
export type AttendanceAutomationChannel = "sms" | "whatsapp";

export async function listAttendanceSessionsV1(filters: V1ListFilters) {
  const supabase = createAdminClient();
  const offset = (filters.page - 1) * filters.limit;

  let query = supabase
    .from("attendance_sessions")
    .select("*, members(full_name, member_code, phone)", { count: "exact" })
    .order("check_in_at", { ascending: false })
    .range(offset, offset + filters.limit - 1);

  if (filters.gymId) {
    query = query.eq("gym_id", filters.gymId);
  } else {
    query = query.in("gym_id", filters.gymIds);
  }
  if (filters.memberId) {
    query = query.eq("member_id", filters.memberId);
  }
  if (filters.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte("check_in_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("check_in_at", filters.dateTo);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return {
    data: (data ?? []).map((session) => toV1Session(session)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / filters.limit),
    },
  };
}

export async function checkInMember(input: CheckInInput) {
  const supabase = createAdminClient();
  const gymId = input.actor.gymId;
  if (!gymId) {
    throw new Error("A gym scope is required before attendance can be recorded.");
  }

  const { member, membership } = await getMemberAccessState(supabase, input.memberId, gymId);
  const access = validateMembershipForAccess(membership);
  if (!member) {
    return { ok: false as const, status: 404, code: "MEMBER_NOT_FOUND", message: "Member not found." };
  }
  if (!access.allowed) {
    await recordDeniedAccess(supabase, input.actor, {
      gymId,
      member,
      membership,
      qrTokenId: input.qrTokenId ?? null,
      deviceId: input.deviceId ?? null,
      source: input.source,
      reasonCode: access.reasonCode,
      message: access.message,
    });
    return { ok: false as const, status: 403, code: access.reasonCode.toUpperCase(), message: access.message };
  }

  const resolvedBranchId = await resolveBranchId(supabase, {
    gymId,
    explicitBranchId: input.branchId ?? null,
    memberBranchId: member.branch_id,
    actorBranchId: input.actor.branchId ?? null,
  });

  if (!resolvedBranchId.ok) {
    return { ok: false as const, status: 403, code: "BRANCH_SCOPE_REQUIRED", message: resolvedBranchId.message };
  }

  const { data: existingSession, error: existingError } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("member_id", member.id)
    .eq("gym_id", gymId)
    .eq("status", "inside")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingSession) {
    await Promise.all([
      createAttendanceAlert(supabase, input.actor, {
        gymId,
        memberId: member.id,
        sessionId: existingSession.id,
        alertType: "duplicate_check_in",
        severity: "medium",
        message: "Duplicate check-in attempt while member is already inside.",
      }),
      logAccessAttempt(supabase, input.actor, {
        gymId,
        memberId: member.id,
        membershipId: membership?.id ?? null,
        sessionId: existingSession.id,
        qrTokenId: input.qrTokenId ?? null,
        deviceId: input.deviceId ?? null,
        direction: "entry",
        source: input.source,
        decision: "warning",
        reasonCode: "duplicate_check_in",
        message: "Member is already checked in.",
        snapshot: { existingSessionId: existingSession.id } as Json,
      }),
    ]);

    return {
      ok: false as const,
      status: 409,
      code: "ALREADY_CHECKED_IN",
      message: "Member is already checked in.",
      session: existingSession,
      member,
      membership,
    };
  }

  const { data: session, error } = await supabase
    .from("attendance_sessions")
    .insert({
      gym_id: gymId,
      branch_id: resolvedBranchId.branchId,
      member_id: member.id,
      membership_id: membership?.id ?? null,
      qr_token_id: input.qrTokenId ?? null,
      check_in_source: input.source,
      entry_device_id: input.deviceId ?? null,
      created_by: input.actor.userId,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await Promise.all([
    supabase.from("entry_events").insert({
      gym_id: gymId,
      attendance_session_id: session.id,
      member_id: member.id,
      entry_method: input.source === "qr" ? "qr" : input.source === "device" ? "api" : "manual",
      device_id: input.deviceId ?? null,
      verification_result: "granted",
      metadata: { membershipId: membership?.id ?? null } as Json,
    }),
    supabase.from("attendance_logs").insert({
      gym_id: gymId,
      attendance_session_id: session.id,
      member_id: member.id,
      membership_id: membership?.id ?? null,
      qr_token_id: input.qrTokenId ?? null,
      action: "check_in",
      source: input.source,
      result: "success",
      message: "Member checked in.",
      actor_id: input.actor.userId,
      device_id: input.deviceId ?? null,
      metadata: { memberCode: member.member_code, branchId: resolvedBranchId.branchId } as Json,
    }),
    logAccessAttempt(supabase, input.actor, {
      gymId,
      memberId: member.id,
      membershipId: membership?.id ?? null,
      sessionId: session.id,
      qrTokenId: input.qrTokenId ?? null,
      deviceId: input.deviceId ?? null,
      direction: "entry",
      source: input.source,
      decision: "granted",
      reasonCode: "access_granted",
      message: "Entry granted.",
      snapshot: { membershipStatus: membership?.status ?? null, branchId: resolvedBranchId.branchId } as Json,
    }),
    refreshAttendanceMetric(supabase, gymId, session.check_in_at),
    writeAuditLog({
      actorId: input.actor.userId,
      gymId,
      action: "attendance.check_in",
      entityType: "attendance_session",
      entityId: session.id,
      metadata: { memberId: member.id, source: input.source, branchId: resolvedBranchId.branchId },
    }),
  ]);

  await consumeQrTokenUsage(supabase, input.qrTokenId).catch(() => {});

  const organizationId = await resolveOrganizationId(supabase, gymId, input.actor.organizationId);
  if (organizationId) {
    publishAttendanceEvent({
      type: "check_in",
      session_id: session.id,
      member_id: member.id,
      gym_id: gymId,
      organization_id: organizationId,
      branch_id: resolvedBranchId.branchId,
    }).catch(() => {});
  }

  const streak = await getStreakSummary(supabase, member.id);
  return { ok: true as const, session, member, membership, streak };
}

export async function checkOutMember(input: CheckOutInput) {
  const supabase = createAdminClient();
  const gymId = input.actor.gymId;
  if (!gymId) {
    throw new Error("A gym scope is required before attendance can be recorded.");
  }

  let query = supabase.from("attendance_sessions").select("*").eq("gym_id", gymId).eq("status", "inside");
  if (input.sessionId) {
    query = query.eq("id", input.sessionId);
  } else if (input.memberId) {
    query = query.eq("member_id", input.memberId);
  } else {
    return { ok: false as const, status: 400, code: "VALIDATION_ERROR", message: "sessionId or memberId is required." };
  }

  const { data: session, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!session) {
    return { ok: false as const, status: 404, code: "SESSION_NOT_FOUND", message: "No active check-in session found." };
  }

  const checkedOutAt = new Date().toISOString();
  const durationMinutes = calculateVisitDurationMinutes(session.check_in_at, checkedOutAt);
  const source = normalizeCheckoutSource(input.checkoutMethod);

  const { error: updateError } = await supabase
    .from("attendance_sessions")
    .update({
      status: "checked_out",
      check_out_at: checkedOutAt,
      duration_minutes: durationMinutes,
      check_out_source: source,
      exit_device_id: input.deviceId ?? null,
      checked_out_by: input.actor.userId,
      notes: input.notes ?? session.notes,
    })
    .eq("id", session.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await Promise.all([
    supabase.from("exit_events").insert({
      gym_id: session.gym_id,
      attendance_session_id: session.id,
      member_id: session.member_id,
      exit_method: source === "qr" ? "qr" : source === "device" ? "api" : "manual",
      device_id: input.deviceId ?? null,
      metadata: { durationMinutes } as Json,
    }),
    supabase.from("attendance_logs").insert({
      gym_id: session.gym_id,
      attendance_session_id: session.id,
      member_id: session.member_id,
      membership_id: session.membership_id,
      qr_token_id: session.qr_token_id,
      action: "check_out",
      source,
      result: "success",
      message: "Member checked out.",
      actor_id: input.actor.userId,
      device_id: input.deviceId ?? null,
      metadata: { durationMinutes } as Json,
    }),
    logAccessAttempt(supabase, input.actor, {
      gymId: session.gym_id,
      memberId: session.member_id,
      membershipId: session.membership_id,
      sessionId: session.id,
      qrTokenId: session.qr_token_id,
      deviceId: input.deviceId ?? null,
      direction: "exit",
      source,
      decision: "granted",
      reasonCode: "check_out_completed",
      message: "Exit recorded.",
      snapshot: { durationMinutes } as Json,
    }),
    refreshAttendanceMetric(supabase, session.gym_id, session.check_in_at),
    writeAuditLog({
      actorId: input.actor.userId,
      gymId: session.gym_id,
      action: "attendance.check_out",
      entityType: "attendance_session",
      entityId: session.id,
      metadata: { memberId: session.member_id, durationMinutes, source },
    }),
  ]);

  const organizationId = await resolveOrganizationId(supabase, session.gym_id, input.actor.organizationId);
  if (organizationId && session.gym_id) {
    publishAttendanceEvent({
      type: "check_out",
      session_id: session.id,
      member_id: session.member_id,
      gym_id: session.gym_id,
      organization_id: organizationId,
      branch_id: session.branch_id ?? undefined,
    }).catch(() => {});
  }

  return {
    ok: true as const,
    session: {
      ...session,
      check_out_at: checkedOutAt,
      duration_minutes: durationMinutes,
      status: "checked_out",
      check_out_source: source,
    } as AttendanceSessionRow,
    durationMinutes,
  };
}

export async function getAttendanceLiveFeed(gymIds: string[], gymId: string | null, branchId: string | null, limit: number) {
  const supabase = createAdminClient();

  let query = supabase
    .from("attendance_logs")
    .select("id, action, source, occurred_at, attendance_session_id, member_id, members(full_name, member_code)")
    .in("action", ["check_in", "check_out", "auto_check_out"])
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (gymId) {
    query = query.eq("gym_id", gymId);
  } else {
    query = query.in("gym_id", gymIds);
  }

  if (branchId) {
    const { data: sessionIds } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("branch_id", branchId)
      .limit(limit * 10);
    const ids = (sessionIds ?? []).map((row) => row.id);
    if (ids.length === 0) {
      return [];
    }
    query = query.in("attendance_session_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberName: row.members?.full_name ?? "Member",
    memberCode: row.members?.member_code ?? null,
    checkinTime: row.occurred_at,
    method: row.source,
    action: row.action === "check_in" ? "checkin" : "checkout",
    sessionId: row.attendance_session_id,
  }));
}

export async function getAttendanceSessionDetail(gymIds: string[], gymId: string | null, sessionId: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("attendance_sessions")
    .select("*, members(full_name, member_code, phone, photo_url), memberships(status, end_date)")
    .eq("id", sessionId);
  if (gymId) {
    query = query.eq("gym_id", gymId);
  } else {
    query = query.in("gym_id", gymIds);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  const durationMinutes = data.check_out_at
    ? calculateVisitDurationMinutes(data.check_in_at, data.check_out_at)
    : calculateVisitDurationMinutes(data.check_in_at, new Date().toISOString());

  return {
    id: data.id,
    status: data.status,
    member: data.members ? {
      id: data.member_id,
      name: data.members.full_name,
      memberCode: data.members.member_code,
      phone: data.members.phone,
      photo: data.members.photo_url,
    } : null,
    checkinTime: data.check_in_at,
    checkoutTime: data.check_out_at,
    duration: durationMinutes,
    durationMinutes,
    method: data.check_in_source,
    branchId: data.branch_id,
    membershipStatus: data.memberships?.status ?? null,
  };
}

export async function getAttendanceCurrentStatus(gymIds: string[], gymId: string | null, branchId: string | null) {
  const supabase = createAdminClient();
  if (!gymId && gymIds.length === 0) {
    throw new Error("A gym scope is required.");
  }

  let sessionQuery = supabase
    .from("attendance_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "inside");
  if (gymId) {
    sessionQuery = sessionQuery.eq("gym_id", gymId);
  } else {
    sessionQuery = sessionQuery.in("gym_id", gymIds);
  }
  if (branchId) {
    sessionQuery = sessionQuery.eq("branch_id", branchId);
  }

  const [{ count: currentInside, error: countError }, capacityInfo, todayStats] = await Promise.all([
    sessionQuery,
    getCapacityInfo(supabase, gymIds, gymId, branchId),
    getAttendanceStats(gymIds, gymId, branchId, formatISO(new Date(), { representation: "date" })),
  ]);

  if (countError) {
    throw new Error(countError.message);
  }

  const occupancyPercent = capacityInfo.totalCapacity > 0
    ? Math.round((((currentInside ?? 0) / capacityInfo.totalCapacity) * 100) * 100) / 100
    : 0;

  return {
    currentlyInGym: currentInside ?? 0,
    totalCapacity: capacityInfo.totalCapacity,
    occupancyPercent,
    peakHour: todayStats.peakHour,
    nextMemberEta: null,
  };
}

export async function getAttendanceStats(gymIds: string[], gymId: string | null, branchId: string | null, date: string) {
  const supabase = createAdminClient();
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;

  let sessionQuery = supabase
    .from("attendance_sessions")
    .select("id, member_id, check_in_at, check_out_at, duration_minutes, status")
    .gte("check_in_at", from)
    .lte("check_in_at", to);
  if (gymId) {
    sessionQuery = sessionQuery.eq("gym_id", gymId);
  } else {
    sessionQuery = sessionQuery.in("gym_id", gymIds);
  }
  if (branchId) {
    sessionQuery = sessionQuery.eq("branch_id", branchId);
  }

  const { data: sessions, error } = await sessionQuery;
  if (error) {
    throw new Error(error.message);
  }

  const rows = sessions ?? [];
  const totalCheckins = rows.length;
  const totalCheckouts = rows.filter((row) => Boolean(row.check_out_at)).length;
  const currentInside = rows.filter((row) => row.status === "inside").length;
  const durations = rows.map((row) => row.duration_minutes).filter((value): value is number => typeof value === "number");
  const averageDurationMinutes = durations.length > 0
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  const byHour = new Map<number, number>();
  for (const row of rows) {
    const hour = new Date(row.check_in_at).getHours();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const peak = Array.from(byHour.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    totalCheckins,
    totalCheckouts,
    currentlyInGym: currentInside,
    avgSessionDuration: averageDurationMinutes,
    peakHour: peak ? formatHourLabel(peak[0]) : null,
    peakHourCount: peak?.[1] ?? 0,
  };
}

export async function getAttendanceHourlyTrend(gymIds: string[], gymId: string | null, branchId: string | null, days: number) {
  const supabase = createAdminClient();
  const from = `${formatISO(subDays(new Date(), Math.max(days - 1, 0)), { representation: "date" })}T00:00:00.000Z`;

  let query = supabase
    .from("attendance_sessions")
    .select("check_in_at")
    .gte("check_in_at", from);
  if (gymId) {
    query = query.eq("gym_id", gymId);
  } else {
    query = query.in("gym_id", gymIds);
  }
  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const buckets = new Map<string, { total: number; samples: number }>();
  for (const row of data ?? []) {
    const date = new Date(row.check_in_at);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const key = `${dayOfWeek}:${hour}`;
    const current = buckets.get(key) ?? { total: 0, samples: 0 };
    current.total += 1;
    current.samples += 1;
    buckets.set(key, current);
  }

  const results: Array<{ hour: number; avgCount: number; dayOfWeek: number }> = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const bucket = buckets.get(`${dayOfWeek}:${hour}`);
      results.push({
        hour,
        dayOfWeek,
        avgCount: bucket ? Number((bucket.total / Math.max(bucket.samples, 1)).toFixed(2)) : 0,
      });
    }
  }

  return results;
}

export async function getStaticAttendanceQr(memberId: string, actor: AttendanceActorContext) {
  const supabase = createAdminClient();
  const gymId = actor.gymId;
  if (!gymId) {
    throw new Error("A gym scope is required.");
  }

  const { member } = await getMemberAccessState(supabase, memberId, gymId);
  if (!member) {
    return null;
  }

  const token = await ensureStaticAttendanceToken(supabase, member, actor.userId);
  const qrPayload = buildQrPayload(token.token_value);
  const qrSvg = await QRCode.toString(qrPayload, {
    type: "svg",
    margin: 2,
    width: 240,
    color: { dark: "#111315", light: "#ffffff" },
  });

  return {
    member,
    token,
    qrPayload,
    qrSvg,
  };
}

export async function validateAttendanceQrToken(tokenValue: string, gymId: string | null) {
  const supabase = createAdminClient();
  const tokenHash = hashQrToken(tokenValue);
  const { data: qrToken, error } = await supabase
    .from("qr_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!qrToken) {
    return { valid: false as const, reason: "invalid" as const, memberId: null, branchId: null, qrToken: null };
  }

  if (qrToken.gym_id && gymId && qrToken.gym_id !== gymId) {
    return { valid: false as const, reason: "wrong_gym" as const, memberId: qrToken.member_id, branchId: null, qrToken };
  }

  if (qrToken.status === "used") {
    return { valid: false as const, reason: "used" as const, memberId: qrToken.member_id, branchId: null, qrToken };
  }

  if (qrToken.status !== "active") {
    return { valid: false as const, reason: "invalid" as const, memberId: qrToken.member_id, branchId: null, qrToken };
  }

  if (new Date(qrToken.expires_at) <= new Date()) {
    await supabase.from("qr_tokens").update({ status: "expired" }).eq("id", qrToken.id);
    return { valid: false as const, reason: "expired" as const, memberId: qrToken.member_id, branchId: null, qrToken };
  }

  const { data: member } = await supabase
    .from("members")
    .select("branch_id")
    .eq("id", qrToken.member_id)
    .maybeSingle();

  return {
    valid: true as const,
    reason: null,
    memberId: qrToken.member_id,
    branchId: member?.branch_id ?? null,
    qrToken,
  };
}

export async function issueDynamicAttendanceQr(memberId: string, actor: AttendanceActorContext): Promise<DynamicAttendanceQrPayload | null> {
  const supabase = createAdminClient();
  const gymId = actor.gymId;
  if (!gymId) {
    throw new Error("A gym scope is required.");
  }

  const { member } = await getMemberAccessState(supabase, memberId, gymId);
  if (!member) {
    return null;
  }

  const now = new Date();
  const expiresAt = addSeconds(now, DYNAMIC_ATTENDANCE_QR_TTL_SECONDS).toISOString();

  await supabase
    .from("qr_tokens")
    .update({ status: "expired" })
    .eq("member_id", member.id)
    .eq("purpose", DYNAMIC_ATTENDANCE_QR_PURPOSE)
    .eq("status", "active");

  const tokenValue = generateQrTokenValue();
  const { data: token, error } = await supabase
    .from("qr_tokens")
    .insert({
      gym_id: member.gym_id,
      branch_id: member.branch_id ?? actor.branchId ?? null,
      member_id: member.id,
      purpose: DYNAMIC_ATTENDANCE_QR_PURPOSE,
      status: "active",
      token_value: tokenValue,
      token_hash: hashQrToken(tokenValue),
      expires_at: expiresAt,
      created_by: actor.userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const qrPayload = buildQrPayload(token.token_value);
  const qrSvg = await QRCode.toString(qrPayload, {
    type: "svg",
    margin: 2,
    width: 240,
    color: { dark: "#111315", light: "#ffffff" },
  });

  await Promise.allSettled([
    supabase.from("attendance_logs").insert({
      gym_id: member.gym_id,
      branch_id: member.branch_id ?? actor.branchId ?? null,
      member_id: member.id,
      qr_token_id: token.id,
      action: "qr_generated",
      source: "member_app",
      result: "success",
      message: "Dynamic attendance QR issued.",
      actor_id: actor.userId,
      metadata: {
        expiresAt,
        refreshAfterSeconds: DYNAMIC_ATTENDANCE_QR_REFRESH_SECONDS,
        purpose: DYNAMIC_ATTENDANCE_QR_PURPOSE,
      } as Json,
    }),
    writeAuditLog({
      actorId: actor.userId,
      gymId: member.gym_id,
      branchId: member.branch_id ?? actor.branchId ?? null,
      action: "attendance.dynamic_qr_issued",
      entityType: "qr_token",
      entityId: token.id,
      metadata: {
        purpose: DYNAMIC_ATTENDANCE_QR_PURPOSE,
        refreshAfterSeconds: DYNAMIC_ATTENDANCE_QR_REFRESH_SECONDS,
      } as Json,
    }),
  ]);

  return {
    memberId: member.id,
    branchId: member.branch_id ?? actor.branchId ?? null,
    expiresAt,
    qrCode: qrSvg,
    qrPayload,
    qrToken: token as QrTokenRow,
    refreshAfterSeconds: DYNAMIC_ATTENDANCE_QR_REFRESH_SECONDS,
  };
}

export async function consumeQrTokenUsage(supabase: AppSupabase, qrTokenId: string | null) {
  if (!qrTokenId) {
    return;
  }

  const { data: qrToken, error } = await supabase
    .from("qr_tokens")
    .select("id, purpose, status")
    .eq("id", qrTokenId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!qrToken) {
    return;
  }

  const patch: Database["public"]["Tables"]["qr_tokens"]["Update"] = {
    last_used_at: new Date().toISOString(),
  };

  if (qrToken.purpose === DYNAMIC_ATTENDANCE_QR_PURPOSE && qrToken.status === "active") {
    patch.status = "used";
  }

  await supabase.from("qr_tokens").update(patch).eq("id", qrTokenId);
}

export async function buildAttendanceQrCardPdf(memberId: string, actor: AttendanceActorContext) {
  const payload = await getStaticAttendanceQr(memberId, actor);
  if (!payload) {
    return null;
  }

  const qrDataUrl = await QRCode.toDataURL(payload.qrPayload, {
    margin: 2,
    width: 320,
    color: { dark: "#111315", light: "#ffffff" },
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 600]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(qrDataUrl);

  page.drawRectangle({ x: 24, y: 24, width: 372, height: 552, color: rgb(0.97, 0.98, 1) });
  page.drawText("Attendance QR Card", { x: 40, y: 540, size: 22, font: fontBold, color: rgb(0.07, 0.09, 0.12) });
  page.drawText(payload.member.full_name, { x: 40, y: 505, size: 18, font: fontBold, color: rgb(0.07, 0.09, 0.12) });
  page.drawText(`Member Code: ${payload.member.member_code ?? "N/A"}`, { x: 40, y: 482, size: 11, font: fontRegular, color: rgb(0.25, 0.29, 0.34) });
  page.drawText("Scan at reception to check in.", { x: 40, y: 460, size: 11, font: fontRegular, color: rgb(0.25, 0.29, 0.34) });
  page.drawImage(qrImage, { x: 82, y: 170, width: 256, height: 256 });
  page.drawText(`Issued: ${new Date(payload.token.created_at).toLocaleString("en-IN")}`, {
    x: 40,
    y: 120,
    size: 10,
    font: fontRegular,
    color: rgb(0.25, 0.29, 0.34),
  });
  page.drawText("This attendance QR is long-lived for Phase 1 and can be regenerated from the member portal.", {
    x: 40,
    y: 98,
    size: 10,
    font: fontRegular,
    color: rgb(0.25, 0.29, 0.34),
    maxWidth: 320,
  });

  return pdf.save();
}

export async function getAttendanceMembershipSummary(memberId: string, gymId: string | null) {
  const supabase = createAdminClient();
  const query = supabase
    .from("memberships")
    .select("id, status, start_date, end_date, membership_plan_id")
    .eq("member_id", memberId)
    .in("status", ["pending", "active", "frozen", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  if (gymId) {
    const { data: member } = await supabase
      .from("members")
      .select("gym_id")
      .eq("id", memberId)
      .maybeSingle();
    if (!member || member.gym_id !== gymId) {
      return null;
    }
  }

  return data;
}

export async function searchMembersV1(input: {
  organizationId: string;
  query: string;
  gymIds: string[];
  gymId?: string | null;
  branchId?: string | null;
  limit: number;
}) {
  const supabase = createAdminClient();
  const pattern = `%${input.query.trim()}%`;

  let query = supabase
    .from("members")
    .select("id, full_name, member_code, phone, email, profile_photo_url, gender, branch_id, gym_id, status")
    .eq("organization_id", input.organizationId)
    .or(`full_name.ilike.${pattern},member_code.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    .order("full_name", { ascending: true })
    .limit(input.limit);

  if (input.gymId) {
    query = query.eq("gym_id", input.gymId);
  } else {
    query = query.in("gym_id", input.gymIds);
  }

  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((member) => ({
    id: member.id,
    fullName: member.full_name,
    memberCode: member.member_code,
    phone: member.phone,
    email: member.email,
    photo: member.profile_photo_url,
    gender: member.gender,
    branchId: member.branch_id,
    gymId: member.gym_id,
    status: member.status,
  }));
}

export async function getMemberStreakV1(memberId: string, gymIds: string[], gymId?: string | null) {
  const supabase = createAdminClient();

  let memberQuery = supabase
    .from("members")
    .select("id, full_name, gym_id, branch_id")
    .eq("id", memberId);
  if (gymId) {
    memberQuery = memberQuery.eq("gym_id", gymId);
  } else {
    memberQuery = memberQuery.in("gym_id", gymIds);
  }

  const [{ data: member, error: memberError }, { data: streak, error: streakError }] = await Promise.all([
    memberQuery.maybeSingle(),
    supabase
      .from("streaks")
      .select("current_streak, max_streak, last_checkin_date, total_checkins, milestones_reached, milestones_claimed, streak_start_date, is_broken, updated_at")
      .eq("member_id", memberId)
      .maybeSingle(),
  ]);

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (streakError) {
    throw new Error(streakError.message);
  }
  if (!member) {
    return null;
  }

  const currentStreak = streak?.current_streak ?? 0;
  const nextMilestone = getNextMilestone(currentStreak);

  return {
    memberId: member.id,
    memberName: member.full_name,
    gymId: member.gym_id,
    branchId: member.branch_id,
    currentStreak,
    maxStreak: streak?.max_streak ?? 0,
    lastCheckinDate: streak?.last_checkin_date ?? null,
    daysUntilMilestone: nextMilestone ? Math.max(nextMilestone - currentStreak, 0) : 0,
    nextMilestone,
    totalCheckins: streak?.total_checkins ?? 0,
    milestonesReached: streak?.milestones_reached ?? [],
    milestonesClaimed: streak?.milestones_claimed ?? [],
    streakStartDate: streak?.streak_start_date ?? null,
    isBroken: streak?.is_broken ?? false,
    updatedAt: streak?.updated_at ?? null,
  };
}

export async function getStreakLeaderboardV1(input: {
  gymIds: string[];
  gymId?: string | null;
  branchId?: string | null;
  limit: number;
  timeframe?: string | null;
}) {
  const supabase = createAdminClient();
  const thresholdDate = getTimeframeThreshold(input.timeframe ?? null);

  let query = supabase
    .from("streaks")
    .select("member_id, current_streak, max_streak, total_checkins, last_checkin_date, gym_id, branch_id, members(full_name, member_code)")
    .gt("current_streak", 0)
    .order("current_streak", { ascending: false })
    .order("total_checkins", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(input.limit);

  if (input.gymId) {
    query = query.eq("gym_id", input.gymId);
  } else {
    query = query.in("gym_id", input.gymIds);
  }

  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  }
  if (thresholdDate) {
    query = query.gte("last_checkin_date", thresholdDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((entry, index) => ({
    rank: index + 1,
    memberId: entry.member_id,
    name: entry.members?.full_name ?? "Member",
    memberCode: entry.members?.member_code ?? null,
    currentStreak: entry.current_streak,
    maxStreak: entry.max_streak,
    totalCheckins: entry.total_checkins,
    lastCheckinDate: entry.last_checkin_date,
    gymId: entry.gym_id,
    branchId: entry.branch_id,
  }));
}

export async function claimStreakMilestoneV1(input: {
  actor: AttendanceActorContext;
  memberId: string;
  milestoneNumber: number;
  claimType?: string | null;
}) {
  const supabase = createAdminClient();
  const gymId = input.actor.gymId;
  if (!gymId) {
    throw new Error("A gym scope is required.");
  }

  const [{ data: member, error: memberError }, { data: streak, error: streakError }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, gym_id")
      .eq("id", input.memberId)
      .eq("gym_id", gymId)
      .maybeSingle(),
    supabase
      .from("streaks")
      .select("id, current_streak, milestones_reached, milestones_claimed")
      .eq("member_id", input.memberId)
      .eq("gym_id", gymId)
      .maybeSingle(),
  ]);

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (streakError) {
    throw new Error(streakError.message);
  }
  if (!member) {
    return { ok: false as const, status: 404, code: "MEMBER_NOT_FOUND", message: "Member not found." };
  }
  if (!streak) {
    return { ok: false as const, status: 404, code: "STREAK_NOT_FOUND", message: "No streak record found for this member." };
  }
  if (!Number.isInteger(input.milestoneNumber) || input.milestoneNumber <= 0) {
    return { ok: false as const, status: 400, code: "INVALID_MILESTONE", message: "milestoneNumber must be a positive integer." };
  }

  const reachedMilestones = new Set(streak.milestones_reached ?? []);
  if (!reachedMilestones.has(input.milestoneNumber) && streak.current_streak < input.milestoneNumber) {
    return {
      ok: false as const,
      status: 409,
      code: "MILESTONE_NOT_REACHED",
      message: "This milestone has not been reached yet.",
    };
  }

  const claimedMilestones = new Set(streak.milestones_claimed ?? []);
  if (claimedMilestones.has(input.milestoneNumber)) {
    return {
      ok: false as const,
      status: 409,
      code: "MILESTONE_ALREADY_CLAIMED",
      message: "This milestone has already been claimed.",
    };
  }

  reachedMilestones.add(input.milestoneNumber);
  claimedMilestones.add(input.milestoneNumber);

  const { error: updateError } = await supabase
    .from("streaks")
    .update({
      milestones_reached: Array.from(reachedMilestones).sort((a, b) => a - b),
      milestones_claimed: Array.from(claimedMilestones).sort((a, b) => a - b),
    })
    .eq("id", streak.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await writeAuditLog({
    actorId: input.actor.userId,
    gymId,
    action: "attendance.streak_milestone_claim",
    entityType: "member",
    entityId: member.id,
    metadata: {
      milestoneNumber: input.milestoneNumber,
      claimType: input.claimType ?? "points",
      streakId: streak.id,
    },
  });

  return {
    ok: true as const,
    rewardDetails: {
      milestoneNumber: input.milestoneNumber,
      claimType: input.claimType ?? "points",
      status: "claimed",
      claimedAt: new Date().toISOString(),
      message: `${member.full_name} claimed the ${input.milestoneNumber}-day streak milestone.`,
    },
  };
}

type AnalyticsScope = {
  gymIds: string[];
  gymId?: string | null;
  branchId?: string | null;
};

export async function getAttendanceAnalyticsV1(input: AnalyticsScope & {
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const supabase = createAdminClient();
  const range = resolveAnalyticsDateRange(input.dateFrom, input.dateTo);
  const previousRange = resolvePreviousRange(range);

  const membersQuery = applyAnalyticsScope(
    supabase.from("members").select("id", { count: "exact", head: true }),
    input.gymIds,
    input.gymId,
    input.branchId,
  );
  const currentSessionsQuery = applyAnalyticsScope(
    supabase.from("attendance_sessions").select("member_id, check_in_at, duration_minutes"),
    input.gymIds,
    input.gymId,
    input.branchId,
  ).gte("check_in_at", range.from).lte("check_in_at", range.to);
  const previousSessionsQuery = applyAnalyticsScope(
    supabase.from("attendance_sessions").select("member_id, check_in_at, duration_minutes"),
    input.gymIds,
    input.gymId,
    input.branchId,
  ).gte("check_in_at", previousRange.from).lte("check_in_at", previousRange.to);

  const [{ count: totalMembers, error: membersError }, currentSessionsResult, previousSessionsResult] = await Promise.all([
    membersQuery,
    currentSessionsQuery,
    previousSessionsQuery,
  ]);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const currentSessions = currentSessionsResult.data ?? [];
  const previousSessions = previousSessionsResult.data ?? [];
  const currentActiveMembers = new Set(currentSessions.map((session) => session.member_id)).size;
  const previousActiveMembers = new Set(previousSessions.map((session) => session.member_id)).size;
  const durations = currentSessions
    .map((session) => session.duration_minutes)
    .filter((value): value is number => typeof value === "number");

  const hourCounts = new Map<number, number>();
  for (const session of currentSessions) {
    const hour = new Date(session.check_in_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peakHourEntry = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const avgAttendanceRate = (totalMembers ?? 0) > 0
    ? Math.round((((currentActiveMembers / (totalMembers ?? 1)) * 100) * 100)) / 100
    : 0;
  const trend = previousActiveMembers > 0
    ? {
        direction: currentActiveMembers > previousActiveMembers ? "up" as const : currentActiveMembers < previousActiveMembers ? "down" as const : "flat" as const,
        percent: Math.round((Math.abs(currentActiveMembers - previousActiveMembers) / previousActiveMembers) * 100 * 10) / 10,
      }
    : {
        direction: currentActiveMembers > 0 ? "up" as const : "flat" as const,
        percent: currentActiveMembers > 0 ? 100 : 0,
      };

  return {
    totalMembers: totalMembers ?? 0,
    activeMembers: currentActiveMembers,
    inactiveMembers: Math.max((totalMembers ?? 0) - currentActiveMembers, 0),
    avgAttendanceRate,
    trend,
    totalCheckins: currentSessions.length,
    avgSessionDuration: durations.length > 0
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0,
    peakHour: peakHourEntry ? peakHourEntry[0] : null,
    peakHourCount: peakHourEntry ? peakHourEntry[1] : 0,
    range,
  };
}

export async function getChurnRiskAnalyticsV1(input: AnalyticsScope & { limit: number }) {
  const supabase = createAdminClient();

  const query = applyAnalyticsScope(
    supabase
      .from("attendance_analytics")
      .select("member_id, churn_risk_score, avg_session_duration, checkins_this_week, checkins_this_month, attendance_trend, last_risk_assessment, predicted_checkout_date, members(full_name, member_code, last_attendance_date, status)")
      .order("churn_risk_score", { ascending: false })
      .limit(input.limit),
    input.gymIds,
    input.gymId,
    input.branchId,
  );

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  if (rows.length > 0) {
    return rows.map((row) => buildChurnRiskRowFromAnalytics(row));
  }

  return buildChurnRiskRowsFromFallback(supabase, input);
}

export async function getMemberInsightsV1(input: AnalyticsScope & { memberId: string }) {
  const supabase = createAdminClient();

  const memberQuery = applyAnalyticsScope(
    supabase
      .from("members")
      .select("id, full_name, member_code, gym_id, branch_id, last_attendance_date")
      .eq("id", input.memberId),
    input.gymIds,
    input.gymId,
    input.branchId,
  );
  const sessionsQuery = applyAnalyticsScope(
    supabase.from("attendance_sessions").select("check_in_at, duration_minutes").order("check_in_at", { ascending: false }).limit(1000),
    input.gymIds,
    input.gymId,
    input.branchId,
  ).eq("member_id", input.memberId);
  const streakQuery = supabase
    .from("streaks")
    .select("current_streak, max_streak, last_checkin_date")
    .eq("member_id", input.memberId)
    .maybeSingle();

  const [{ data: member, error: memberError }, { data: sessions, error: sessionsError }, { data: streak, error: streakError }] = await Promise.all([
    memberQuery.maybeSingle(),
    sessionsQuery,
    streakQuery,
  ]);

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (sessionsError) {
    throw new Error(sessionsError.message);
  }
  if (streakError) {
    throw new Error(streakError.message);
  }
  if (!member) {
    return null;
  }

  const sessionRows = sessions ?? [];
  const durations = sessionRows
    .map((session) => session.duration_minutes)
    .filter((value): value is number => typeof value === "number");
  const totalDurationMinutes = durations.reduce((sum, value) => sum + value, 0);
  const lastVisitAt = sessionRows[0]?.check_in_at ?? member.last_attendance_date ?? null;
  const visitsLast30Days = sessionRows.filter((session) => new Date(session.check_in_at) >= subDays(new Date(), 30)).length;
  const currentStreak = streak?.current_streak ?? 0;
  const maxStreak = streak?.max_streak ?? 0;
  const daysSinceLastVisit = lastVisitAt ? differenceInCalendarDays(new Date(), new Date(lastVisitAt)) : 999;
  const consistencyScore = Math.max(0, Math.min(100, Math.round(
    Math.min(visitsLast30Days / 12, 1) * 50 +
    Math.min(currentStreak / 14, 1) * 25 +
    Math.max(0, 25 - Math.min(daysSinceLastVisit, 25))
  )));

  return {
    memberId: member.id,
    name: member.full_name,
    memberCode: member.member_code,
    gymId: member.gym_id,
    branchId: member.branch_id,
    lastVisitAt,
    totalVisits: sessionRows.length,
    totalDurationMinutes,
    avgSessionDurationMinutes: sessionRows.length > 0 ? Math.round(totalDurationMinutes / sessionRows.length) : 0,
    preferredHours: buildPreferredHours(sessionRows),
    consistencyScore,
    engagementLevel: getEngagementLevel(consistencyScore),
    currentStreak,
    maxStreak,
    daysSinceLastVisit,
  };
}

export function normalizeV1CheckInResponse(result: Awaited<ReturnType<typeof checkInMember>>) {
  if (!result.ok) {
    return null;
  }

  const nextMilestone = getNextMilestone(result.streak.current);
  return {
    success: true,
    message: `${result.member.full_name} checked in.`,
    memberData: {
      id: result.member.id,
      name: result.member.full_name,
      photo: result.member.photo_url,
      membership_type: result.membership?.membership_plan_id ?? null,
    },
    sessionId: result.session.id,
    streakData: {
      current: result.streak.current,
      max: result.streak.max,
      daysToMilestone: nextMilestone ? Math.max(nextMilestone - result.streak.current, 0) : 0,
    },
    timestamp: result.session.check_in_at,
  };
}

export function normalizeV1CheckOutResponse(result: Awaited<ReturnType<typeof checkOutMember>>) {
  if (!result.ok) {
    return null;
  }

  return {
    success: true,
    duration: result.durationMinutes,
    sessionData: {
      checkinTime: result.session.check_in_at,
      checkoutTime: result.session.check_out_at,
      durationMinutes: result.durationMinutes,
    },
    streakAchieved: null,
  };
}

function toV1Session(session: Record<string, unknown>) {
  const member = (session.members ?? null) as { full_name?: string | null; member_code?: string | null; phone?: string | null } | null;
  return {
    id: String(session.id),
    memberId: String(session.member_id),
    memberName: member?.full_name ?? "Member",
    memberCode: member?.member_code ?? null,
    phone: member?.phone ?? null,
    checkinTime: String(session.check_in_at),
    checkoutTime: session.check_out_at ? String(session.check_out_at) : null,
    durationMinutes: typeof session.duration_minutes === "number" ? session.duration_minutes : null,
    method: session.check_in_source ?? null,
    status: session.status ?? null,
    branchId: session.branch_id ?? null,
  };
}

async function getMemberAccessState(supabase: AppSupabase, memberId: string, gymId: string) {
  const [{ data: member, error: memberError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).eq("gym_id", gymId).maybeSingle(),
    supabase
      .from("memberships")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["pending", "active", "frozen", "suspended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (membershipError) {
    throw new Error(membershipError.message);
  }

  return {
    member: member as MemberRow | null,
    membership: membership as MembershipRow | null,
  };
}

async function resolveBranchId(
  supabase: AppSupabase,
  input: { gymId: string; explicitBranchId: string | null; memberBranchId: string | null; actorBranchId: string | null }
) {
  const preferredBranchId = input.explicitBranchId ?? input.memberBranchId ?? input.actorBranchId;
  if (preferredBranchId) {
    const { data, error } = await supabase
      .from("branches")
      .select("id, gym_id, status")
      .eq("id", preferredBranchId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.gym_id !== input.gymId || data.status === "archived") {
      return { ok: false as const, message: "Selected branch is not available for this gym." };
    }
    return { ok: true as const, branchId: data.id };
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("branches")
    .select("id")
    .eq("gym_id", input.gymId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(fallbackError.message);
  }
  if (!fallback) {
    return { ok: false as const, message: "No active branch is configured for this gym." };
  }
  return { ok: true as const, branchId: fallback.id };
}

async function ensureStaticAttendanceToken(supabase: AppSupabase, member: MemberRow, actorId: string) {
  const now = new Date().toISOString();
  const { data: existing, error } = await supabase
    .from("qr_tokens")
    .select("*")
    .eq("member_id", member.id)
    .eq("purpose", "attendance")
    .eq("status", "active")
    .gt("expires_at", now)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (existing) {
    return existing as QrTokenRow;
  }

  await supabase
    .from("qr_tokens")
    .update({ status: "expired" })
    .eq("member_id", member.id)
    .eq("purpose", "attendance")
    .eq("status", "active");

  const tokenValue = generateQrTokenValue();
  const { data, error: insertError } = await supabase
    .from("qr_tokens")
    .insert({
      gym_id: member.gym_id,
      member_id: member.id,
      token_value: tokenValue,
      token_hash: hashQrToken(tokenValue),
      expires_at: addDays(new Date(), 90).toISOString(),
      created_by: actorId,
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return data as QrTokenRow;
}

async function getStreakSummary(supabase: AppSupabase, memberId: string) {
  const { data } = await supabase
    .from("streaks")
    .select("current_streak, max_streak")
    .eq("member_id", memberId)
    .maybeSingle();

  return {
    current: data?.current_streak ?? 0,
    max: data?.max_streak ?? 0,
  };
}

async function getCapacityInfo(supabase: AppSupabase, gymIds: string[], gymId: string | null, branchId: string | null) {
  if (branchId) {
    const { data } = await supabase
      .from("branches")
      .select("capacity")
      .eq("id", branchId)
      .maybeSingle();
    return { totalCapacity: data?.capacity ?? 0 };
  }

  const { data } = await supabase
    .from("branches")
    .select("capacity")
    .in("gym_id", gymId ? [gymId] : gymIds)
    .neq("status", "archived");

  return {
    totalCapacity: (data ?? []).reduce((sum, branch) => sum + (branch.capacity ?? 0), 0),
  };
}

export async function resolveGymScopeIds(organizationId: string, preferredGymId?: string | null) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId)
    .neq("status", "archived");

  if (error) {
    throw new Error(error.message);
  }

  const gymIds = (data ?? []).map((row) => row.id);
  if (preferredGymId && !gymIds.includes(preferredGymId)) {
    return [];
  }

  return preferredGymId ? [preferredGymId] : gymIds;
}

async function resolveOrganizationId(supabase: AppSupabase, gymId: string | null, fallback: string | null) {
  if (fallback) {
    return fallback;
  }
  if (!gymId) {
    return null;
  }
  const { data } = await supabase
    .from("gyms")
    .select("organization_id")
    .eq("id", gymId)
    .maybeSingle();
  return data?.organization_id ?? null;
}

async function recordDeniedAccess(
  supabase: AppSupabase,
  actor: AttendanceActorContext,
  input: {
    gymId: string;
    member: MemberRow;
    membership: MembershipRow | null;
    qrTokenId: string | null;
    deviceId: string | null;
    source: Database["public"]["Tables"]["attendance_logs"]["Insert"]["source"];
    reasonCode: string;
    message: string;
  }
) {
  const alertType = mapReasonToAlert(input.reasonCode);
  await Promise.all([
    supabase.from("attendance_logs").insert({
      gym_id: input.gymId,
      member_id: input.member.id,
      membership_id: input.membership?.id ?? null,
      qr_token_id: input.qrTokenId,
      action: "access_denied",
      source: input.source,
      result: "denied",
      reason_code: input.reasonCode,
      message: input.message,
      actor_id: actor.userId,
      device_id: input.deviceId,
      metadata: {} as Json,
    }),
    alertType ? createAttendanceAlert(supabase, actor, {
      gymId: input.gymId,
      memberId: input.member.id,
      sessionId: null,
      alertType,
      severity: alertType === "membership_suspended" ? "high" : "medium",
      message: input.message,
    }) : Promise.resolve(),
    logAccessAttempt(supabase, actor, {
      gymId: input.gymId,
      memberId: input.member.id,
      membershipId: input.membership?.id ?? null,
      sessionId: null,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      direction: "entry",
      source: input.source,
      decision: "denied",
      reasonCode: input.reasonCode,
      message: input.message,
      snapshot: { membershipStatus: input.membership?.status ?? null } as Json,
    }),
  ]);
}

async function logAccessAttempt(
  supabase: AppSupabase,
  actor: AttendanceActorContext,
  input: {
    gymId: string | null;
    memberId: string | null;
    membershipId: string | null;
    sessionId: string | null;
    qrTokenId: string | null;
    deviceId: string | null;
    direction: Database["public"]["Tables"]["access_logs"]["Insert"]["direction"];
    source: Database["public"]["Tables"]["access_logs"]["Insert"]["source"];
    decision: Database["public"]["Tables"]["access_logs"]["Insert"]["decision"];
    reasonCode: string;
    message: string;
    snapshot: Json;
  }
) {
  await supabase.from("access_logs").insert({
    gym_id: input.gymId,
    member_id: input.memberId,
    membership_id: input.membershipId,
    attendance_session_id: input.sessionId,
    qr_token_id: input.qrTokenId,
    device_id: input.deviceId,
    direction: input.direction,
    source: input.source,
    decision: input.decision,
    reason_code: input.reasonCode,
    message: input.message,
    validation_snapshot: input.snapshot,
    actor_id: actor.userId,
  });
}

async function createAttendanceAlert(
  supabase: AppSupabase,
  actor: AttendanceActorContext,
  input: {
    gymId: string | null;
    memberId: string | null;
    sessionId: string | null;
    alertType: Database["public"]["Tables"]["attendance_alerts"]["Insert"]["alert_type"];
    severity: AttendanceAlertSeverity;
    message: string;
  }
) {
  await supabase.from("attendance_alerts").insert({
    gym_id: input.gymId,
    member_id: input.memberId,
    attendance_session_id: input.sessionId,
    alert_type: input.alertType,
    severity: input.severity,
    message: input.message,
    created_by: actor.userId,
    metadata: {} as Json,
  });
}

async function refreshAttendanceMetric(supabase: AppSupabase, gymId: string | null, dateSource: string) {
  const metricDate = dateSource.slice(0, 10);
  let query = supabase
    .from("attendance_sessions")
    .select("id, member_id, duration_minutes, check_in_at")
    .gte("check_in_at", `${metricDate}T00:00:00.000Z`)
    .lte("check_in_at", `${metricDate}T23:59:59.999Z`);

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const sessions = data ?? [];
  const uniqueMembers = new Set(sessions.map((session) => session.member_id)).size;
  const durations = sessions.map((session) => session.duration_minutes).filter((value): value is number => typeof value === "number");
  const hourlyCounts = new Map<number, number>();
  for (const session of sessions) {
    const hour = new Date(session.check_in_at).getHours();
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
  }
  const peak = Array.from(hourlyCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const totalDuration = durations.reduce((total, value) => total + value, 0);

  await supabase.from("attendance_metrics").upsert({
    gym_id: gymId,
    metric_date: metricDate,
    total_check_ins: sessions.length,
    unique_members: uniqueMembers,
    total_duration_minutes: totalDuration,
    average_duration_minutes: durations.length > 0 ? Math.round(totalDuration / durations.length) : 0,
    peak_occupancy: peak?.[1] ?? 0,
    peak_hour: peak?.[0] ?? null,
    generated_at: new Date().toISOString(),
  }, { onConflict: "gym_id,metric_date" });
}

function mapReasonToAlert(reasonCode: string): Database["public"]["Tables"]["attendance_alerts"]["Insert"]["alert_type"] | null {
  if (reasonCode === "membership_expired") return "membership_expired";
  if (reasonCode === "membership_suspended") return "membership_suspended";
  if (reasonCode === "membership_frozen") return "membership_frozen";
  if (reasonCode.startsWith("membership") || reasonCode === "payment_pending" || reasonCode === "no_membership") {
    return "membership_invalid";
  }
  return null;
}

function normalizeCheckoutSource(checkoutMethod?: string | null): Database["public"]["Tables"]["attendance_sessions"]["Update"]["check_out_source"] {
  if (checkoutMethod === "qr") return "qr";
  if (checkoutMethod === "device") return "device";
  if (checkoutMethod === "member_app") return "member_app";
  if (checkoutMethod === "system") return "system";
  return "reception";
}

function getNextMilestone(current: number) {
  return [7, 14, 30, 50, 100, 365].find((milestone) => milestone > current) ?? null;
}

function getTimeframeThreshold(timeframe: string | null) {
  if (!timeframe || timeframe === "all") {
    return null;
  }

  const now = new Date();
  if (timeframe === "week") {
    return formatISO(subDays(now, 7), { representation: "date" });
  }
  if (timeframe === "month") {
    return formatISO(subDays(now, 30), { representation: "date" });
  }
  if (timeframe === "quarter") {
    return formatISO(subDays(now, 90), { representation: "date" });
  }

  return null;
}

function resolveAnalyticsDateRange(dateFrom?: string | null, dateTo?: string | null) {
  const fromDate = startOfDay(dateFrom ? new Date(dateFrom) : subDays(new Date(), 29));
  const toDate = endOfDay(dateTo ? new Date(dateTo) : new Date());

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    days: Math.max(differenceInCalendarDays(toDate, fromDate) + 1, 1),
  };
}

function resolvePreviousRange(range: ReturnType<typeof resolveAnalyticsDateRange>) {
  const previousTo = endOfDay(subDays(new Date(range.from), 1));
  const previousFrom = startOfDay(subDays(previousTo, range.days - 1));

  return {
    from: previousFrom.toISOString(),
    to: previousTo.toISOString(),
  };
}

function applyAnalyticsScope<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
}>(query: T, gymIds: string[], gymId: string | null | undefined, branchId: string | null | undefined): T {
  const scoped = gymId ? query.eq("gym_id", gymId) : query.in("gym_id", gymIds);
  return branchId ? scoped.eq("branch_id", branchId) : scoped;
}

function buildPreferredHours(sessions: Array<{ check_in_at: string }>) {
  const counts = new Map<number, number>();
  for (const session of sessions) {
    const hour = new Date(session.check_in_at).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([hour, visits]) => ({ hour, visits }))
    .sort((a, b) => b.visits - a.visits || a.hour - b.hour)
    .slice(0, 3);
}

function getEngagementLevel(score: number): "low" | "medium" | "high" | "very_high" {
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function buildChurnRecommendation(score: number, daysWithoutVisit: number) {
  if (score >= 80 || daysWithoutVisit >= 30) {
    return "Immediate outreach and trainer follow-up recommended.";
  }
  if (score >= 60 || daysWithoutVisit >= 21) {
    return "Book a retention check-in within the next week.";
  }
  if (score >= 40 || daysWithoutVisit >= 14) {
    return "Send a friendly reminder and offer an easy return session.";
  }
  return "Monitor attendance and keep the member engaged.";
}

function predictChurnDate(score: number) {
  const daysAhead = Math.max(7, Math.round(30 - score * 0.25));
  return addDays(new Date(), daysAhead).toISOString();
}

function buildChurnRiskRowFromAnalytics(row: Record<string, unknown>) {
  const member = (row.members ?? null) as { full_name?: string | null; member_code?: string | null; last_attendance_date?: string | null; status?: string | null } | null;
  const lastVisit = member?.last_attendance_date ?? null;
  const daysWithoutVisit = lastVisit ? differenceInCalendarDays(new Date(), new Date(lastVisit)) : 999;
  const riskScore = typeof row.churn_risk_score === "number" ? row.churn_risk_score : 0;

  return {
    memberId: String(row.member_id),
    name: member?.full_name ?? "Member",
    memberCode: member?.member_code ?? null,
    riskScore,
    lastVisit,
    daysWithoutVisit,
    recommendation: buildChurnRecommendation(riskScore, daysWithoutVisit),
    predictedChurnDate: typeof row.predicted_checkout_date === "string" && row.predicted_checkout_date
      ? row.predicted_checkout_date
      : predictChurnDate(riskScore),
    attendanceTrend: typeof row.attendance_trend === "number" ? row.attendance_trend : null,
    avgSessionDuration: typeof row.avg_session_duration === "number" ? row.avg_session_duration : null,
    checkinsThisWeek: typeof row.checkins_this_week === "number" ? row.checkins_this_week : 0,
    checkinsThisMonth: typeof row.checkins_this_month === "number" ? row.checkins_this_month : 0,
    memberStatus: member?.status ?? null,
  };
}

async function buildChurnRiskRowsFromFallback(supabase: AppSupabase, input: AnalyticsScope & { limit: number }) {
  let memberQuery = supabase
    .from("members")
    .select("id, full_name, member_code, gym_id, branch_id, last_attendance_date, status")
    .order("last_attendance_date", { ascending: true, nullsFirst: true })
    .limit(input.limit);
  memberQuery = applyAnalyticsScope(memberQuery, input.gymIds, input.gymId, input.branchId);

  const { data: members, error } = await memberQuery;
  if (error) {
    throw new Error(error.message);
  }

  return (members ?? []).map((member) => {
    const lastVisit = member.last_attendance_date ?? null;
    const daysWithoutVisit = lastVisit ? differenceInCalendarDays(new Date(), new Date(lastVisit)) : 999;
    const riskScore = Math.max(0, Math.min(100, Math.round(daysWithoutVisit >= 30 ? 90 : daysWithoutVisit >= 21 ? 70 : daysWithoutVisit >= 14 ? 50 : 20)));
    return {
      memberId: member.id,
      name: member.full_name,
      memberCode: member.member_code,
      riskScore,
      lastVisit,
      daysWithoutVisit,
      recommendation: buildChurnRecommendation(riskScore, daysWithoutVisit),
      predictedChurnDate: predictChurnDate(riskScore),
      attendanceTrend: null,
      avgSessionDuration: null,
      checkinsThisWeek: 0,
      checkinsThisMonth: 0,
      memberStatus: member.status ?? null,
    };
  });
}

async function getConnectedMsg91Integration(organizationId: string, provider: "msg91_sms" | "msg91_whatsapp") {
  const integration = await getIntegrationByProvider(organizationId, provider);
  if (!integration || integration.status !== "connected") {
    return null;
  }
  return integration;
}

function isAttendanceAutomationRule(rule: AutomationRuleRow) {
  const name = rule.name.toLowerCase();
  return rule.event_type.startsWith("attendance.") || name.includes("attendance") || name.includes("streak") || name.includes("churn");
}

function extractAutomationAlertType(rule: AutomationRuleRow): string | null {
  const filters = rule.event_filters && typeof rule.event_filters === "object" && !Array.isArray(rule.event_filters)
    ? rule.event_filters as Record<string, unknown>
    : null;
  const alertType = filters?.alertType;
  return typeof alertType === "string" ? alertType : null;
}

async function ensureAttendanceAutomationRule(
  supabase: AppSupabase,
  organizationId: string,
  createdBy: string,
  alertType: AttendanceAutomationAlertType,
) {
  const ruleName = `Attendance ${alertType.replace("_", " ")}`;
  const { data: existing, error: existingError } = await supabase
    .from("automation_rules")
    .select("id, organization_id, name, event_type, event_filters, actions, status, priority, run_count, last_run_at")
    .eq("organization_id", organizationId)
    .eq("event_type", "attendance.alert")
    .eq("name", ruleName)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existing) {
    return existing as AutomationRuleRow;
  }

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      organization_id: organizationId,
      name: ruleName,
      description: `System automation for ${alertType.replace("_", " ")} alerts.`,
      event_type: "attendance.alert",
      event_filters: { alertType } as Json,
      actions: [{ type: "notify", alertType }] as Json,
      status: "active",
      priority: 100,
      cooldown_minutes: 0,
      run_count: 0,
      created_by: createdBy,
    })
    .select("id, organization_id, name, event_type, event_filters, actions, status, priority, run_count, last_run_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AutomationRuleRow;
}

function composeBatchNotes(sessionType?: string | null, sessionName?: string | null, notes?: string | null) {
  const parts = [
    sessionType ? `Batch type: ${sessionType}` : null,
    sessionName ? `Session: ${sessionName}` : null,
    notes?.trim() ? notes.trim() : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" | ") : null;
}

function buildAttendanceAlertMessage(
  alertType: AttendanceAutomationAlertType,
  memberName: string,
  lastAttendanceDate: string | null,
) {
  const lastVisitSuffix = lastAttendanceDate ? ` Last visit: ${lastAttendanceDate.slice(0, 10)}.` : "";
  if (alertType === "streak_alert") {
    return `${memberName}, your attendance streak is active. Keep it going to maintain consistency.${lastVisitSuffix}`;
  }
  return `${memberName}, we noticed a drop in attendance and would love to see you back soon.${lastVisitSuffix}`;
}

async function getCurrentInsideCount(supabase: AppSupabase, gymIds: string[], gymId: string | null, branchId: string | null) {
  let query = supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("status", "inside");
  if (gymId) {
    query = query.eq("gym_id", gymId);
  } else {
    query = query.in("gym_id", gymIds);
  }
  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function buildOccupancyHeatmap(rows: Array<{
  hour_of_day: number;
  day_of_week: number;
  members_in_gym: number;
  occupancy_percent: number | string | null;
}>) {
  const buckets = new Map<string, { totalMembers: number; totalPercent: number; samples: number }>();

  for (const row of rows) {
    const key = `${row.day_of_week}:${row.hour_of_day}`;
    const current = buckets.get(key) ?? { totalMembers: 0, totalPercent: 0, samples: 0 };
    current.totalMembers += row.members_in_gym ?? 0;
    current.totalPercent += Number(row.occupancy_percent ?? 0);
    current.samples += 1;
    buckets.set(key, current);
  }

  return Array.from({ length: 7 }, (_, dayOfWeek) => Array.from({ length: 24 }, (_, hourOfDay) => {
    const bucket = buckets.get(`${dayOfWeek}:${hourOfDay}`);
    return {
      dayOfWeek,
      hourOfDay,
      avgMembersInGym: bucket ? Math.round(bucket.totalMembers / bucket.samples) : 0,
      avgOccupancyPercent: bucket ? Number((bucket.totalPercent / bucket.samples).toFixed(2)) : 0,
      samples: bucket?.samples ?? 0,
    };
  })).flat();
}

export async function batchCheckInMembersV1(input: {
  actor: AttendanceActorContext;
  memberIds: string[];
  source?: Database["public"]["Tables"]["attendance_sessions"]["Insert"]["check_in_source"] | null;
  deviceId?: string | null;
  branchId?: string | null;
  sessionType?: string | null;
  sessionName?: string | null;
  notes?: string | null;
}) {
  const uniqueMemberIds = Array.from(new Set(input.memberIds.map((memberId) => memberId.trim()).filter(Boolean)));
  if (uniqueMemberIds.length === 0) {
    return {
      ok: false as const,
      status: 400,
      code: "VALIDATION_ERROR",
      message: "At least one memberId is required.",
    };
  }

  const source = input.source ?? (input.sessionType === "class" ? "system" : "reception");
  const notes = composeBatchNotes(input.sessionType, input.sessionName, input.notes);
  const actor = {
    ...input.actor,
    branchId: input.branchId ?? input.actor.branchId ?? null,
  };

  const results: BatchAttendanceResultItem[] = [];
  for (const memberId of uniqueMemberIds) {
    try {
      const result = await checkInMember({
        actor,
        memberId,
        source,
        deviceId: input.deviceId ?? null,
        branchId: input.branchId ?? null,
        notes,
      });

      if (!result.ok) {
        results.push({
          memberId,
          success: false,
          status: result.status,
          message: result.message,
          code: result.code,
          sessionId: result.session?.id ?? null,
          sessionType: input.sessionType ?? null,
          sessionName: input.sessionName ?? null,
          durationMinutes: null,
        });
        continue;
      }

      results.push({
        memberId,
        success: true,
        status: 201,
        message: `${result.member.full_name} checked in.`,
        code: null,
        sessionId: result.session.id,
        sessionType: input.sessionType ?? null,
        sessionName: input.sessionName ?? null,
        durationMinutes: null,
      });
    } catch (error) {
      results.push({
        memberId,
        success: false,
        status: 500,
        message: error instanceof Error ? error.message : "Unexpected check-in failure.",
        code: "INTERNAL_ERROR",
        sessionId: null,
        sessionType: input.sessionType ?? null,
        sessionName: input.sessionName ?? null,
        durationMinutes: null,
      });
    }
  }

  return {
    ok: true as const,
    checkedInCount: results.filter((result) => result.success).length,
    failedCount: results.filter((result) => !result.success).length,
    results,
  };
}

export async function batchCheckOutMembersV1(input: {
  actor: AttendanceActorContext;
  memberIds?: string[] | null;
  allInside?: boolean;
  deviceId?: string | null;
  branchId?: string | null;
  sessionType?: string | null;
  sessionName?: string | null;
  notes?: string | null;
  checkoutMethod?: Database["public"]["Tables"]["attendance_sessions"]["Update"]["check_out_source"] | string | null;
}) {
  const supabase = createAdminClient();
  const actor = {
    ...input.actor,
    branchId: input.branchId ?? input.actor.branchId ?? null,
  };

  let memberIds = Array.from(new Set((input.memberIds ?? []).map((memberId) => memberId.trim()).filter(Boolean)));
  if (input.allInside) {
    if (!actor.gymId) {
      return {
        ok: false as const,
        status: 400,
        code: "GYM_SCOPE_REQUIRED",
        message: "A gym scope is required before batch checkout can run.",
      };
    }

    let query = supabase.from("attendance_sessions").select("member_id").eq("gym_id", actor.gymId).eq("status", "inside");
    if (actor.branchId) {
      query = query.eq("branch_id", actor.branchId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    memberIds = Array.from(new Set((data ?? []).map((row) => row.member_id).filter(Boolean)));
  }

  if (memberIds.length === 0) {
    return {
      ok: false as const,
      status: 400,
      code: "VALIDATION_ERROR",
      message: "At least one memberId is required.",
    };
  }

  const checkoutMethod = input.checkoutMethod ?? (input.sessionType === "class" ? "system" : "reception");
  const notes = composeBatchNotes(input.sessionType, input.sessionName, input.notes);
  const results: BatchAttendanceResultItem[] = [];

  for (const memberId of memberIds) {
    try {
      const result = await checkOutMember({
        actor,
        memberId,
        deviceId: input.deviceId ?? null,
        checkoutMethod,
        notes,
      });

      if (!result.ok) {
        results.push({
          memberId,
          success: false,
          status: result.status,
          message: result.message,
          code: result.code,
          sessionId: null,
          sessionType: input.sessionType ?? null,
          sessionName: input.sessionName ?? null,
          durationMinutes: null,
        });
        continue;
      }

      results.push({
        memberId,
        success: true,
        status: 200,
        message: "Member checked out.",
        code: null,
        sessionId: result.session.id,
        sessionType: input.sessionType ?? null,
        sessionName: input.sessionName ?? null,
        durationMinutes: result.durationMinutes,
      });
    } catch (error) {
      results.push({
        memberId,
        success: false,
        status: 500,
        message: error instanceof Error ? error.message : "Unexpected checkout failure.",
        code: "INTERNAL_ERROR",
        sessionId: null,
        sessionType: input.sessionType ?? null,
        sessionName: input.sessionName ?? null,
        durationMinutes: null,
      });
    }
  }

  return {
    ok: true as const,
    checkedOutCount: results.filter((result) => result.success).length,
    failedCount: results.filter((result) => !result.success).length,
    results,
  };
}

export async function getAttendanceAutomationConfigV1(input: AnalyticsScope & { organizationId: string }) {
  const supabase = createAdminClient();
  const [smsIntegration, whatsappIntegration, rulesResult] = await Promise.all([
    getConnectedMsg91Integration(input.organizationId, "msg91_sms"),
    getConnectedMsg91Integration(input.organizationId, "msg91_whatsapp"),
    supabase
      .from("automation_rules")
      .select("id, name, event_type, event_filters, status, priority, run_count, last_run_at")
      .eq("organization_id", input.organizationId)
      .order("priority", { ascending: false }),
  ]);

  if (rulesResult.error) {
    throw new Error(rulesResult.error.message);
  }

  const rules = (rulesResult.data ?? [])
    .filter(isAttendanceAutomationRule)
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      eventType: rule.event_type,
      status: rule.status,
      priority: rule.priority,
      runCount: rule.run_count,
      lastRunAt: rule.last_run_at ?? null,
      alertType: extractAutomationAlertType(rule),
    }));

  return {
    smsEnabled: smsIntegration?.status === "connected",
    whatsappEnabled: whatsappIntegration?.status === "connected",
    smsConfigured: Boolean(smsIntegration),
    whatsappConfigured: Boolean(whatsappIntegration),
    rules,
  };
}

export async function getAttendanceOccupancyAnalyticsV1(input: AnalyticsScope & { hours: number }) {
  const supabase = createAdminClient();
  const hours = Math.min(Math.max(input.hours, 1), 168);
  const since = subDays(new Date(), Math.max(Math.ceil(hours / 24), 1)).toISOString();

  let occupancyQuery = supabase
    .from("occupancy_log")
    .select("id, timestamp, members_in_gym, total_capacity, occupancy_percent, hour_of_day, day_of_week, branch_id")
    .gte("timestamp", since)
    .order("timestamp", { ascending: true });

  if (input.gymId) {
    occupancyQuery = occupancyQuery.eq("gym_id", input.gymId);
  } else {
    occupancyQuery = occupancyQuery.in("gym_id", input.gymIds);
  }
  if (input.branchId) {
    occupancyQuery = occupancyQuery.eq("branch_id", input.branchId);
  }

  const [occupancyResult, currentlyInside] = await Promise.all([
    occupancyQuery,
    getCurrentInsideCount(supabase, input.gymIds, input.gymId ?? null, input.branchId ?? null),
  ]);

  if (occupancyResult.error) {
    throw new Error(occupancyResult.error.message);
  }

  const snapshots = occupancyResult.data ?? [];
  return {
    currentlyInside,
    snapshots,
    heatmap: buildOccupancyHeatmap(snapshots),
  };
}

export async function sendAttendanceAlertV1(input: AnalyticsScope & {
  organizationId: string;
  actor: AttendanceActorContext;
  memberId: string;
  alertType: AttendanceAutomationAlertType;
  channels: AttendanceAutomationChannel[];
  message?: string | null;
}) {
  const supabase = createAdminClient();
  const channels = Array.from(new Set(input.channels));
  if (channels.length === 0) {
    return {
      ok: false as const,
      status: 400,
      code: "VALIDATION_ERROR",
      message: "At least one delivery channel is required.",
    };
  }

  const memberQuery = applyAnalyticsScope(
    supabase
      .from("members")
      .select("id, full_name, member_code, phone, email, gym_id, branch_id, last_attendance_date, status")
      .eq("id", input.memberId),
    input.gymIds,
    input.gymId,
    input.branchId,
  );

  const [{ data: member, error: memberError }, rule] = await Promise.all([
    memberQuery.maybeSingle(),
    ensureAttendanceAutomationRule(supabase, input.organizationId, input.actor.userId, input.alertType),
  ]);

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (!member) {
    return {
      ok: false as const,
      status: 404,
      code: "MEMBER_NOT_FOUND",
      message: "Member not found in this gym scope.",
    };
  }

  const message = (input.message ?? "").trim() || buildAttendanceAlertMessage(input.alertType, member.full_name, member.last_attendance_date);
  const results: Array<{
    channel: AttendanceAutomationChannel;
    success: boolean;
    message: string;
    providerMessage?: unknown;
  }> = [];

  for (const channel of channels) {
    try {
      if (!member.phone) {
        results.push({ channel, success: false, message: "Member has no phone number on file." });
        continue;
      }

      if (channel === "sms") {
        const smsResult = await sendCampaignSms({
          organizationId: input.organizationId,
          to: member.phone,
          message,
        });
        results.push({
          channel,
          success: smsResult.ok,
          message: smsResult.ok ? "SMS sent." : smsResult.error ?? "SMS delivery failed.",
        });
        continue;
      }

      const waResult = await sendCampaignWhatsApp({
        organizationId: input.organizationId,
        to: member.phone,
        message,
      });
      results.push({
        channel,
        success: waResult.ok,
        message: waResult.ok ? "WhatsApp sent." : waResult.error ?? "WhatsApp delivery failed.",
      });
    } catch (error) {
      results.push({
        channel,
        success: false,
        message: error instanceof Error ? error.message : "Unexpected delivery failure.",
      });
    }
  }

  const automationLogPayload = {
    memberId: member.id,
    alertType: input.alertType,
    channels: results,
    gymId: member.gym_id,
    branchId: member.branch_id ?? input.branchId ?? null,
  };

  const logStatus = results.every((result) => result.success) ? "completed" : results.some((result) => result.success) ? "completed" : "failed";
  await Promise.all([
    supabase.from("automation_logs").insert({
      rule_id: rule.id,
      event_type: "attendance.alert",
      event_data: automationLogPayload as Json,
      status: logStatus,
      result: automationLogPayload as Json,
      error_message: results.every((result) => result.success) ? null : results.filter((result) => !result.success).map((result) => result.message).join("; "),
    }),
    supabase.from("automation_rules").update({
      run_count: rule.run_count + 1,
      last_run_at: new Date().toISOString(),
    }).eq("id", rule.id),
    writeAuditLog({
      actorId: input.actor.userId,
      gymId: member.gym_id,
      branchId: member.branch_id ?? input.branchId ?? null,
      action: "attendance.alert_sent",
      entityType: "member",
      entityId: member.id,
      metadata: {
        alertType: input.alertType,
        channels: results.map((result) => result.channel),
      } as Json,
    }),
  ]);

  return {
    ok: true as const,
    memberId: member.id,
    memberName: member.full_name,
    alertType: input.alertType,
    message,
    channels: results,
    automationRuleId: rule.id,
  };
}
