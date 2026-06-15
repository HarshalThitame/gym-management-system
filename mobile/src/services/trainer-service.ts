import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { Trainer, TrainerSession } from "@/types";

export const memberTrainerService = {
  async getAssignedTrainer(memberId: string): Promise<Trainer | null> {
    const cacheKey = offlineCache.memberKey(memberId, "trainer");

    try {
      const supabase = getSupabaseClient();
      const { data: assignment } = await supabase
        .from("trainer_assignments")
        .select("trainer_id")
        .eq("member_id", memberId)
        .eq("status", "active")
        .maybeSingle();

      if (!assignment?.trainer_id) return null;

      const { data: trainer } = await supabase
        .from("trainers")
        .select("*")
        .eq("id", assignment.trainer_id)
        .maybeSingle();

      if (trainer) {
        await offlineCache.set(cacheKey, trainer as Trainer, { ttlMs: 60 * 60 * 1000 });
      }
      return trainer as Trainer | null;
    } catch {
      const cached = await offlineCache.get<Trainer>(cacheKey);
      if (cached) return cached.data;
      return null;
    }
  },

  async getUpcomingSessions(memberId: string): Promise<TrainerSession[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("trainer_sessions")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["scheduled", "rescheduled"])
      .gte("session_date", new Date().toISOString().split("T")[0])
      .order("session_date", { ascending: true })
      .order("starts_at", { ascending: true });

    return (data ?? []) as TrainerSession[];
  },

  async getSessionHistory(memberId: string): Promise<TrainerSession[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("trainer_sessions")
      .select("*")
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(20);

    return (data ?? []) as TrainerSession[];
  },

  async getTrainerNotes(memberId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("trainer_notes")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10);

    return data ?? [];
  },
};
