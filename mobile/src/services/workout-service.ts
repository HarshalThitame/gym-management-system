import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { WorkoutProgram, WorkoutLog } from "@/types";
import { syncEngine } from "@/offline/sync-engine";

export const workoutService = {
  async getActivePrograms(memberId: string): Promise<WorkoutProgram[]> {
    const cacheKey = offlineCache.memberKey(memberId, "workouts:active");
    const cached = await offlineCache.get<WorkoutProgram[]>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("workout_programs")
        .select("*")
        .eq("member_id", memberId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      const programs = (data ?? []) as WorkoutProgram[];
      await offlineCache.set(cacheKey, programs, { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true });
      return programs;
    } catch {
      if (cached) return cached.data;
      return [];
    }
  },

  async getProgramExercises(programId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("program_exercises")
      .select("*")
      .eq("program_id", programId)
      .order("day_of_week", { ascending: true })
      .order("sort_order", { ascending: true });

    return data ?? [];
  },

  async getExerciseDetails(exerciseId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .maybeSingle();

    return data;
  },

  async logWorkout(
    memberId: string,
    programId: string,
    exerciseName: string,
    log: { sets: number; reps: number; weight?: number; notes?: string }
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("workout_logs").insert({
        member_id: memberId,
        program_id: programId,
        exercise_name: exerciseName,
        sets: log.sets,
        reps: log.reps,
        weight: log.weight ?? null,
        notes: log.notes ?? null,
        logged_at: new Date().toISOString(),
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch {
      return { ok: false, error: "Failed to log workout." };
    }
  },

  async logWorkoutOffline(
    memberId: string,
    programId: string,
    exerciseName: string,
    log: { sets: number; reps: number; weight?: number; notes?: string }
  ): Promise<void> {
    await syncEngine.enqueue({
      type: "workout_log",
      endpoint: `/members/${memberId}/workouts/log`,
      method: "POST",
      payload: { member_id: memberId, program_id: programId, exercise_name: exerciseName, ...log },
    });
  },

  async getWorkoutHistory(memberId: string, days = 30): Promise<WorkoutLog[]> {
    const supabase = getSupabaseClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("member_id", memberId)
      .gte("logged_at", since.toISOString())
      .order("logged_at", { ascending: false });

    return (data ?? []) as WorkoutLog[];
  },

  async getWorkoutStreak(memberId: string): Promise<number> {
    const logs = await this.getWorkoutHistory(memberId, 365);
    const uniqueDays = new Set(logs.map((l) => new Date(l.logged_at).toDateString()));
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
