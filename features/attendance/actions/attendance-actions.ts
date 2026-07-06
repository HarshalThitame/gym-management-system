"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { requireGymFrontDeskScope } from "@/features/reception/lib/access";
import { requireRole } from "@/lib/auth/guards";
import { hasRequiredRole } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { AccessValidationResult } from "@/types/attendance";
import type { Database, Json } from "@/types/database";
import {
  buildQrPayload,
  calculateVisitDurationMinutes,
  generateQrTokenValue,
  getInactiveBucket,
  hashQrToken,
  validateMembershipForAccess
} from "../lib/business-rules";
import { AccessDeviceSchema, CheckOutSchema, ManualCheckInSchema, QrCheckInSchema, RegenerateQrSchema } from "../schemas/attendance";
import { getActiveMembershipForMember } from "../services/attendance-service";
import { consumeQrTokenUsage } from "../lib/phase1-api";
import { writeAttendanceAuditLog } from "../lib/attendance-audit";
import {
  entitlementSimpleCatch,
  requireOrganizationFeatureAccess,
  type FeatureKey,
} from "@/features/entitlement";

type AppSupabase = SupabaseClient<Database>;
type AttendanceAlertSeverity = NonNullable<Database["public"]["Tables"]["attendance_alerts"]["Insert"]["severity"]>;
type InactivityAlertType = "inactive_7_days" | "inactive_15_days" | "inactive_30_days";
const inactivityAlertTypes: InactivityAlertType[] = ["inactive_7_days", "inactive_15_days", "inactive_30_days"];

