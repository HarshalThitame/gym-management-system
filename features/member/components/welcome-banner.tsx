"use client";

import { motion } from "framer-motion";
import { Clock, Flame, Sparkles, Zap } from "lucide-react";
import { ProgressRing } from "@/features/member/components/progress-ring";

type WelcomeBannerProps = {
  displayName: string;
  attendanceStreak: number;
  workoutStreak: number;
  remainingDays: number;
  totalMembershipDays: number;
  membershipStatus: string;
  lastVisitAt: string | null;
};

function getGreeting(): { text: string; icon: typeof Sun; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good Morning", icon: Sun, emoji: "🌅" };
  if (hour < 17) return { text: "Good Afternoon", icon: Sun, emoji: "☀️" };
  if (hour < 21) return { text: "Good Evening", icon: Sun, emoji: "🌆" };
  return { text: "Good Night", icon: Sun, emoji: "🌙" };
}

function Sun() {
  return null;
}

export function WelcomeBanner({
  displayName,
  attendanceStreak,
  workoutStreak,
  remainingDays,
  totalMembershipDays,
  membershipStatus,
  lastVisitAt
}: WelcomeBannerProps) {
  const greeting = getGreeting();
  const isActive = membershipStatus === "active";
  const membershipPercentage = totalMembershipDays > 0 ? (remainingDays / totalMembershipDays) * 100 : 0;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-accent/5 p-6 md:p-8 shadow-premium"
      initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
    >
      <div className="absolute inset-0 bg-gradient-mesh opacity-30 pointer-events-none" />
      <div className="absolute -right-20 -top-20 size-64 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 size-48 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-bold text-accent"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Sparkles className="size-3.5" />
            {greeting.emoji} {greeting.text}
          </motion.div>
          <motion.h1
            className="text-3xl md:text-4xl font-black"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Welcome back,{" "}
            <span className="gradient-text">{displayName.split(" ")[0]}</span>
          </motion.h1>
          <motion.p
            className="text-sm leading-6 text-muted-foreground max-w-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {isActive
              ? `Your membership is active with ${remainingDays} days remaining. Keep crushing your fitness goals!`
              : "Your membership needs attention. Check your membership status to stay on track."}
          </motion.p>
        </div>

        <motion.div
          className="flex items-center gap-6 md:gap-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <ProgressRing
            value={attendanceStreak}
            max={30}
            size={90}
            strokeWidth={7}
            color="#6366f1"
            label="Attendance Streak"
            showPercentage={false}
          />
          <ProgressRing
            value={workoutStreak}
            max={30}
            size={90}
            strokeWidth={7}
            color="#06b6d4"
            label="Workout Streak"
            showPercentage={false}
          />
          <ProgressRing
            value={remainingDays}
            max={totalMembershipDays}
            size={90}
            strokeWidth={7}
            color={membershipPercentage < 20 ? "#dc2626" : membershipPercentage < 40 ? "#d97706" : "#16a34a"}
            label="Days Left"
            sublabel={membershipStatus}
          />
        </motion.div>
      </div>

      {(attendanceStreak > 0 || workoutStreak > 0) && (
        <motion.div
          className="relative z-10 mt-4 flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          {attendanceStreak >= 7 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
              <Flame className="size-4 text-amber-500" />
              {attendanceStreak} day gym streak!
            </div>
          )}
          {workoutStreak >= 7 && (
            <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800">
              <Zap className="size-4 text-cyan-500" />
              {workoutStreak} day workout streak!
            </div>
          )}
          {lastVisitAt && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Clock className="size-3.5" />
              Last visit: {new Date(lastVisitAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
