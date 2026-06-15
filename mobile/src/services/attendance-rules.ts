import { getSupabaseClient } from "@/api/supabase";
import type { AttendanceMethod } from "@/types";

export interface AttendanceValidationResult {
  ok: boolean;
  error?: string;
  code?: string;
  memberId?: string;
  gymId?: string;
  organizationId?: string;
  branchId?: string | null;
}

export interface CheckInContext {
  memberId: string;
  gymId: string;
  branchId?: string | null;
  method: AttendanceMethod;
  organizationId?: string;
}

export const attendanceRules = {
  async validateCheckIn(memberId: string, gymId: string): Promise<AttendanceValidationResult> {
    const supabase = getSupabaseClient();

    // 1. Verify member exists and is active
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, gym_id, organization_id, status, branch_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError || !member) {
      return { ok: false, error: "Member not found.", code: "MEMBER_NOT_FOUND" };
    }

    if (member.status !== "active") {
      return { ok: false, error: "Member account is not active.", code: "MEMBER_INACTIVE" };
    }

    // 2. Verify gym exists
    const { data: gym } = await supabase
      .from("gyms")
      .select("id, organization_id, status")
      .eq("id", gymId)
      .maybeSingle();

    if (!gym || gym.status !== "active") {
      return { ok: false, error: "Gym is not active.", code: "GYM_INACTIVE" };
    }

    // 3. Verify member belongs to same organization
    if (member.organization_id !== gym.organization_id) {
      return { ok: false, error: "Member does not belong to this organization.", code: "ORG_MISMATCH" };
    }

    // 4. Check membership is active
    const { data: membership } = await supabase
      .from("memberships")
      .select("id, status, end_date, plan_id")
      .eq("member_id", memberId)
      .in("status", ["active", "frozen"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return { ok: false, error: "No active membership found.", code: "NO_MEMBERSHIP" };
    }

    if (membership.status === "frozen") {
      return { ok: false, error: "Membership is frozen. Cannot check in.", code: "MEMBERSHIP_FROZEN" };
    }

    if (membership.end_date && new Date(membership.end_date) < new Date()) {
      return { ok: false, error: "Membership has expired.", code: "MEMBERSHIP_EXPIRED" };
    }

    // 5. Duplicate prevention - already checked in today?
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existingSession } = await supabase
      .from("attendance_sessions")
      .select("id, status")
      .eq("member_id", memberId)
      .gte("check_in_at", todayStart.toISOString())
      .eq("status", "active")
      .maybeSingle();

    if (existingSession) {
      return { ok: false, error: "Already checked in. Please check out first.", code: "ALREADY_CHECKED_IN" };
    }

    // 6. Check plan entitlements for attendance
    if (membership.plan_id) {
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("features")
        .eq("id", membership.plan_id)
        .maybeSingle();

      if (plan?.features) {
        const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
        if (features.attendance === false) {
          return { ok: false, error: "Your plan does not include attendance.", code: "PLAN_NO_ATTENDANCE" };
        }
      }
    }

    return {
      ok: true,
      memberId: member.id,
      gymId: gym.id,
      organizationId: member.organization_id,
      branchId: member.branch_id,
    };
  },

  async validateCheckOut(memberId: string, sessionId: string): Promise<AttendanceValidationResult> {
    const supabase = getSupabaseClient();

    const { data: session } = await supabase
      .from("attendance_sessions")
      .select("id, member_id, status, check_in_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return { ok: false, error: "Attendance session not found.", code: "SESSION_NOT_FOUND" };
    }

    if (session.member_id !== memberId) {
      return { ok: false, error: "Session does not belong to this member.", code: "SESSION_MISMATCH" };
    }

    if (session.status === "completed") {
      return { ok: false, error: "Already checked out.", code: "ALREADY_CHECKED_OUT" };
    }

    return { ok: true, memberId, gymId: "" };
  },

  async getVisitDuration(sessionId: string): Promise<{ durationMinutes: number; checkedInAt: Date; checkedOutAt?: Date } | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("attendance_sessions")
      .select("check_in_at, check_out_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!data) return null;

    const checkIn = new Date(data.check_in_at);
    const checkOut = data.check_out_at ? new Date(data.check_out_at) : new Date();
    const durationMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);

    return {
      durationMinutes,
      checkedInAt: checkIn,
      checkedOutAt: data.check_out_at ? checkOut : undefined,
    };
  },

  async autoCheckOutStaleSessions(maxMinutes = 480): Promise<number> {
    const supabase = getSupabaseClient();
    const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000).toISOString();

    const { data: stale } = await supabase
      .from("attendance_sessions")
      .select("id, member_id, check_in_at")
      .eq("status", "active")
      .lte("check_in_at", cutoff);

    if (!stale || stale.length === 0) return 0;

    const { error } = await supabase
      .from("attendance_sessions")
      .update({
        status: "completed",
        check_out_at: new Date().toISOString(),
        metadata: { auto_checkout: true, auto_checkout_reason: "Session timeout" },
      })
      .in("id", stale.map((s) => s.id));

    if (error) return 0;
    return stale.length;
  },

  async getMemberAttendanceEligibility(memberId: string): Promise<{
    eligible: boolean;
    reason?: string;
    canCheckIn: boolean;
    canCheckOut: boolean;
    currentSessionId?: string;
  }> {
    const supabase = getSupabaseClient();

    const { data: member } = await supabase
      .from("members")
      .select("id, status, organization_id")
      .eq("id", memberId)
      .maybeSingle();

    if (!member) return { eligible: false, reason: "Member not found.", canCheckIn: false, canCheckOut: false };
    if (member.status !== "active") return { eligible: false, reason: "Account not active.", canCheckIn: false, canCheckOut: false };

    const { data: membership } = await supabase
      .from("memberships")
      .select("id, status, end_date")
      .eq("member_id", memberId)
      .in("status", ["active", "frozen"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership) return { eligible: false, reason: "No membership.", canCheckIn: false, canCheckOut: false };
    if (membership.status === "frozen") return { eligible: false, reason: "Membership frozen.", canCheckIn: false, canCheckOut: false };
    if (membership.end_date && new Date(membership.end_date) < new Date()) return { eligible: false, reason: "Membership expired.", canCheckIn: false, canCheckOut: false };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: activeSession } = await supabase
      .from("attendance_sessions")
      .select("id, status")
      .eq("member_id", memberId)
      .gte("check_in_at", todayStart.toISOString())
      .eq("status", "active")
      .maybeSingle();

    return {
      eligible: true,
      canCheckIn: !activeSession,
      canCheckOut: !!activeSession,
      currentSessionId: activeSession?.id,
    };
  },
};
