import type { Metadata } from "next";
import { Activity, CalendarCheck, CalendarDays, Clock, Dumbbell, MessageSquare, Plus, Star, UsersRound, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getTrainerClassesPortal } from "@/features/classes/services/class-service";
import { getTrainerNotificationCenter } from "@/features/communications/services/communication-service";
import { getTrainerFitnessPortal } from "@/features/fitness/services/fitness-service";
import { TrainerSessionForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { getTrainerDashboard } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { DashboardClient, TodayTimeline, MemberCardGrid, FloatingQuickActions } from "./client";

export const metadata: Metadata = createMetadata({
  title: "Trainer Dashboard",
  description: "Protected trainer dashboard for assigned members and sessions.",
  path: "/trainer"
});

export default async function TrainerDashboardPage() {
  const context = await requireRole(["trainer"], "/trainer");
  const [dashboard, classPortal, fitnessPortal, communications] = await Promise.all([
    getTrainerDashboard(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerClassesPortal(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerFitnessPortal(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerNotificationCenter(context.userId ?? "", context.profile?.gym_id ?? null)
  ]);
  const trainerList = dashboard.trainer ? [dashboard.trainer] : [];
  const nutritionComplianceMembers = fitnessPortal.members.filter((member) => member.activeNutritionPlan).length;

  return (
    <DashboardClient trainerName={dashboard.trainer?.display_name ?? "Trainer"}>
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-accent/90 p-8 shadow-premium-lg md:p-12">
        <div className="absolute inset-0 bg-gradient-mesh-animated opacity-20" />
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-64 rounded-full from-purple-500/20 blur-3xl" />
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Trainer Portal</p>
          <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-amber-200 to-yellow-300 bg-clip-text text-transparent">
              {dashboard.trainer?.display_name?.split(" ")[0] ?? "Coach"}
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            Manage today&apos;s coaching work, assigned members, upcoming personal training sessions, and performance signals — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/70">
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
              <Sparkles className="size-3.5" /> {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
              <Activity className="size-3.5" /> {dashboard.metrics.todaySessions} sessions today
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard detail="Scheduled for today" icon={<CalendarDays className="size-5" />} label="Today's PT Sessions" value={String(dashboard.metrics.todaySessions)} />
        <StatCard detail="Active coaching assignments" icon={<UsersRound className="size-5" />} label="Assigned Members" value={String(dashboard.metrics.assignedMembers)} />
        <StatCard detail="Next 30 days" icon={<Dumbbell className="size-5" />} label="Upcoming Appointments" value={String(dashboard.metrics.upcomingSessions)} />
        <StatCard detail="Assigned group sessions" icon={<CalendarCheck className="size-5" />} label="Assigned Classes" value={String(classPortal.sessions.length)} />
        <StatCard detail={`${communications?.metrics.unread ?? 0} unread`} icon={<MessageSquare className="size-5" />} label="Unread Messages" value={String(communications?.metrics.unread ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Active goals to review" status={fitnessPortal.metrics.activeGoals > 0 ? "watch" : undefined} icon={<Activity className="size-5" />} label="Pending Reviews" value={String(fitnessPortal.metrics.activeGoals)} />
        <StatCard detail="Completed in 30 days" icon={<Activity className="size-5" />} label="Workout Compliance" value={String(fitnessPortal.metrics.completedWorkouts30Days)} />
        <StatCard detail="With active plans" icon={<Star className="size-5" />} label="Nutrition Compliance" value={String(nutritionComplianceMembers)} />
        <StatCard detail="Needing follow-up" status={fitnessPortal.metrics.membersMissingWorkouts > 0 ? "risk" : "good"} icon={<UsersRound className="size-5" />} label="Progress Alerts" value={String(fitnessPortal.metrics.membersMissingWorkouts)} />
      </div>

      {!dashboard.trainer ? (
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Trainer record required</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">An admin must connect this login to a trainer profile before assigned members, sessions, and workout programs can appear here.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Main Content Grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <TodayTimeline sessions={dashboard.todaysSessions} />
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Quick Actions</h3>
            <p className="text-xs font-semibold text-muted-foreground">Schedule and manage from here</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrainerSessionForm members={dashboard.assignedMembers} trainers={trainerList} />
          </CardContent>
        </Card>
      </div>

      {/* Assigned Members */}
      <MemberCardGrid members={dashboard.assignedMembers} />

      {/* Floating Quick Actions */}
      <FloatingQuickActions />
    </DashboardClient>
  );
}
