import type { Metadata } from "next";
import { Activity, Apple, Camera, Dumbbell, Flame, Scale, Target, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { FitnessStatusBadge } from "@/features/fitness/components/fitness-status-badge";
import { NutritionMacroChart, WeightTrendChart, WorkoutAdherenceChart } from "@/features/fitness/components/lazy-fitness-charts";
import { BodyMeasurementForm, FitnessGoalForm, GoalStatusForm, MealEntryForm, ProgressPhotoForm, WorkoutSessionExerciseLogPanel, WorkoutSessionForm } from "@/features/fitness/components/fitness-forms";
import { calculateGoalProgress, formatFitnessLabel } from "@/features/fitness/lib/business-rules";
import { getMemberFitnessPortal, listExercises } from "@/features/fitness/services/fitness-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Fitness Progress",
  description: "Track fitness goals, workout logs, body measurements, progress photos, nutrition plans, and milestones.",
  path: "/member/fitness"
});

export default async function MemberFitnessPage() {
  const context = await requireMemberPortalAccess("/member/fitness");
  const portal = context.userId ? await getMemberFitnessPortal(context.userId) : null;
  const exerciseResult = await listExercises({ gymId: context.profile?.gym_id ?? portal?.member.gym_id ?? null, pageSize: 80 });

  if (!portal) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Fitness tracking access</h2></CardHeader>
        <CardContent><div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member fitness profile is connected to this login yet.</div></CardContent>
      </Card>
    );
  }

  const activeNutritionPlan = portal.nutritionPlans.find((plan) => plan.status === "active") ?? null;
  const latestWorkout = portal.workoutSessions[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Fitness Progress" title="Training, nutrition, and body progress" description="Log workouts, track body measurements, compare progress photos, follow nutrition plans, and keep goals visible." />

      <AnimatedCardSection>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail={portal.activeGoal?.title ?? "No active goal"} icon={<Target className="size-5" />} label="Current Goal" value={portal.activeGoal ? `${calculateGoalProgress(portal.activeGoal)}%` : "None"} />
          <StatCard detail={`${portal.metrics.completedWorkouts} completed workouts`} icon={<Dumbbell className="size-5" />} label="Workout Streak" value={`${portal.metrics.workoutStreak} days`} />
          <StatCard detail={activeNutritionPlan ? activeNutritionPlan.name : "No active plan"} icon={<Flame className="size-5" />} label="Calories Today" value={String(portal.metrics.caloriesToday)} />
          <StatCard detail={portal.metrics.weightChangeKg === null ? "Add two measurements" : `${portal.metrics.weightChangeKg} kg since baseline`} icon={<Scale className="size-5" />} label="Latest Weight" value={portal.metrics.latestWeightKg ? `${portal.metrics.latestWeightKg} kg` : "Not logged"} />
        </div>
      </AnimatedCardSection>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <AnimatedCardSection delay={0.1}>
          <Card variant="glass">
            <CardHeader>
              <h3 className="text-2xl font-black">Goals</h3>
              <p className="text-sm leading-6 text-muted-foreground">Active, paused, and completed fitness goals with measurable progress.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {portal.goals.map((goal) => (
                <div className="rounded-xl border border-border bg-surface-muted p-4 card-hover" key={goal.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black">{goal.title}</h4>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatFitnessLabel(goal.goal_type)} · {goal.starts_on}{goal.target_date ? ` to ${goal.target_date}` : ""}</p>
                    </div>
                    <FitnessStatusBadge status={goal.status} />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" style={{ width: `${calculateGoalProgress(goal)}%` }} />
                  </div>
                  <div className="mt-4"><GoalStatusForm goal={goal} /></div>
                </div>
              ))}
              {portal.goals.length === 0 ? <p className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">Create your first fitness goal to start tracking progress.</p> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <div className="space-y-5">
          <AnimatedCardSection delay={0.15}>
            <Card variant="glow">
              <CardHeader><h3 className="text-2xl font-black">Create Goal</h3></CardHeader>
              <CardContent><FitnessGoalForm goals={portal.goals} memberId={portal.member.id} trainerId={portal.trainer?.id ?? ""} /></CardContent>
            </Card>
          </AnimatedCardSection>
          <AnimatedCardSection delay={0.2}>
            <Card variant="glass">
              <CardHeader><h3 className="text-2xl font-black">Body Measurements</h3></CardHeader>
              <CardContent><BodyMeasurementForm memberId={portal.member.id} /></CardContent>
            </Card>
          </AnimatedCardSection>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AnimatedCardSection delay={0.15}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Weight and Composition</h3></CardHeader>
            <CardContent><WeightTrendChart data={portal.weightTrend} /></CardContent>
          </Card>
        </AnimatedCardSection>
        <AnimatedCardSection delay={0.2}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Nutrition Macros</h3></CardHeader>
            <CardContent><NutritionMacroChart data={portal.nutritionTrend} /></CardContent>
          </Card>
        </AnimatedCardSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1fr]">
        <AnimatedCardSection delay={0.15}>
          <Card variant="glass">
            <CardHeader>
              <h3 className="text-2xl font-black">Log Workout</h3>
              <p className="text-sm leading-6 text-muted-foreground">Track daily workouts and add set-level exercise logs after saving the session.</p>
            </CardHeader>
            <CardContent><WorkoutSessionForm assignments={portal.programs} goals={portal.goals} memberId={portal.member.id} trainerId={portal.trainer?.id ?? ""} /></CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.2}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Workout History</h3></CardHeader>
            <CardContent className="space-y-4">
              {portal.workoutSessions.slice(0, 6).map((session) => (
                <div className="rounded-xl border border-border bg-surface-muted p-4 card-hover" key={session.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black">{session.workout_title}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.session_date} · {session.duration_minutes ?? "-"} min · {session.program?.name ?? "Manual"}</p>
                    </div>
                    <FitnessStatusBadge status={session.status} />
                  </div>
                  {session === latestWorkout ? <div className="mt-4"><WorkoutSessionExerciseLogPanel exercises={exerciseResult.exercises} memberId={portal.member.id} session={session} /></div> : null}
                </div>
              ))}
              {portal.workoutSessions.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No workouts logged yet.</p> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AnimatedCardSection delay={0.15}>
          <Card variant="glass">
            <CardHeader><div className="flex items-center gap-2"><Apple className="size-5" /><h3 className="text-2xl font-black">Nutrition</h3></div></CardHeader>
            <CardContent className="space-y-4">
              <MealEntryForm memberId={portal.member.id} nutritionPlans={portal.nutritionPlans} />
              <div className="space-y-3">
                {portal.mealEntries.slice(0, 8).map((entry) => (
                  <div className="rounded-lg border border-border bg-surface-muted p-3 card-hover" key={entry.id}>
                    <p className="font-bold">{entry.food_name}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{entry.entry_date} · {formatFitnessLabel(entry.meal_type)} · {entry.calories} kcal · {entry.protein_g}g protein</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.2}>
          <Card variant="glass">
            <CardHeader><div className="flex items-center gap-2"><Camera className="size-5" /><h3 className="text-2xl font-black">Progress Photos</h3></div></CardHeader>
            <CardContent className="space-y-4">
              <ProgressPhotoForm memberId={portal.member.id} />
              <div className="grid gap-3 md:grid-cols-3">
                {portal.progressPhotos.slice(0, 6).map((photo) => (
                  <div className="rounded-lg border border-border bg-surface-muted p-3 card-hover" key={photo.id}>
                    <p className="font-bold">{formatFitnessLabel(photo.view_type)}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{photo.photo_date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedCardSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AnimatedCardSection delay={0.15}>
          <Card variant="glass">
            <CardHeader><div className="flex items-center gap-2"><Activity className="size-5" /><h3 className="text-2xl font-black">Workout Adherence</h3></div></CardHeader>
            <CardContent><WorkoutAdherenceChart data={portal.adherenceTrend} /></CardContent>
          </Card>
        </AnimatedCardSection>
        <AnimatedCardSection delay={0.2}>
          <Card variant="glass">
            <CardHeader><div className="flex items-center gap-2"><Trophy className="size-5" /><h3 className="text-2xl font-black">Milestones</h3></div></CardHeader>
            <CardContent className="space-y-3">
              {portal.milestones.map((milestone) => (
                <div className="rounded-lg border border-border bg-surface-muted p-3 card-hover" key={milestone.id}>
                  <p className="font-bold">{milestone.title}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatFitnessLabel(milestone.milestone_type)} · {milestone.achieved_at.slice(0, 10)}</p>
                </div>
              ))}
              {portal.milestones.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">Milestones appear as workouts, goals, and measurements progress.</p> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>
      </div>
    </div>
  );
}
