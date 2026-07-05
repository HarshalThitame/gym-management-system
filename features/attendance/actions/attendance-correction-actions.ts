"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { requireOrganizationFeatureAccess, entitlementSimpleCatch } from "@/features/entitlement";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Json } from "@/types/database";

const ReversalSchema = z.object({
  logId: z.string().uuid(),
  reason: z.string().trim().min(4).max(500),
});

const CorrectionSchema = z.object({
  sessionId: z.string().uuid(),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  reason: z.string().trim().min(4).max(500),
});

export async function reverseAttendanceAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const scope = await requireGymAdminScope("/admin/attendance");
    const orgId = scope.scopedOrganizationId ?? scope.organizationId;
    if (orgId) {
      try {
        await requireOrganizationFeatureAccess({ organizationId: orgId, featureKey: "attendance_reports", actionName: "attendance.reverse" });
      } catch (e) {
        return entitlementSimpleCatch(e, "Attendance feature access denied.") as AuthActionState;
      }
    }

    const parsed = ReversalSchema.safeParse({
      logId: formData.get("logId"),
      reason: formData.get("reason"),
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("*, attendance_sessions!attendance_session_id(gym_id, member_id, check_in_at, check_out_at, status)")
      .eq("id", parsed.data.logId)
      .single();

    if (!log) return { status: "error", message: "Attendance record not found." };

    const session = log.attendance_sessions as unknown as {
      gym_id: string | null;
      member_id: string;
      check_in_at: string;
      check_out_at: string | null;
      status: string;
    } | null;

    const gymId = session?.gym_id ?? scope.gymId;

    const { error: logError } = await supabase.from("attendance_logs").update({
      result: "reversed",
      reason_code: "manual_reversal",
      message: `Reversed: ${parsed.data.reason}`,
      metadata: { reversedBy: scope.userId, originalAction: log.action, originalResult: log.result, reason: parsed.data.reason } as Json,
    }).eq("id", parsed.data.logId);

    if (logError) return { status: "error", message: logError.message };

    if (session && session.status !== "checked_out" && session.status !== "auto_closed") {
      await supabase.from("attendance_sessions").update({
        status: "void",
        notes: `Session voided due to log reversal: ${parsed.data.reason}`,
      }).eq("id", log.attendance_session_id);
    }

    await supabase.from("attendance_logs").insert({
      gym_id: gymId,
      attendance_session_id: log.attendance_session_id,
      member_id: log.member_id,
      action: "correction",
      source: "staff",
      result: "success",
      reason_code: "manual_reversal",
      message: `Log ${parsed.data.logId} reversed: ${parsed.data.reason}`,
      actor_id: scope.userId,
      metadata: { reversedLogId: parsed.data.logId, reason: parsed.data.reason } as Json,
    });

    await writeAuditLog({
      actorId: scope.userId,
      gymId,
      action: "attendance.log_reversed",
      entityType: "attendance_log",
      entityId: parsed.data.logId,
      metadata: { reason: parsed.data.reason },
    });

    revalidatePath("/admin/attendance");
    revalidatePath("/reception/attendance");
    revalidatePath("/organization/attendance");

    return { status: "success", message: "Attendance record reversed successfully." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "An unexpected error occurred." };
  }
}

export async function correctAttendanceTimesAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const scope = await requireGymAdminScope("/admin/attendance");
    const orgId = scope.scopedOrganizationId ?? scope.organizationId;
    if (orgId) {
      try {
        await requireOrganizationFeatureAccess({ organizationId: orgId, featureKey: "attendance_reports", actionName: "attendance.correct_times" });
      } catch (e) {
        return entitlementSimpleCatch(e, "Attendance feature access denied.") as AuthActionState;
      }
    }

    const parsed = CorrectionSchema.safeParse({
      sessionId: formData.get("sessionId"),
      checkInAt: formData.get("checkInAt") || undefined,
      checkOutAt: formData.get("checkOutAt") || undefined,
      reason: formData.get("reason"),
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data: session } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("id", parsed.data.sessionId)
      .single();

    if (!session) return { status: "error", message: "Session not found." };

    const updates: Record<string, string | number> = {};
    if (parsed.data.checkInAt) updates.check_in_at = parsed.data.checkInAt;
    if (parsed.data.checkOutAt) updates.check_out_at = parsed.data.checkOutAt;

    if (Object.keys(updates).length === 0) {
      return { status: "error", message: "Provide at least one time to correct." };
    }

    const checkInTime = parsed.data.checkInAt ? new Date(parsed.data.checkInAt).getTime() : new Date(session.check_in_at).getTime();
    const checkOutTime = parsed.data.checkOutAt ? new Date(parsed.data.checkOutAt).getTime() : (session.check_out_at ? new Date(session.check_out_at).getTime() : 0);

    if (checkOutTime > 0 && checkOutTime <= checkInTime) {
      return { status: "error", message: "Check-out must be after check-in." };
    }

    if (checkOutTime > 0) {
      updates.duration_minutes = Math.round((checkOutTime - checkInTime) / 60000);
    }

    const { error: updateError } = await supabase
      .from("attendance_sessions")
      .update({ ...updates, notes: `${session.notes ?? ""}\nCorrected: ${parsed.data.reason}`.trim() })
      .eq("id", parsed.data.sessionId);

    if (updateError) return { status: "error", message: updateError.message };

    await supabase.from("attendance_logs").insert({
      gym_id: session.gym_id,
      attendance_session_id: session.id,
      member_id: session.member_id,
      action: "correction",
      source: "staff",
      result: "success",
      reason_code: "time_correction",
      message: `Times corrected: ${parsed.data.reason}`,
      actor_id: scope.userId,
      metadata: { previousCheckIn: session.check_in_at, previousCheckOut: session.check_out_at, newTimes: updates, reason: parsed.data.reason } as Json,
    });

    await writeAuditLog({
      actorId: scope.userId,
      gymId: session.gym_id,
      action: "attendance.times_corrected",
      entityType: "attendance_session",
      entityId: parsed.data.sessionId,
      metadata: { previousCheckIn: session.check_in_at, previousCheckOut: session.check_out_at, newTimes: updates, reason: parsed.data.reason },
    });

    revalidatePath("/admin/attendance");
    revalidatePath("/reception/attendance");
    revalidatePath("/organization/attendance");

    return { status: "success", message: "Attendance times corrected." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "An unexpected error occurred." };
  }
}
