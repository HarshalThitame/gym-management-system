import { createSupabaseServerClient } from "@/lib/supabase/server";
import { billingLogger } from "@/features/billing/lib/logger";

type AchievementRecord = {
  id: string;
  title: string;
  achieved_at: string | null;
  type: string;
  member_id: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMemberAchievements(memberId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("fitness_milestones")
    .select("*")
    .eq("member_id", memberId)
    .order("achieved_at", { ascending: false });

  if (error) {
    billingLogger.error("getMemberAchievements", "Failed to fetch achievements", { memberId, error: error.message });
    return null;
  }

  const achievements = (data ?? []) as AchievementRecord[];

  return {
    all: achievements,
    count: achievements.length,
    recent: achievements.slice(0, 5),
    streakAchievements: achievements.filter((a) => a.type === "streak"),
    workoutAchievements: achievements.filter((a) => a.type === "workout")
  };
}
