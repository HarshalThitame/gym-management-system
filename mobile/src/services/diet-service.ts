import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { NutritionPlan } from "@/types";
import { syncEngine } from "@/offline/sync-engine";

export const dietService = {
  async getActivePlan(memberId: string): Promise<NutritionPlan | null> {
    const cacheKey = offlineCache.memberKey(memberId, "diet:active");
    const cached = await offlineCache.get<NutritionPlan>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("nutrition_plans")
        .select("*")
        .eq("member_id", memberId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        await offlineCache.set(cacheKey, data as NutritionPlan, {
          ttlMs: 30 * 60 * 1000,
          staleWhileRevalidate: true,
        });
      }
      return data as NutritionPlan | null;
    } catch {
      if (cached) return cached.data;
      return null;
    }
  },

  async getMeals(planId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("plan_meals")
      .select("*")
      .eq("plan_id", planId)
      .order("meal_time", { ascending: true });

    return data ?? [];
  },

  async logWaterIntake(memberId: string, amountMl: number): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("nutrition_logs")
        .select("id, water_ml")
        .eq("member_id", memberId)
        .eq("log_date", today)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("nutrition_logs")
          .update({ water_ml: (existing.water_ml ?? 0) + amountMl })
          .eq("id", existing.id);
        return !error;
      } else {
        const { error } = await supabase.from("nutrition_logs").insert({
          member_id: memberId,
          log_date: today,
          water_ml: amountMl,
        });
        return !error;
      }
    } catch {
      return false;
    }
  },

  async getTodayNutrition(memberId: string) {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("nutrition_logs")
      .select("*")
      .eq("member_id", memberId)
      .eq("log_date", today)
      .maybeSingle();

    return data ?? { water_ml: 0, calories: 0, protein: 0, carbs: 0, fat: 0 };
  },

  async logMeal(memberId: string, meal: {
    meal_type: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    notes?: string;
  }): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("meal_logs").insert({
        member_id: memberId,
        log_date: today,
        meal_type: meal.meal_type,
        calories: meal.calories ?? null,
        protein: meal.protein ?? null,
        carbs: meal.carbs ?? null,
        fat: meal.fat ?? null,
        notes: meal.notes ?? null,
      });
      return !error;
    } catch {
      return false;
    }
  },

  async logWaterOffline(memberId: string, amountMl: number): Promise<void> {
    await syncEngine.enqueue({
      type: "nutrition_log",
      endpoint: `/members/${memberId}/nutrition/water`,
      method: "POST",
      payload: { member_id: memberId, water_ml: amountMl },
    });
  },
};
