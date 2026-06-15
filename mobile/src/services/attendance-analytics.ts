import { getSupabaseClient } from "@/api/supabase";

export interface AttendanceAnalytics {
  daily: { date: string; count: number }[];
  weekly: { week: string; count: number }[];
  monthly: { month: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  memberRetention: number;
  averageDaily: number;
  busiestDay: string;
  slowestDay: string;
  totalSessions: number;
}

export interface MemberAttendanceProfile {
  totalVisits: number;
  currentStreak: number;
  longestStreak: number;
  monthlyAverage: number;
  attendancePercent: number;
  preferredTime: string;
  lastVisit: string | null;
  daysSinceLastVisit: number;
  rank: number;
}

export const attendanceAnalytics = {
  async getGymAnalytics(gymId: string, days = 30): Promise<AttendanceAnalytics> {
    const supabase = getSupabaseClient();
    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("check_in_at, check_out_at")
      .eq("gym_id", gymId)
      .gte("check_in_at", startDate);

    const records = sessions ?? [];
    const daily: Record<string, number> = {};
    const weekly: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const hourly: Record<number, number> = {};

    for (const s of records) {
      const date = new Date(s.check_in_at);
      const dayKey = date.toISOString().split("T")[0];
      const weekKey = getWeekKey(date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const hour = date.getHours();

      daily[dayKey] = (daily[dayKey] ?? 0) + 1;
      weekly[weekKey] = (weekly[weekKey] ?? 0) + 1;
      monthly[monthKey] = (monthly[monthKey] ?? 0) + 1;
      hourly[hour] = (hourly[hour] ?? 0) + 1;
    }

    const peakHours = Object.entries(hourly)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    const dailyEntries = Object.entries(daily).map(([date, count]) => ({ date, count }));
    const busiestDay = dailyEntries.sort((a, b) => b.count - a.count)[0]?.date ?? "N/A";
    const slowestDay = dailyEntries.sort((a, b) => a.count - b.count)[0]?.date ?? "N/A";

    const uniqueMembers = new Set(records.map((s) => s.check_in_at)).size;
    const totalDays = Math.min(days, Object.keys(daily).length);
    const averageDaily = totalDays > 0 ? Math.round(records.length / totalDays) : 0;

    const returningMembers = records.length > 0
      ? Math.round((records.filter((s) => s.check_out_at).length / records.length) * 100)
      : 0;

    return {
      daily: dailyEntries.sort((a, b) => a.date.localeCompare(b.date)),
      weekly: Object.entries(weekly).map(([week, count]) => ({ week, count })),
      monthly: Object.entries(monthly).map(([month, count]) => ({ month, count })),
      peakHours: peakHours.slice(0, 6),
      memberRetention: returningMembers,
      averageDaily,
      busiestDay,
      slowestDay,
      totalSessions: records.length,
    };
  },

  async getMemberAnalytics(memberId: string): Promise<MemberAttendanceProfile> {
    const supabase = getSupabaseClient();

    const { data: allSessions } = await supabase
      .from("attendance_sessions")
      .select("check_in_at, check_out_at")
      .eq("member_id", memberId)
      .order("check_in_at", { ascending: false });

    const sessions = allSessions ?? [];
    const totalVisits = sessions.length;

    const uniqueDays = new Set(sessions.map((s) => new Date(s.check_in_at).toDateString()));
    const firstVisit = sessions[sessions.length - 1]?.check_in_at;
    const lastVisit = sessions[0]?.check_in_at ?? null;

    const daysSinceMembership = firstVisit
      ? Math.round((Date.now() - new Date(firstVisit).getTime()) / 86400000)
      : 1;
    const monthlyAverage = daysSinceMembership > 0
      ? Math.round((totalVisits / daysSinceMembership) * 30)
      : 0;

    const daysSinceLastVisit = lastVisit
      ? Math.round((Date.now() - new Date(lastVisit).getTime()) / 86400000)
      : 0;

    const { data: members } = await supabase
      .from("members")
      .select("id")
      .eq("status", "active");

    const totalMembers = members?.length ?? 1;
    const membersWithMoreVisits = members
      ? members.length - 1
      : 0;
    const rank = Math.max(1, Math.round((membersWithMoreVisits / totalMembers) * 100));

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (uniqueDays.has(date.toDateString())) {
        currentStreak++;
      } else if (i > 0) break;
    }

    let longestStreak = 0;
    let tempStreak = 0;
    const sortedDays = Array.from(uniqueDays).sort();
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) { tempStreak = 1; continue; }
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) { tempStreak++; } else { longestStreak = Math.max(longestStreak, tempStreak); tempStreak = 1; }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    const hours = sessions.map((s) => new Date(s.check_in_at).getHours());
    const preferredHour = hours.length > 0
      ? hours.sort((a, b) => hours.filter((h) => h === a).length - hours.filter((h) => h === b).length).pop() ?? 12
      : 12;
    const period = preferredHour < 12 ? "Morning" : preferredHour < 17 ? "Afternoon" : "Evening";

    return {
      totalVisits,
      currentStreak,
      longestStreak,
      monthlyAverage,
      attendancePercent: 0,
      preferredTime: period,
      lastVisit,
      daysSinceLastVisit,
      rank,
    };
  },
};

function getWeekKey(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const week = Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
