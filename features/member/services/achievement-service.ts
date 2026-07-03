import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AchievementRecord = {
  id: string;
  title: string;
  description: string | null;
  milestone_type: string;
  achieved_at: string;
  badge_key: string | null;
};

export async function getMemberAchievements(memberId: string): Promise<{
  achievements: AchievementRecord[];
  totalAchievements: number;
  latestAchievement: AchievementRecord | null;
  streakMilestoneCount: number;
  workoutMilestoneCount: number;
}> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("fitness_milestones")
    .select("id, title, description, milestone_type, achieved_at, badge_key")
    .eq("member_id", memberId)
    .order("achieved_at", { ascending: false })
    .limit(30);

  const achievements = (data ?? []) as AchievementRecord[];

  return {
    achievements,
    totalAchievements: achievements.length,
    latestAchievement: achievements[0] ?? null,
    streakMilestoneCount: achievements.filter((a) => a.milestone_type === "streak").length,
    workoutMilestoneCount: achievements.filter((a) => a.milestone_type === "workouts_completed").length
  };
}
