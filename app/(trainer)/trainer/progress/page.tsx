import type { Metadata } from "next";
import { Apple, Dumbbell, Scale, Target, Trophy, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { FitnessStatusBadge } from "@/features/fitness/components/fitness-status-badge";
import { BodyMeasurementForm, FitnessGoalForm, FitnessMilestoneForm, MealPlanForm, NutritionPlanForm, WorkoutSessionForm } from "@/features/fitness/components/fitness-forms";
import { calculateGoalProgress, formatFitnessLabel } from "@/features/fitness/lib/business-rules";
import { getTrainerFitnessPortal } from "@/features/fitness/services/fitness-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

type TrainerProgressPageProps = {
  searchParams: Promise<{ memberId?: string }>;
};

export const metadata: Metadata = createMetadata({
  title: "Trainer Progress",
  description: "Trainer view for member goals, workout completion, body measurements, nutrition plans, and milestones.",
  path: "/trainer/progress"
});

export default async function TrainerProgressPage({ searchParams }: TrainerProgressPageProps) {
  const context = await requireRole(["trainer"], "/trainer/progress");
  const params = await searchParams;
  const portal = context.userId ? await getTrainerFitnessPortal(context.userId, context.profile?.gym_id ?? null) : { trainer: null, members: [], metrics: { assignedMembers: 0, activeGoals: 0, completedWorkouts30Days: 0, membersMissingWorkouts: 0 } };
  const selected = portal.members.find((item) => item.member.id === params.memberId) ?? portal.members[0] ?? null;
  const activeNutritionPlan = selected?.activeNutritionPlan
    ? { ...selected.activeNutritionPlan, meals: [], trainer: portal.trainer ? { id: portal.trainer.id, display_name: portal.trainer.display_name } : null }
    : null;

  if (!portal.trainer && context.roles.includes("trainer")) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Trainer profile required</h2></CardHeader>
        <CardContent><div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">An admin must connect this login to a trainer profile before progress coaching data can appear.</div></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Progress Coaching</p>
        <h2 className="mt-2 text-3xl font-black">Member fitness progress</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Review goals, measurement trends, missed workouts, nutrition plans, and milestones for assigned members.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Active coaching assignments" icon={<UsersRound className="size-5" />} label="Members" value={String(portal.metrics.assignedMembers)} />
        <StatCard detail="Open member outcomes" icon={<Target className="size-5" />} label="Active Goals" value={String(portal.metrics.activeGoals)} />
        <StatCard detail="Across assigned members" icon={<Dumbbell className="size-5" />} label="30 Day Workouts" value={String(portal.metrics.completedWorkouts30Days)} />
        <StatCard detail="No workout in 7 days" icon={<Scale className="size-5" />} label="Needs Follow-up" value={String(portal.metrics.membersMissingWorkouts)} />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Assigned Members</h3>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {portal.members.map((item) => (
            <ButtonLink className="justify-start" href={`/trainer/progress?memberId=${item.member.id}`} key={item.member.id} variant={selected?.member.id === item.member.id ? "accent" : "secondary"}>
              {item.member.full_name}
            </ButtonLink>
          ))}
          {portal.members.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No assigned members available.</p> : null}
        </CardContent>
      </Card>

      {selected ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <Card>
              <CardHeader>
                <h3 className="text-2xl font-black">{selected.member.full_name}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{selected.member.member_code} · Last workout {selected.lastWorkout?.session_date ?? "not logged"} · Latest measurement {selected.latestMeasurement?.recorded_on ?? "not logged"}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.goals.map((goal) => (
                  <div className="rounded-lg border border-border bg-surface-muted p-4" key={goal.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-black">{goal.title}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatFitnessLabel(goal.goal_type)} · {calculateGoalProgress(goal)}%</p>
                      </div>
                      <FitnessStatusBadge status={goal.status} />
                    </div>
                  </div>
                ))}
                {selected.goals.length === 0 ? <p className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No goals created for this member yet.</p> : null}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader><h3 className="text-2xl font-black">Create Goal</h3></CardHeader>
                <CardContent><FitnessGoalForm goals={selected.goals} memberId={selected.member.id} trainerId={portal.trainer?.id ?? ""} /></CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="text-2xl font-black">Log Workout</h3></CardHeader>
                <CardContent><WorkoutSessionForm goals={selected.goals} memberId={selected.member.id} trainerId={portal.trainer?.id ?? ""} /></CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card>
              <CardHeader><div className="flex items-center gap-2"><Scale className="size-5" /><h3 className="text-2xl font-black">Measurements</h3></div></CardHeader>
              <CardContent className="space-y-4">
                {selected.latestMeasurement ? (
                  <div className="rounded-md border border-border bg-surface-muted p-3">
                    <p className="font-bold">{selected.latestMeasurement.recorded_on}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{selected.latestMeasurement.weight_kg ?? "-"} kg · BMI {selected.latestMeasurement.bmi ?? "-"}</p>
                  </div>
                ) : null}
                <BodyMeasurementForm memberId={selected.member.id} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><div className="flex items-center gap-2"><Apple className="size-5" /><h3 className="text-2xl font-black">Nutrition Plan</h3></div></CardHeader>
              <CardContent className="space-y-4">
                {selected.activeNutritionPlan ? (
                  <div className="rounded-md border border-border bg-surface-muted p-3">
                    <p className="font-bold">{selected.activeNutritionPlan.name}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{selected.activeNutritionPlan.target_calories} kcal · {selected.activeNutritionPlan.target_protein_g}g protein</p>
                  </div>
                ) : null}
                <NutritionPlanForm memberId={selected.member.id} trainerId={portal.trainer?.id ?? ""} />
                {activeNutritionPlan ? <MealPlanForm memberId={selected.member.id} nutritionPlan={activeNutritionPlan} /> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><div className="flex items-center gap-2"><Trophy className="size-5" /><h3 className="text-2xl font-black">Milestone</h3></div></CardHeader>
              <CardContent><FitnessMilestoneForm goals={selected.goals} memberId={selected.member.id} /></CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