export async function manualCheckInAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymFrontDeskScope(["super_admin", "gym_admin", "reception_staff"], "/reception/attendance");
  const context = scope;
  const entitlementError = await requireAttendanceFeatures(context, ["manual_attendance"], "attendance.manual_check_in");
  if (entitlementError) return entitlementError;
  const parsed = ManualCheckInSchema.safeParse({
    memberId: formData.get("memberId"),
    deviceId: formData.get("deviceId") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const result = await processCheckIn({
    context,
    memberId: parsed.data.memberId,
    source: "reception",
    deviceId: parsed.data.deviceId || null,
    qrTokenId: null,
    notes: parsed.data.notes || null
  });

  revalidateAttendancePaths(parsed.data.memberId);
  return result;
}

export async function qrCheckInAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymFrontDeskScope(["super_admin", "gym_admin", "reception_staff"], "/reception/attendance");
  const context = scope;
  const entitlementError = await requireAttendanceFeatures(context, ["manual_attendance", "qr_attendance"], "attendance.qr_check_in");
  if (entitlementError) return entitlementError;
  const parsed = QrCheckInSchema.safeParse({
    tokenValue: normalizeQrToken(String(formData.get("tokenValue") ?? "")),
    deviceId: formData.get("deviceId") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const tokenHash = hashQrToken(parsed.data.tokenValue);
  const { data: qrToken, error } = await supabase.from("qr_tokens").select("*").eq("token_hash", tokenHash).maybeSingle();

  if (error) {
    return { status: "error", message: error.message };
  }

  if (!qrToken) {
    await logAccessAttempt(supabase, context, {
      gymId: scope.gymId,
      memberId: null,
      membershipId: null,
      sessionId: null,
      qrTokenId: null,
      deviceId: parsed.data.deviceId || null,
      direction: "entry",
      source: "qr",
      decision: "denied",
      reasonCode: "qr_invalid",
      message: "QR token is invalid or revoked.",
      snapshot: { tokenHash } as Json
    });
    return { status: "error", message: "QR token is invalid or revoked." };
  }

  if (qrToken.gym_id !== scope.gymId) {
    await logAccessAttempt(supabase, context, {
      gymId: scope.gymId,
      memberId: qrToken.member_id,
      membershipId: null,
      sessionId: null,
      qrTokenId: qrToken.id,
      deviceId: parsed.data.deviceId || null,
      direction: "entry",
      source: "qr",
      decision: "denied",
      reasonCode: "wrong_gym",
      message: "QR token belongs to another gym.",
      snapshot: { qrGymId: qrToken.gym_id } as Json
    });
    return { status: "error", message: "This QR belongs to another gym." };
  }

  if (new Date(qrToken.expires_at) <= new Date()) {
    await Promise.all([
      supabase.from("qr_tokens").update({ status: "expired" }).eq("id", qrToken.id),
      createAttendanceAlert(supabase, context, {
        gymId: qrToken.gym_id,
        memberId: qrToken.member_id,
        sessionId: null,
        alertType: "qr_expired",
        severity: "medium",
        message: "Expired QR token attempted entry."
      }),
      logAccessAttempt(supabase, context, {
        gymId: qrToken.gym_id,
        memberId: qrToken.member_id,
        membershipId: null,
        sessionId: null,
        qrTokenId: qrToken.id,
        deviceId: parsed.data.deviceId || null,
        direction: "entry",
        source: "qr",
        decision: "denied",
        reasonCode: "qr_expired",
        message: "QR token has expired.",
        snapshot: { expiresAt: qrToken.expires_at } as Json
      })
    ]);
    return { status: "error", message: "QR token has expired. Ask the member to regenerate their QR." };
  }

  if (qrToken.status === "used") {
    await logAccessAttempt(supabase, context, {
      gymId: scope.gymId,
      memberId: qrToken.member_id,
      membershipId: null,
      sessionId: null,
      qrTokenId: qrToken.id,
      deviceId: parsed.data.deviceId || null,
      direction: "entry",
      source: "qr",
      decision: "denied",
      reasonCode: "qr_used",
      message: "QR token was already used.",
      snapshot: { qrTokenId: qrToken.id } as Json
    });
    return { status: "error", message: "QR token was already used." };
  }

  if (qrToken.status !== "active") {
    await logAccessAttempt(supabase, context, {
      gymId: scope.gymId,
      memberId: qrToken.member_id,
      membershipId: null,
      sessionId: null,
      qrTokenId: qrToken.id,
      deviceId: parsed.data.deviceId || null,
      direction: "entry",
      source: "qr",
      decision: "denied",
      reasonCode: "qr_invalid",
      message: "QR token is invalid or revoked.",
      snapshot: { qrTokenId: qrToken.id } as Json
    });
    return { status: "error", message: "QR token is invalid or revoked." };
  }

  const result = await processCheckIn({
    context,
    memberId: qrToken.member_id,
    source: "qr",
    deviceId: parsed.data.deviceId || null,
    qrTokenId: qrToken.id,
    notes: "QR check-in"
  });

  if (result.status === "success") {
    await consumeQrTokenUsage(supabase, qrToken.id).catch(() => {});
  }

  revalidateAttendancePaths(qrToken.member_id);
  return result;
}

export async function checkOutAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymFrontDeskScope(["super_admin", "gym_admin", "reception_staff"], "/reception/attendance");
  const context = scope;
  const entitlementError = await requireAttendanceFeatures(context, ["manual_attendance"], "attendance.check_out");
  if (entitlementError) return entitlementError;
  const parsed = CheckOutSchema.safeParse({
    sessionId: formData.get("sessionId") ?? "",
    memberId: formData.get("memberId") ?? "",
    deviceId: formData.get("deviceId") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const sessionQuery = supabase.from("attendance_sessions").select("*").eq("status", "inside").eq("gym_id", scope.gymId);
  const sessionResult = parsed.data.sessionId
    ? await sessionQuery.eq("id", parsed.data.sessionId).maybeSingle()
    : parsed.data.memberId
      ? await sessionQuery.eq("member_id", parsed.data.memberId).maybeSingle()
      : { data: null, error: null };
  const { data: session, error } = sessionResult;

  if (error || !session) {
    return { status: "error", message: error?.message ?? "No active check-in session found." };
  }

  const checkedOutAt = new Date().toISOString();
  const durationMinutes = calculateVisitDurationMinutes(session.check_in_at, checkedOutAt);
  const { error: updateError } = await supabase
    .from("attendance_sessions")
    .update({
      status: "checked_out",
      check_out_at: checkedOutAt,
      duration_minutes: durationMinutes,
      check_out_source: "reception",
      exit_device_id: parsed.data.deviceId || null,
      checked_out_by: scope.userId,
      notes: parsed.data.notes || session.notes
    })
    .eq("id", session.id);

  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  await Promise.all([
    supabase.from("exit_events").insert({
      gym_id: session.gym_id,
      attendance_session_id: session.id,
      member_id: session.member_id,
      exit_method: "manual",
      device_id: parsed.data.deviceId || null,
      metadata: { durationMinutes } as Json
    }),
    supabase.from("attendance_logs").insert({
      gym_id: session.gym_id,
      attendance_session_id: session.id,
      member_id: session.member_id,
      membership_id: session.membership_id,
      qr_token_id: session.qr_token_id,
      action: "check_out",
      source: "reception",
      result: "success",
      message: "Member checked out.",
      actor_id: scope.userId,
      device_id: parsed.data.deviceId || null,
      metadata: { durationMinutes } as Json
    }),
    logAccessAttempt(supabase, context, {
      gymId: session.gym_id,
      memberId: session.member_id,
      membershipId: session.membership_id,
      sessionId: session.id,
      qrTokenId: session.qr_token_id,
      deviceId: parsed.data.deviceId || null,
      direction: "exit",
      source: "reception",
      decision: "granted",
      reasonCode: "check_out_completed",
      message: "Exit recorded.",
      snapshot: { durationMinutes } as Json
    }),
    refreshAttendanceMetric(supabase, session.gym_id, session.check_in_at),
    writeAttendanceAudit(context, "attendance.checked_out", "attendance_session", session.id, { memberId: session.member_id, durationMinutes })
  ]);

  revalidateAttendancePaths(session.member_id);
  return { status: "success", message: `Checked out. Visit duration: ${durationMinutes} minutes.` };
}

export async function regenerateQrTokenAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["member", "super_admin", "organization_owner", "gym_admin", "reception_staff"], "/member/attendance");
  const entitlementError = await requireAttendanceFeatures(context, ["manual_attendance", "qr_attendance"], "attendance.qr_regenerate");
  if (entitlementError) return entitlementError;
  const parsed = RegenerateQrSchema.safeParse({
    memberId: formData.get("memberId")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("*").eq("id", parsed.data.memberId).maybeSingle();

  if (memberError || !member) {
    return { status: "error", message: memberError?.message ?? "Member not found." };
  }

  const isStaff = hasRequiredRole(context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff"]);
  const contextGymId = getContextGymId(context);
  if (isStaff && contextGymId && member.gym_id !== contextGymId) {
    return { status: "error", message: "Member does not belong to this gym." };
  }

  if (!isStaff && member.user_id !== context.userId) {
    return { status: "error", message: "You can only regenerate your own attendance QR." };
  }

  const writeClient = getSupabaseAdminClient() ?? supabase;
  const { data: previousToken } = await supabase
    .from("qr_tokens")
    .select("*")
    .eq("member_id", member.id)
    .eq("purpose", "attendance")
    .eq("status", "active")
    .maybeSingle();

  if (previousToken) {
    await writeClient.from("qr_tokens").update({ status: "revoked" }).eq("id", previousToken.id);
  }

  const tokenValue = generateQrTokenValue();
  const { data: token, error } = await writeClient
    .from("qr_tokens")
    .insert({
      gym_id: member.gym_id,
      member_id: member.id,
      token_value: tokenValue,
      token_hash: hashQrToken(tokenValue),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      regenerated_from_token_id: previousToken?.id ?? null,
      created_by: context.userId
    })
    .select("*")
    .maybeSingle();

  if (error || !token) {
    return { status: "error", message: error?.message ?? "QR regeneration failed." };
  }

  await Promise.all([
    writeClient.from("attendance_logs").insert({
      gym_id: member.gym_id,
      member_id: member.id,
      qr_token_id: token.id,
      action: previousToken ? "qr_regenerated" : "qr_generated",
      source: "member_app",
      result: "success",
      message: "Attendance QR regenerated.",
      actor_id: context.userId,
      metadata: { payload: buildQrPayload(token.token_value) } as Json
    }),
    writeAttendanceAudit(context, "attendance.qr_regenerated", "qr_token", token.id, { memberId: member.id })
  ]);

  revalidateAttendancePaths(member.id);
  return { status: "success", message: "Attendance QR regenerated." };
}

export async function syncInactivityAlertsAction(_previousState: AuthActionState): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/attendance");
  const context = scope;
  const entitlementError = await requireAttendanceFeatures(context, ["attendance_reports"], "attendance.inactivity_alerts.sync");
  if (entitlementError) return entitlementError;
  const supabase = await createSupabaseServerClient();
  const gymId = scope.gymId;
  let frequencyQuery = supabase.from("attendance_member_frequency").select("*");

  if (gymId) {
    frequencyQuery = frequencyQuery.eq("gym_id", gymId);
  }

  const { data: frequencyRows, error: frequencyError } = await frequencyQuery;
  if (frequencyError) {
    return { status: "error", message: frequencyError.message };
  }

  const inactiveRows = (frequencyRows ?? []).flatMap((row) => {
    const bucket = getInactiveBucket(row.last_visit_at);
    if (!row.member_id || !bucket) {
      return [];
    }
    return [{ ...row, member_id: row.member_id, bucket }];
  });

  if (inactiveRows.length === 0) {
    return { status: "success", message: "No inactive members require alerts." };
  }

  let existingQuery = supabase
    .from("attendance_alerts")
    .select("member_id,alert_type")
    .eq("status", "open")
    .in("alert_type", inactivityAlertTypes);

  if (gymId) {
    existingQuery = existingQuery.eq("gym_id", gymId);
  }

  const { data: existingAlerts, error: existingError } = await existingQuery;
  if (existingError) {
    return { status: "error", message: existingError.message };
  }

  const existingKeys = new Set((existingAlerts ?? []).map((alert) => `${alert.member_id ?? ""}:${alert.alert_type}`));
  const inserts = inactiveRows
    .filter((row) => !existingKeys.has(`${row.member_id}:${row.bucket}`))
    .map((row) => ({
      gym_id: row.gym_id ?? gymId,
      member_id: row.member_id,
      alert_type: row.bucket,
      severity: getInactivitySeverity(row.bucket),
      message: buildInactivityMessage(row.full_name, row.member_code, row.last_visit_at, row.bucket),
      created_by: scope.userId,
      metadata: {
        lastVisitAt: row.last_visit_at,
        visitCount: row.visit_count ?? 0,
        averageDurationMinutes: row.average_duration_minutes ?? 0,
        source: "manual_sync"
      } as Json
    }));

  if (inserts.length === 0) {
    return { status: "success", message: "Inactive member alerts are already up to date." };
  }

  const { error: insertError } = await supabase.from("attendance_alerts").insert(inserts);
  if (insertError) {
    return { status: "error", message: insertError.message };
  }

  await writeAttendanceAudit(context, "attendance.inactivity_alerts_synced", "attendance_alert", "bulk", { count: inserts.length });
  revalidatePath("/admin/attendance");
  return { status: "success", message: `${inserts.length} inactivity alert${inserts.length === 1 ? "" : "s"} generated.` };
}

export async function saveAccessDeviceAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/attendance");
  const context = scope;
  const parsed = AccessDeviceSchema.safeParse({
    deviceId: formData.get("deviceId") ?? "",
    deviceCode: formData.get("deviceCode"),
    name: formData.get("name"),
    deviceType: formData.get("deviceType"),
    location: formData.get("location") ?? "",
    status: formData.get("status")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const deviceFeature = getDeviceFeature(parsed.data.deviceType);
  const entitlementError = await requireAttendanceFeatures(
    context,
    ["manual_attendance", "attendance_api", ...(deviceFeature ? [deviceFeature] : [])],
    "attendance.device.save",
  );
  if (entitlementError) return entitlementError;

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: scope.gymId,
    device_code: parsed.data.deviceCode,
    name: parsed.data.name,
    device_type: parsed.data.deviceType,
    location: parsed.data.location || null,
    status: parsed.data.status,
    metadata: { integrationReady: true } as Json
  };
  const result = parsed.data.deviceId
    ? await supabase.from("access_devices").update(payload).eq("id", parsed.data.deviceId).select("id").maybeSingle()
    : await supabase.from("access_devices").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Access device save failed." };
  }

  await writeAttendanceAudit(context, parsed.data.deviceId ? "access_device.updated" : "access_device.created", "access_device", result.data.id, { deviceType: parsed.data.deviceType });
  revalidatePath("/admin/attendance");
  return { status: "success", message: parsed.data.deviceId ? "Access device updated." : "Access device created." };
}

async function processCheckIn(input: {
  context: AuthContext;
  memberId: string;
  source: "reception" | "qr";
  deviceId: string | null;
  qrTokenId: string | null;
  notes: string | null;
}): Promise<AuthActionState> {
  const supabase = await createSupabaseServerClient();
  const validation = await validateMemberAccess(input.memberId);
  const gymId = validation.member?.gym_id ?? getContextGymId(input.context);

  if (!validation.allowed || !validation.member) {
    await recordDeniedAccess(supabase, input.context, validation, {
      gymId,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      source: input.source
    });
    return { status: "error", message: validation.message };
  }

  const contextGymId = getContextGymId(input.context);
  if (contextGymId && validation.member.gym_id !== contextGymId) {
    const orgId = (input.context as AuthContext & { organizationId?: string | null }).organizationId ?? null;
    const crossBranchResult = orgId ? await tryCrossBranchAccess(
      orgId,
      supabase,
      input,
      validation,
      contextGymId
    ) : null;

    if (crossBranchResult !== null) {
      return crossBranchResult;
    }

    await recordDeniedAccess(supabase, input.context, {
      ...validation,
      allowed: false,
      reasonCode: "wrong_gym",
      message: "Member does not belong to this gym."
    }, {
      gymId: contextGymId,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      source: input.source
    });
    return { status: "error", message: "Member does not belong to this gym." };
  }

  const branchScope = await resolveAttendanceBranchScope(supabase, {
    gymId,
    contextBranchId: getContextBranchId(input.context),
    memberBranchId: validation.member.branch_id
  });
  if (!branchScope.ok) {
    await recordDeniedAccess(supabase, input.context, {
      ...validation,
      allowed: false,
      reasonCode: "branch_scope_required",
      message: branchScope.message
    }, {
      gymId,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      source: input.source
    });
    return { status: "error", message: branchScope.message };
  }

  if (!validation.member.branch_id && branchScope.branchId) {
    await supabase.from("members").update({ branch_id: branchScope.branchId }).eq("id", validation.member.id);
  }

  const { data: existingSession, error: existingError } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("member_id", input.memberId)
    .eq("status", "inside")
    .maybeSingle();

  if (existingError) {
    return { status: "error", message: existingError.message };
  }

  if (existingSession) {
    await Promise.all([
      createAttendanceAlert(supabase, input.context, {
        gymId,
        memberId: input.memberId,
        sessionId: existingSession.id,
        alertType: "duplicate_check_in",
        severity: "medium",
        message: "Duplicate check-in attempt while member is already inside."
      }),
      logAccessAttempt(supabase, input.context, {
        gymId,
        memberId: input.memberId,
        membershipId: validation.membership?.id ?? null,
        sessionId: existingSession.id,
        qrTokenId: input.qrTokenId,
        deviceId: input.deviceId,
        direction: "entry",
        source: input.source,
        decision: "warning",
        reasonCode: "duplicate_check_in",
        message: "Member is already checked in.",
        snapshot: { existingSessionId: existingSession.id } as Json
      }),
      supabase.from("attendance_logs").insert({
        gym_id: gymId,
        attendance_session_id: existingSession.id,
        member_id: input.memberId,
        membership_id: validation.membership?.id ?? null,
        qr_token_id: input.qrTokenId,
        action: "duplicate_attempt",
        source: input.source,
        result: "warning",
        reason_code: "duplicate_check_in",
        message: "Duplicate check-in attempt.",
        actor_id: input.context.userId,
        device_id: input.deviceId,
        metadata: {} as Json
      })
    ]);
    return { status: "error", message: "Member is already checked in." };
  }

  const { data: session, error } = await supabase
    .from("attendance_sessions")
    .insert({
      gym_id: gymId,
      branch_id: branchScope.branchId,
      member_id: validation.member.id,
      membership_id: validation.membership?.id ?? null,
      qr_token_id: input.qrTokenId,
      check_in_source: input.source,
      entry_device_id: input.deviceId,
      created_by: input.context.userId,
      notes: input.notes
    })
    .select("*")
    .maybeSingle();

  if (error || !session) {
    return { status: "error", message: error?.message ?? "Check-in failed." };
  }

  await Promise.all([
    supabase.from("entry_events").insert({
      gym_id: gymId,
      attendance_session_id: session.id,
      member_id: validation.member.id,
      entry_method: input.source === "qr" ? "qr" : "manual",
      device_id: input.deviceId,
      verification_result: "granted",
      metadata: { membershipId: validation.membership?.id ?? null } as Json
    }),
    supabase.from("attendance_logs").insert({
      gym_id: gymId,
      attendance_session_id: session.id,
      member_id: validation.member.id,
      membership_id: validation.membership?.id ?? null,
      qr_token_id: input.qrTokenId,
      action: "check_in",
      source: input.source,
      result: "success",
      message: "Member checked in.",
      actor_id: input.context.userId,
      device_id: input.deviceId,
      metadata: { memberCode: validation.member.member_code, branchId: branchScope.branchId } as Json
    }),
    logAccessAttempt(supabase, input.context, {
      gymId,
      memberId: validation.member.id,
      membershipId: validation.membership?.id ?? null,
      sessionId: session.id,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      direction: "entry",
      source: input.source,
      decision: "granted",
      reasonCode: "access_granted",
      message: "Entry granted.",
      snapshot: { membershipStatus: validation.membership?.status ?? null, branchId: branchScope.branchId } as Json
    }),
    refreshAttendanceMetric(supabase, gymId, session.check_in_at),
    writeAttendanceAudit(input.context, "attendance.checked_in", "attendance_session", session.id, { memberId: validation.member.id, source: input.source, branchId: branchScope.branchId })
  ]);

  // Award loyalty points for check-in (fire and forget — don't block check-in)
  const orgId = (input.context as AuthContext & { organizationId?: string | null }).organizationId ?? null;
  if (orgId && validation.member) {
    import("@/features/organization-owner/actions/loyalty-actions").then(({ earnPoints }) =>
      earnPoints(orgId, validation.member!.id, "check_in", session.id, "Daily check-in").catch(() => {})
    ).catch(() => {});
    // Fire outgoing webhook (never blocks check-in)
    import("@/features/webhooks/trigger").then(({ triggerWebhook }) =>
      triggerWebhook(orgId, "check_in", { memberId: validation.member!.id, name: validation.member!.full_name, gymId, sessionId: session.id }).catch(() => {})
    ).catch(() => {});
  }

  return { status: "success", message: `${validation.member.full_name} checked in.` };
}

function getDeviceFeature(deviceType: string): FeatureKey | null {
  if (deviceType === "qr") return "qr_attendance";
  if (deviceType === "rfid") return "rfid_attendance";
  if (deviceType === "nfc") return "nfc_attendance";
  if (["biometric", "fingerprint", "face"].includes(deviceType)) return "biometric_attendance";
  return null;
}

async function requireAttendanceFeatures(
  context: AuthContext & { scopedOrganizationId?: string | null },
  featureKeys: readonly FeatureKey[],
  actionName: string,
): Promise<AuthActionState | null> {
  const organizationId = context.scopedOrganizationId ?? context.organizationId;
  if (!organizationId) {
    return { status: "error", message: "Organization scope could not be resolved." };
  }

  try {
    await requireOrganizationFeatureAccess({
      organizationId,
      featureKey: featureKeys,
      actionName,
    });
    return null;
  } catch (error) {
    return entitlementSimpleCatch(error, "Attendance feature access could not be verified.") as AuthActionState;
  }
}

async function validateMemberAccess(memberId: string): Promise<AccessValidationResult> {
  const supabase = await createSupabaseServerClient();
  const [{ data: member, error: memberError }, membership] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).maybeSingle(),
    getActiveMembershipForMember(memberId)
  ]);

  if (memberError || !member) {
    return {
      allowed: false,
      reasonCode: "member_not_found",
      message: memberError?.message ?? "Member not found.",
      member: null,
      membership: null
    };
  }

  const result = validateMembershipForAccess(membership);
  return {
    ...result,
    member,
    membership
  };
}

