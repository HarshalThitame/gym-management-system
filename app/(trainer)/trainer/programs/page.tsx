import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrainerNoteForm, WorkoutAssignmentForm, WorkoutExerciseForm, WorkoutProgramForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { getTrainerDashboard, getTrainerProfileBundle } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Trainer Workout Programs",
  description: "Create workout programs, add exercises, and assign plans to members.",
  path: "/trainer/programs"
});

export default async function TrainerProgramsPage() {
  const context = await requireRole(["trainer"], "/trainer/programs");
  const dashboard = await getTrainerDashboard(context.userId ?? "", context.profile?.gym_id ?? null);
  const bundle = dashboard.trainer ? await getTrainerProfileBundle(dashboard.trainer.id) : null;
  const trainerList = dashboard.trainer ? [dashboard.trainer] : [];
  const programs = bundle?.programs ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Create Workout Program</h2>
            <p className="text-sm leading-6 text-muted-foreground">Build structured plans with exercises, duration, goals, and member assignment.</p>
          </CardHeader>
          <CardContent>
            <WorkoutProgramForm members={dashboard.assignedMembers} trainers={trainerList} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Assign Program</h2>
          </CardHeader>
          <CardContent>
            <WorkoutAssignmentForm members={dashboard.assignedMembers} programs={programs} trainers={trainerList} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Program Library</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {programs.map((program) => (
            <div className="rounded-lg border border-border bg-surface-muted p-4" key={program.id}>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">{program.name}</h3>
                    <TrainingStatusBadge status={program.status} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{program.goal} · {program.difficulty} · {program.duration_weeks} weeks</p>
                  {program.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{program.description}</p> : null}
                </div>
              </div>
              <div className="mt-4">
                <WorkoutExerciseForm programId={program.id} />
              </div>
            </div>
          ))}
          {programs.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No workout programs created yet.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Program Notes</h2>
        </CardHeader>
        <CardContent>
          <TrainerNoteForm members={dashboard.assignedMembers} trainers={trainerList} />
        </CardContent>
      </Card>
    </div>
  );
}
