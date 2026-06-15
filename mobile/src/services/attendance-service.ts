import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { AttendanceSession, AttendanceMethod } from "@/types";
import { syncEngine } from "@/offline/sync-engine";
import { attendanceRules } from "./attendance-rules";
import { qrSecurityService } from "./qr-security-service";
import { attendanceNotifications } from "./attendance-notifications";
import { attendanceAudit } from "./attendance-audit";
import { attendanceGamification } from "./attendance-gamification";

export const attendanceService = {
  async getTodayStatus(memberId: string): Promise<{ checkedIn: boolean; checkedOut: boolean; session: AttendanceSession | null }> {
    const supabase = getSupabaseClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("member_id", memberId)
      .gte("check_in_at", todayStart.toISOString())
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { checkedIn: false, checkedOut: false, session: null };

    return {
      checkedIn: true,
      checkedOut: data.status === "completed",
      session: data as AttendanceSession,
    };
  },

  async checkIn(memberId: string, gymId: string, method: AttendanceMethod = "qr"): Promise<{ ok: boolean; error?: string; sessionId?: string }> {
    try {
      const validation = await attendanceRules.validateCheckIn(memberId, gymId);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("attendance_sessions").insert({
        member_id: memberId,
        gym_id: gymId,
        organization_id: validation.organizationId,
        branch_id: validation.branchId ?? null,
        method,
        status: "active",
        check_in_at: new Date().toISOString(),
      }).select("id").maybeSingle();

      if (error) return { ok: false, error: error.message };

      const sessionId = data?.id;
      if (sessionId) {
        await attendanceAudit.log({ action: "check_in", memberId, gymId, sessionId, method });
        await attendanceNotifications.sendCheckInConfirmation(memberId, gymId);
      }

      return { ok: true, sessionId };
    } catch {
      return { ok: false, error: "Check-in failed. Please try again." };
    }
  },

  async checkInWithQR(qrData: string, scannerGymId: string): Promise<{ ok: boolean; error?: string; memberId?: string; sessionId?: string }> {
    const validation = await qrSecurityService.validateQR(qrData, scannerGymId);
    if (!validation.ok || !validation.memberId) {
      return { ok: false, error: validation.error };
    }

    const sessionResult = await this.checkIn(validation.memberId, scannerGymId, "qr");
    return {
      ok: sessionResult.ok,
      error: sessionResult.error,
      memberId: validation.memberId,
      sessionId: sessionResult.sessionId,
    };
  },

  async checkOut(memberId: string, sessionId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const validation = await attendanceRules.validateCheckOut(memberId, sessionId);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ check_out_at: new Date().toISOString(), status: "completed" })
        .eq("id", sessionId)
        .eq("member_id", memberId);

      if (error) return { ok: false, error: error.message };

      await attendanceAudit.log({ action: "check_out", memberId, gymId: "", sessionId });
      await attendanceNotifications.sendCheckOutConfirmation(memberId, sessionId);

      const streak = await this.calculateStreak(await this.getHistory(memberId, 365));
      const totalVisits = (await this.getHistory(memberId, 10000)).length;
      const newBadges = await attendanceGamification.checkAndAwardBadges(memberId, streak, totalVisits);
      if (newBadges.length > 0 && streak >= 7) {
        await attendanceNotifications.sendAttendanceMilestone(memberId, `${streak}-Day Streak`, streak);
      }

      return { ok: true };
    } catch {
      return { ok: false, error: "Check-out failed. Please try again." };
    }
  },

  async checkInOffline(memberId: string, gymId: string): Promise<void> {
    await syncEngine.enqueue({
      type: "attendance_check_in",
      endpoint: `/members/${memberId}/attendance/check-in`,
      method: "POST",
      payload: { member_id: memberId, gym_id: gymId, method: "qr" },
    });
  },

  async getEligibility(memberId: string) {
    return attendanceRules.getMemberAttendanceEligibility(memberId);
  },

  async getVisitDuration(sessionId: string) {
    return attendanceRules.getVisitDuration(sessionId);
  },

  async getHistory(memberId: string, limit = 30): Promise<AttendanceSession[]> {
    const cacheKey = offlineCache.memberKey(memberId, `attendance:${limit}`);
    const cached = await offlineCache.get<AttendanceSession[]>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("member_id", memberId)
        .order("check_in_at", { ascending: false })
        .limit(limit);

      const sessions = (data ?? []) as AttendanceSession[];
      await offlineCache.set(cacheKey, sessions, { ttlMs: 5 * 60 * 1000 });
      return sessions;
    } catch {
      if (cached) return cached.data;
      return [];
    }
  },

  async getMonthlyStats(memberId: string, year: number, month: number) {
    const supabase = getSupabaseClient();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const { data } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("member_id", memberId)
      .gte("check_in_at", startOfMonth.toISOString())
      .lte("check_in_at", endOfMonth.toISOString())
      .order("check_in_at", { ascending: true });

    const sessions = (data ?? []) as AttendanceSession[];
    const totalDays = new Date(year, month, 0).getDate();
    const presentDays = new Set(
      sessions.map((s) => new Date(s.check_in_at).toDateString())
    ).size;

    return {
      totalCheckIns: sessions.length,
      presentDays,
      totalDays,
      attendancePercent: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
      streak: this.calculateStreak(sessions),
      sessions,
    };
  },

  async generateQR(memberId: string, gymId: string, organizationId: string) {
    return qrSecurityService.generateSecureQR(memberId, gymId, organizationId);
  },

  calculateStreak(sessions: AttendanceSession[]): number {
    if (sessions.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueDays = new Set(
      sessions.map((s) => new Date(s.check_in_at).toDateString())
    );

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (uniqueDays.has(date.toDateString())) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  },
};