async function recordDeniedAccess(
  supabase: AppSupabase,
  context: AuthContext,
  validation: AccessValidationResult,
  input: {
    gymId: string | null;
    qrTokenId: string | null;
    deviceId: string | null;
    source: "reception" | "qr";
  }
) {
  const alertType = mapReasonToAlert(validation.reasonCode);
  await Promise.all([
    validation.member
      ? supabase.from("attendance_logs").insert({
          gym_id: input.gymId,
          member_id: validation.member.id,
          membership_id: validation.membership?.id ?? null,
          qr_token_id: input.qrTokenId,
          action: "access_denied",
          source: input.source,
          result: "denied",
          reason_code: validation.reasonCode,
          message: validation.message,
          actor_id: context.userId,
          device_id: input.deviceId,
          metadata: {} as Json
        })
      : Promise.resolve(),
    alertType && validation.member
      ? createAttendanceAlert(supabase, context, {
          gymId: input.gymId,
          memberId: validation.member.id,
          sessionId: null,
          alertType,
          severity: alertType === "membership_suspended" ? "high" : "medium",
          message: validation.message
        })
      : Promise.resolve(),
    logAccessAttempt(supabase, context, {
      gymId: input.gymId,
      memberId: validation.member?.id ?? null,
      membershipId: validation.membership?.id ?? null,
      sessionId: null,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      direction: "entry",
      source: input.source,
      decision: "denied",
      reasonCode: validation.reasonCode,
      message: validation.message,
      snapshot: { membershipStatus: validation.membership?.status ?? null } as Json
    })
  ]);
}

