"use client";

import { motion } from "framer-motion";
import { Medal, Star, Target, Flame, Award, Dumbbell, Scale, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedContainer, AnimatedItem } from "@/components/motion";

type Achievement = {
  id: string;
  title: string;
  description: string | null;
  milestone_type: string;
  achieved_at: string;
  badge_key: string | null;
};

const MILESTONE_ICONS: Record<string, React.ElementType> = {
  first_workout: Dumbbell,
  workouts_completed: Medal,
  weight_change: Scale,
  attendance_count: Flame,
  goal_completed: Target,
  streak: Crown,
  custom: Star
};

const MILESTONE_COLORS: Record<string, string> = {
  first_workout: "from-blue-500 to-cyan-500",
  workouts_completed: "from-purple-500 to-pink-500",
  weight_change: "from-green-500 to-emerald-500",
  attendance_count: "from-amber-500 to-orange-500",
  goal_completed: "from-accent to-purple-600",
  streak: "from-red-500 to-amber-500",
  custom: "from-slate-400 to-slate-600"
};

export function AchievementWall({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Award className="size-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">No achievements yet. Keep working out to unlock badges!</p>
      </div>
    );
  }

  return (
    <AnimatedContainer>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((achievement, index) => {
          const IconComponent = MILESTONE_ICONS[achievement.milestone_type] ?? Star;
          const gradientColor = MILESTONE_COLORS[achievement.milestone_type] ?? MILESTONE_COLORS.custom;

          return (
            <AnimatedItem key={achievement.id} index={index}>
              <motion.div
                className="relative overflow-hidden rounded-xl border border-border bg-surface-muted p-4 card-hover"
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn("absolute -right-3 -top-3 size-16 rounded-full opacity-10 bg-gradient-to-br", gradientColor)} />
                <div className="flex items-start gap-3">
                  <motion.div
                    className={cn("rounded-lg bg-gradient-to-br p-2 text-white shadow-glow-sm", gradientColor)}
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <IconComponent className="size-4" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-sm truncate">{achievement.title}</h4>
                    {achievement.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{achievement.description}</p>
                    )}
                    <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {new Date(achievement.achieved_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatedItem>
          );
        })}
      </div>
    </AnimatedContainer>
  );
}

type AchievementStatsProps = {
  totalAchievements: number;
  latestAchievement: Achievement | null;
  streakCount: number;
  workoutCount: number;
};

export function AchievementStats({ totalAchievements, latestAchievement, streakCount, workoutCount }: AchievementStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <motion.div
        className="rounded-xl border border-border bg-surface p-4 card-hover"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Total</p>
        <p className="mt-2 text-2xl font-black gradient-text">{totalAchievements}</p>
        <p className="mt-1 text-xs text-muted-foreground">Achievements earned</p>
      </motion.div>
      <motion.div
        className="rounded-xl border border-border bg-surface p-4 card-hover"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Streak</p>
        <p className="mt-2 text-2xl font-black gradient-text-cool">{streakCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">Best streak days</p>
      </motion.div>
      <motion.div
        className="rounded-xl border border-border bg-surface p-4 card-hover"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Workouts</p>
        <p className="mt-2 text-2xl font-black gradient-text-warm">{workoutCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">Workouts completed</p>
      </motion.div>
      <motion.div
        className="rounded-xl border border-border bg-surface p-4 card-hover"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Latest</p>
        <p className="mt-2 text-sm font-black line-clamp-1">{latestAchievement?.title ?? "None yet"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {latestAchievement ? new Date(latestAchievement.achieved_at).toLocaleDateString("en-IN") : "Start earning"}
        </p>
      </motion.div>
    </div>
  );
}
