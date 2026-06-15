import { getSupabaseClient } from "@/api/supabase";

export interface AttendanceBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  type: "streak" | "total" | "monthly" | "special";
  earned: boolean;
  earnedAt?: string;
}

export interface LeaderboardEntry {
  memberId: string;
  fullName: string;
  memberCode: string;
  currentStreak: number;
  totalVisits: number;
  attendancePercent: number;
  rank: number;
}

const BADGE_DEFINITIONS: Omit<AttendanceBadge, "earned" | "earnedAt" | "id">[] = [
  { name: "First Visit", description: "Checked in for the first time", icon: "star", requirement: 1, type: "total" },
  { name: "Dedicated", description: "10 total visits", icon: "flame", requirement: 10, type: "total" },
  { name: "Regular", description: "25 total visits", icon: "flame", requirement: 25, type: "total" },
  { name: "Committed", description: "50 total visits", icon: "trophy", requirement: 50, type: "total" },
  { name: "Champion", description: "100 total visits", icon: "crown", requirement: 100, type: "total" },
  { name: "Elite", description: "200 total visits", icon: "diamond", requirement: 200, type: "total" },
  { name: "3-Day Streak", description: "Visited 3 days in a row", icon: "flame", requirement: 3, type: "streak" },
  { name: "7-Day Streak", description: "Visited 7 days in a row", icon: "flame", requirement: 7, type: "streak" },
  { name: "14-Day Streak", description: "Visited 14 days in a row", icon: "fire", requirement: 14, type: "streak" },
  { name: "30-Day Streak", description: "Visited 30 days in a row", icon: "inferno", requirement: 30, type: "streak" },
  { name: "Perfect Month", description: "Visited every day in a month", icon: "calendar-check", requirement: 1, type: "monthly" },
  { name: "Consistent", description: "15+ visits in a month", icon: "chart", requirement: 15, type: "monthly" },
];

export const attendanceGamification = {
  getBadgeDefinitions(): Omit<AttendanceBadge, "earned" | "earnedAt" | "id">[] {
    return BADGE_DEFINITIONS;
  },

  async checkAndAwardBadges(memberId: string, currentStreak: number, totalVisits: number): Promise<AttendanceBadge[]> {
    const supabase = getSupabaseClient();

    const { data: existingBadges } = await supabase
      .from("member_badges")
      .select("badge_name")
      .eq("member_id", memberId);

    const earnedNames = new Set((existingBadges ?? []).map((b) => b.badge_name));
    const newlyEarned: AttendanceBadge[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      if (earnedNames.has(badge.name)) continue;

      let earned = false;
      if (badge.type === "total" && totalVisits >= badge.requirement) earned = true;
      if (badge.type === "streak" && currentStreak >= badge.requirement) earned = true;

      if (earned) {
        const { data } = await supabase.from("member_badges").insert({
          member_id: memberId,
          badge_name: badge.name,
          badge_type: badge.type,
          earned_at: new Date().toISOString(),
        }).select().maybeSingle();

        newlyEarned.push({
          ...badge,
          id: data?.id ?? crypto.randomUUID(),
          earned: true,
          earnedAt: new Date().toISOString(),
        });
      }
    }

    return newlyEarned;
  },

  async getMemberBadges(memberId: string): Promise<AttendanceBadge[]> {
    const supabase = getSupabaseClient();

    const { data: earned } = await supabase
      .from("member_badges")
      .select("*")
      .eq("member_id", memberId);

    const earnedMap = new Map((earned ?? []).map((b: any) => [b.badge_name, b.earned_at]));

    return BADGE_DEFINITIONS.map((def) => ({
      ...def,
      id: `badge-${def.name.toLowerCase().replace(/\s+/g, "-")}`,
      earned: earnedMap.has(def.name),
      earnedAt: earnedMap.get(def.name) ?? undefined,
    }));
  },

  async getLeaderboard(gymId: string, limit = 20): Promise<LeaderboardEntry[]> {
    const supabase = getSupabaseClient();

    const { data: members } = await supabase
      .from("members")
      .select("id, full_name, member_code")
      .eq("gym_id", gymId)
      .eq("status", "active");

    if (!members) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const entries: LeaderboardEntry[] = await Promise.all(
      members.map(async (m) => {
        const { data: sessions } = await supabase
          .from("attendance_sessions")
          .select("check_in_at")
          .eq("member_id", m.id)
          .order("check_in_at", { ascending: false });

        const uniqueDays = new Set((sessions ?? []).map((s) => new Date(s.check_in_at).toDateString()));
        const monthDays = new Set(
          (sessions ?? [])
            .filter((s) => s.check_in_at >= monthStart && s.check_in_at <= monthEnd)
            .map((s) => new Date(s.check_in_at).toDateString())
        );

        let currentStreak = 0;
        for (let i = 0; i < 365; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          if (uniqueDays.has(date.toDateString())) { currentStreak++; }
          else if (i > 0) break;
        }

        return {
          memberId: m.id,
          fullName: m.full_name,
          memberCode: m.member_code,
          currentStreak,
          totalVisits: uniqueDays.size,
          attendancePercent: daysInMonth > 0 ? Math.round((monthDays.size / daysInMonth) * 100) : 0,
          rank: 0,
        };
      })
    );

    entries.sort((a, b) => b.totalVisits - a.totalVisits || b.currentStreak - a.currentStreak);
    return entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
  },
};