async function logAccessAttempt(
  supabase: AppSupabase,
  context: AuthContext,
  input: {
    gymId: string | null;
    memberId: string | null;
    membershipId: string | null;
    sessionId: string | null;
    qrTokenId: string | null;
    deviceId: string | null;
    direction: "entry" | "exit" | "validation";
    source: "reception" | "qr" | "member_app" | "device" | "system";
    decision: "granted" | "denied" | "warning";
    reasonCode: string;
    message: string;
    snapshot: Json;
  }
) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = requestHeaders.get("user-agent");
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
    actor_id: context.userId,
    ip_address: forwardedFor,
    user_agent: userAgent
  });
}

async function createAttendanceAlert(
  supabase: AppSupabase,
  context: AuthContext,
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
    created_by: context.userId,
    metadata: {} as Json
  });
}

async function refreshAttendanceMetric(supabase: AppSupabase, gymId: string | null, dateSource: string) {
  const metricDate = dateSource.slice(0, 10);
  let query = supabase
    .from("attendance_sessions")
    .select("id,member_id,duration_minutes,check_in_at")
    .gte("check_in_at", `${metricDate}T00:00:00.000Z`)
    .lte("check_in_at", `${metricDate}T23:59:59.999Z`);

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  const { data } = await query;
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
    generated_at: new Date().toISOString()
  }, { onConflict: "gym_id,metric_date" });
}

