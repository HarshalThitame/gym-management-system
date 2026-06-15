import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { FitnessProgress } from "@/types";

export const progressService = {
  async getLatestProgress(memberId: string): Promise<FitnessProgress | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("fitness_progress")
      .select("*")
      .eq("member_id", memberId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data as FitnessProgress | null;
  },

  async getProgressHistory(memberId: string, limit = 20): Promise<FitnessProgress[]> {
    const cacheKey = offlineCache.memberKey(memberId, `progress:${limit}`);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("fitness_progress")
        .select("*")
        .eq("member_id", memberId)
        .order("recorded_at", { ascending: false })
        .limit(limit);

      const records = (data ?? []) as FitnessProgress[];
      await offlineCache.set(cacheKey, records, { ttlMs: 15 * 60 * 1000 });
      return records;
    } catch {
      const cached = await offlineCache.get<FitnessProgress[]>(cacheKey);
      if (cached) return cached.data;
      return [];
    }
  },

  async recordProgress(memberId: string, data: {
    weight_kg?: number;
    body_fat_percentage?: number;
    chest_cm?: number;
    waist_cm?: number;
    hips_cm?: number;
    biceps_cm?: number;
    thigh_cm?: number;
    notes?: string;
  }): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("fitness_progress").insert({
        member_id: memberId,
        ...data,
        recorded_at: new Date().toISOString(),
      });

      if (error) return false;

      await offlineCache.evict(offlineCache.memberKey(memberId, "progress:20"));
      return true;
    } catch {
      return false;
    }
  },

  async getMilestones(memberId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("fitness_milestones")
      .select("*")
      .eq("member_id", memberId)
      .order("achieved_at", { ascending: false });

    return data ?? [];
  },

  async getMemberHeightCm(memberId: string): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("members")
        .select("height_cm")
        .eq("id", memberId)
        .maybeSingle();
      return (data?.height_cm as number) ?? 170;
    } catch {
      return 170;
    }
  },

  async calculateBMIForMember(memberId: string, weightKg: number): Promise<{ bmi: number; heightCm: number }> {
    const heightCm = await this.getMemberHeightCm(memberId);
    const bmi = this.calculateBMI(weightKg, heightCm);
    return { bmi, heightCm };
  },

  calculateBMI(weightKg: number, heightCm: number): number {
    if (heightCm <= 0) return 0;
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  },

  getBMIStatus(bmi: number): { label: string; color: string } {
    if (bmi < 18.5) return { label: "Underweight", color: "#f59e0b" };
    if (bmi < 25) return { label: "Normal", color: "#22c55e" };
    if (bmi < 30) return { label: "Overweight", color: "#f59e0b" };
    return { label: "Obese", color: "#ef4444" };
  },
};
