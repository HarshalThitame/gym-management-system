import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { MemberDashboard, AttendanceSession, WorkoutProgram, NutritionPlan, Trainer, TrainerSession } from "@/types";

interface DashboardData {
  membership: { membership: any | null; plan: any | null };
  attendance: { checkedIn: boolean; checkedOut: boolean; streak: number; monthlyPercent: number; presentDays: number };
  workouts: { activePrograms: number; streak: number };
  nutrition: { hasPlan: boolean; waterMl: number; calories: number };
  trainer: Trainer | null;
  upcomingSessions: TrainerSession[];
  unreadCount: number;
}

export const memberDashboardService = {
  async getFullDashboard(userId: string, memberId: string): Promise<DashboardData> {
    const cacheKey = `member:${memberId}:fulldashboard`;
    const cached = await offlineCache.get<DashboardData>(cacheKey);
    if (cached && !cached.stale) return cached.data;

    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const [
      membershipResult,
      planResult,
      attendanceToday,
      attendanceMonth,
      workoutPrograms,
      nutritionPlan,
      nutritionToday,
      trainerAssignment,
      upcomingSessions,
      unread,
    ] = await Promise.all([
      supabase.from("memberships").select("*").eq("member_id", memberId).in("status", ["active", "pending", "frozen"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("membership_plans").select("*").eq("member_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("attendance_sessions").select("*").eq("member_id", memberId).gte("check_in_at", today).order("check_in_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("attendance_sessions").select("check_in_at").eq("member_id", memberId).gte("check_in_at", monthStart).lte("check_in_at", monthEnd),
      supabase.from("workout_programs").select("id").eq("member_id", memberId).eq("status", "active"),
      supabase.from("nutrition_plans").select("*").eq("member_id", memberId).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("nutrition_logs").select("water_ml, calories").eq("member_id", memberId).eq("log_date", today).maybeSingle(),
      supabase.from("trainer_assignments").select("trainer_id").eq("member_id", memberId).eq("status", "active").maybeSingle(),
      supabase.from("trainer_sessions").select("*").eq("member_id", memberId).in("status", ["scheduled", "rescheduled"]).gte("session_date", today).order("session_date").limit(5),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("read", false),
    ]);

    let trainerData: Trainer | null = null;
    if (trainerAssignment.data?.trainer_id) {
      const { data: t } = await supabase.from("trainers").select("*").eq("id", trainerAssignment.data.trainer_id).maybeSingle();
      trainerData = t as Trainer | null;
    }

    const attendanceSessions = (attendanceMonth.data ?? []) as AttendanceSession[];
    const uniqueDays = new Set(attendanceSessions.map((s: any) => new Date(s.check_in_at).toDateString()));
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let attendanceStreak = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (uniqueDays.has(date.toDateString())) {
        attendanceStreak++;
      } else if (i > 0) break;
    }

    let workoutStreak = 0;
    const { data: workoutLogs } = await supabase
      .from("workout_logs")
      .select("logged_at")
      .eq("member_id", memberId)
      .order("logged_at", { ascending: false })
      .limit(365);

    if (workoutLogs) {
      const workoutDays = new Set(workoutLogs.map((l: any) => new Date(l.logged_at).toDateString()));
      for (let i = 0; i < 365; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        if (workoutDays.has(date.toDateString())) {
          workoutStreak++;
        } else if (i > 0) break;
      }
    }

    const data: DashboardData = {
      membership: {
        membership: membershipResult.data,
        plan: planResult.data,
      },
      attendance: {
        checkedIn: !!attendanceToday.data && (attendanceToday.data as any)?.status === "active",
        checkedOut: !!attendanceToday.data && (attendanceToday.data as any)?.status === "completed",
        streak: attendanceStreak,
        monthlyPercent: totalDays > 0 ? Math.round((uniqueDays.size / totalDays) * 100) : 0,
        presentDays: uniqueDays.size,
      },
      workouts: {
        activePrograms: workoutPrograms.count ?? 0,
        streak: workoutStreak,
      },
      nutrition: {
        hasPlan: !!nutritionPlan.data,
        waterMl: (nutritionToday.data as any)?.water_ml ?? 0,
        calories: (nutritionToday.data as any)?.calories ?? 0,
      },
      trainer: trainerData,
      upcomingSessions: (upcomingSessions.data ?? []) as TrainerSession[],
      unreadCount: unread.count ?? 0,
    };

    await offlineCache.set(cacheKey, data, { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true });
    return data;
  },
};