function mapReasonToAlert(reasonCode: string): Database["public"]["Tables"]["attendance_alerts"]["Insert"]["alert_type"] | null {
  if (reasonCode === "membership_expired") {
    return "membership_expired";
  }
  if (reasonCode === "membership_suspended") {
    return "membership_suspended";
  }
  if (reasonCode === "membership_frozen") {
    return "membership_frozen";
  }
  if (reasonCode.startsWith("membership") || reasonCode === "payment_pending" || reasonCode === "no_membership") {
    return "membership_invalid";
  }
  return null;
}

function getInactivitySeverity(bucket: InactivityAlertType): AttendanceAlertSeverity {
  if (bucket === "inactive_30_days") {
    return "high";
  }
  if (bucket === "inactive_15_days") {
    return "medium";
  }
  return "low";
}

function buildInactivityMessage(fullName: string | null, memberCode: string | null, lastVisitAt: string | null, bucket: InactivityAlertType) {
  const memberLabel = [fullName ?? "Member", memberCode ? `(${memberCode})` : ""].filter(Boolean).join(" ");
  const inactiveLabel = bucket.replace("inactive_", "").replace("_days", " days");
  return lastVisitAt
    ? `${memberLabel} has not visited for ${inactiveLabel}. Last visit: ${lastVisitAt.slice(0, 10)}.`
    : `${memberLabel} has no recorded visits and is treated as inactive for 30 days.`;
}

