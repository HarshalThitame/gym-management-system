import type { Metadata } from "next";
import { Activity, Apple, Dumbbell, Library, Target, Trophy, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric-tile";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { ExerciseDeleteForm, ExerciseForm } from "@/features/fitness/components/fitness-forms";
import { formatFitnessLabel } from "@/features/fitness/lib/business-rules";
import { getFitnessOperationsDashboard, listExercises } from "@/features/fitness/services/fitness-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

type AdminFitnessPageProps = {
  searchParams: Promise<{ q?: string; category?: string; difficulty?: string; page?: string }>;
};

export const metadata: Metadata = createMetadata({
  title: "Fitness Operations",
  description: "Admin operations for fitness goals, exercise library, workout tracking, body measurements, nutrition logs, and progress reports.",
  path: "/admin/fitness"
});

export default async function AdminFitnessPage({ searchParams }: AdminFitnessPageProps) {
  const scope = await requireGymAdminScope("/admin/fitness");
  const params = await searchParams;
  const gymId = scope.gymId;
  const [dashboard, exerciseResult] = await Promise.all([
    getFitnessOperationsDashboard(gymId),
    listExercises({ gymId, query: params.q, category: params.category, difficulty: params.difficulty, page: Number(params.page ?? "1"), pageSize: 60 })
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Fitness Operations</p>
          <h2 className="mt-2 text-3xl font-black">Fitness tracking and progress analytics</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Monitor goals, workout adherence, measurement updates, nutrition logs, milestones, and the exercise library.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/fitness/reports?type=goal_progress" variant="secondary">Goals CSV</ButtonLink>
          <ButtonLink href="/api/fitness/reports?type=workout_adherence&format=pdf" variant="secondary">Workout PDF</ButtonLink>
          <ButtonLink href="/api/fitness/reports?type=nutrition_compliance&format=excel" variant="secondary">Nutrition Excel</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard detail="Members with progress records" icon={<UsersRound className="size-5" />} label="Tracked Members" value={String(dashboard.metrics.trackedMembers)} />
        <StatCard detail="Open outcomes" icon={<Target className="size-5" />} label="Active Goals" value={String(dashboard.metrics.activeGoals)} />
        <StatCard detail="Across tracked members" icon={<Dumbbell className="size-5" />} label="30 Day Workouts" value={String(dashboard.metrics.completedWorkouts30Days)} />
        <StatCard detail="Earned in last 30 days" icon={<Trophy className="size-5" />} label="Milestones" value={String(dashboard.metrics.milestonesEarned)} />
        <StatCard detail="Meal entries today" icon={<Apple className="size-5" />} label="Nutrition Logs" value={String(dashboard.metrics.nutritionLogsToday)} />
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-5" method="get">
            <input className="h-11 rounded-md border border-border bg-surface px-3 md:col-span-2" name="q" placeholder="Search exercise, muscle, or equipment" defaultValue={params.q ?? ""} />
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="category" defaultValue={params.category ?? "all"}>
              <option value="all">All categories</option>
              <option value="chest">Chest</option><option value="back">Back</option><option value="shoulders">Shoulders</option><option value="arms">Arms</option><option value="legs">Legs</option><option value="core">Core</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option>
            </select>
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="difficulty" defaultValue={params.difficulty ?? "all"}>
              <option value="all">All difficulty</option>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="elite">Elite</option>
            </select>
            <button className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">Apply Filters</button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Library className="size-5" /><h3 className="text-2xl font-black">Exercise Library</h3></div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {exerciseResult.exercises.map((exercise) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={exercise.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-black">{exercise.name}</h4>
                  <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-bold text-muted-foreground">{formatFitnessLabel(exercise.difficulty)}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatFitnessLabel(exercise.category)} · {exercise.primary_muscle_group} · {exercise.equipment}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{exercise.instructions}</p>
                <details className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <summary className="cursor-pointer text-xs font-black text-destructive">Delete</summary>
                  <div className="mt-2">
                    <ExerciseDeleteForm exerciseId={exercise.id} />
                  </div>
                </details>
              </div>
            ))}
            {exerciseResult.exercises.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No exercises match the current filters.</p> : null}
          </CardContent>
        </Card>
        
        {Math.ceil(exerciseResult.total / exerciseResult.pageSize) > 1 && (
          <div className="xl:col-span-2">
            <Pagination 
              currentPage={exerciseResult.page} 
              totalPages={Math.ceil(exerciseResult.total / exerciseResult.pageSize)} 
              baseHref="/admin/fitness"
              totalItems={exerciseResult.total}
            />
          </div>
        )}

        <Card>
          <CardHeader><h3 className="text-2xl font-black">Add Exercise</h3></CardHeader>
          <CardContent><ExerciseForm /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Activity className="size-5" /><h3 className="text-2xl font-black">Member Progress Summary</h3></div>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.summaries.slice(0, 30).map((summary) => (
            <div className="grid gap-3 rounded-lg border border-border bg-surface-muted p-4 text-sm md:grid-cols-6" key={summary.member_id}>
              <div className="md:col-span-2">
                <p className="font-black">{summary.full_name}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Last workout {summary.last_workout_date ?? "not logged"}</p>
              </div>
              <Metric label="Active Goals" value={String(summary.active_goals ?? 0)} />
              <Metric label="30d Workouts" value={String(summary.workouts_last_30_days ?? 0)} />
              <Metric label="Milestones" value={String(summary.milestone_count ?? 0)} />
              <Metric label="Meals" value={summary.last_meal_log_date ?? "none" } />
            </div>
          ))}
          {dashboard.summaries.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No member progress records yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
