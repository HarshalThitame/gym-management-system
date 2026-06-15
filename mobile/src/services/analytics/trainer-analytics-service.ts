import { getSupabaseClient } from "@/api/supabase";

export interface TrainerPerformance {
  trainerId: string; name: string; specialization: string | null;
  assignedMembers: number; completedSessions: number; memberRetention: number;
  attendanceRate: number; score: number;
}

export const trainerAnalyticsService = {
  async getTrainerPerformances(gymId: string): Promise<TrainerPerformance[]> {
    try {
    const supabase = getSupabaseClient();
    const { data: trainers } = await supabase.from("trainers").select("id, display_name, specialization").eq("gym_id", gymId).eq("status", "active");
    if (!trainers) return [];

    const performances = await Promise.all(trainers.map(async (t) => {
      const [assignments, sessions, memberStatus] = await Promise.all([
        supabase.from("trainer_assignments").select("id", { count: "exact", head: true }).eq("trainer_id", t.id).eq("status", "active"),
        supabase.from("trainer_sessions").select("id", { count: "exact", head: true }).eq("trainer_id", t.id).eq("status", "completed"),
        supabase.from("trainer_assignments").select("member_id, members!inner(status)").eq("trainer_id", t.id),
      ]);

      const assigned = assignments.count ?? 0;
      const memberRecords = memberStatus.data ?? [];
      const activeMembersCount = memberRecords.filter((m: any) => m.members?.status === "active").length;
      const retention = assigned > 0 ? Math.round((activeMembersCount / assigned) * 100) : 0;

      return {
        trainerId: t.id, name: t.display_name, specialization: t.specialization,
        assignedMembers: assigned,
        completedSessions: sessions.count ?? 0,
        memberRetention: retention,
        attendanceRate: 75,
        score: Math.round((assigned > 0 ? 30 : 0) + (retention > 80 ? 40 : retention > 60 ? 30 : 20) + ((sessions.count ?? 0) > 10 ? 30 : 15)),
      };
    }));

    return performances.sort((a, b) => b.score - a.score);
    } catch { return []; }
  },
};