function normalizeQrToken(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("token=")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get("token") ?? trimmed;
    } catch {
      return trimmed.split("token=").at(-1)?.trim() ?? trimmed;
    }
  }
  return trimmed;
}

async function writeAttendanceAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await writeAttendanceAuditLog({
    actorId: context.userId,
    gymId: getContextGymId(context),
    branchId: getContextBranchId(context),
    action,
    entityType,
    entityId,
    workflow: action.startsWith("attendance.") ? "check_in" : "reconciliation",
    source: typeof (metadata as Record<string, unknown>).source === "string" ? String((metadata as Record<string, unknown>).source) : null,
    reasonCode: typeof (metadata as Record<string, unknown>).reasonCode === "string" ? String((metadata as Record<string, unknown>).reasonCode) : null,
    metadata
  });
}

function getContextGymId(context: AuthContext) {
  return (context as AuthContext & { gymId?: string | null }).gymId ?? context.profile?.gym_id ?? null;
}

function getContextBranchId(context: AuthContext) {
  return (context as AuthContext & { branchId?: string | null }).branchId ?? null;
}

async function resolveAttendanceBranchScope(
  supabase: AppSupabase,
  input: {
    gymId: string | null;
    contextBranchId: string | null;
    memberBranchId: string | null;
  }
): Promise<{ ok: true; branchId: string } | { ok: false; message: string }> {
  if (!input.gymId) {
    return { ok: false, message: "A gym scope is required before attendance can be recorded." };
  }

  const preferredBranchId = input.memberBranchId ?? input.contextBranchId;
  if (preferredBranchId) {
    const { data, error } = await supabase
      .from("branches")
      .select("id, gym_id, status")
      .eq("id", preferredBranchId)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data || data.gym_id !== input.gymId || data.status === "archived") {
      return { ok: false, message: "Selected branch is not available for this gym. Choose the correct branch before check-in." };
    }

    return { ok: true, branchId: data.id };
  }

  const { data: branches, error } = await supabase
    .from("branches")
    .select("id")
    .eq("gym_id", input.gymId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!branches || branches.length === 0) {
    return { ok: false, message: "Create a branch under this gym before recording attendance." };
  }

  if (branches.length > 1) {
    return { ok: false, message: "Select a branch context before recording attendance for a multi-branch gym." };
  }

  const branch = branches[0];
  if (!branch) {
    return { ok: false, message: "Create a branch under this gym before recording attendance." };
  }

  return { ok: true, branchId: branch.id };
}

async function tryCrossBranchAccess(
  organizationId: string,
  supabase: AppSupabase,
  input: {
    context: AuthContext;
    memberId: string;
    source: "reception" | "qr";
    deviceId: string | null;
    qrTokenId: string | null;
    notes: string | null;
  },
  validation: AccessValidationResult,
  contextGymId: string
): Promise<AuthActionState | null> {
  try {
    const adminDb = getSupabaseAdminClient();

    const { evaluateCrossBranchAccess } = await import(
      "@/features/organization-owner/actions/cross-branch-actions"
    );

    const access = await evaluateCrossBranchAccess(
      organizationId,
      input.memberId,
      validation.member!.gym_id,
      contextGymId,
      validation.member!.branch_id
    );

    if (access.allowed) {
      if (adminDb) {
        await adminDb.from("cross_branch_access_logs").insert({
          organization_id: organizationId,
          member_id: input.memberId,
          from_gym_id: validation.member!.gym_id,
          to_gym_id: contextGymId,
          rule_id: access.ruleId ?? null,
          rule_name: access.ruleName ?? null,
          decision: "allowed",
          reason: "Cross-branch access allowed"
        });
      }
      return null;
    }

    if (adminDb) {
      await adminDb.from("cross_branch_access_logs").insert({
        organization_id: organizationId,
        member_id: input.memberId,
        from_gym_id: validation.member!.gym_id,
        to_gym_id: contextGymId,
        rule_id: access.ruleId ?? null,
        rule_name: access.ruleName ?? null,
        decision: "denied",
        reason: access.reason ?? "No cross-branch access rule"
      });
    }

    await recordDeniedAccess(supabase, input.context, {
      ...validation,
      allowed: false,
      reasonCode: "cross_branch_denied",
      message: "Cross-branch access not permitted for this member."
    }, {
      gymId: contextGymId,
      qrTokenId: input.qrTokenId,
      deviceId: input.deviceId,
      source: input.source
    });

    return { status: "error", message: "Cross-branch access not permitted." };
  } catch {
    return null;
  }
}

function revalidateAttendancePaths(memberId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
  revalidatePath("/reception");
  revalidatePath("/reception/attendance");
  revalidatePath("/member");
  revalidatePath("/member/attendance");
  revalidatePath("/trainer/attendance");
  if (memberId) {
    revalidatePath(`/admin/members/${memberId}`);
  }
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}
