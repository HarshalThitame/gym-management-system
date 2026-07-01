import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrainerNoteForm, WorkoutAssignmentForm, WorkoutExerciseForm, WorkoutProgramForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { getTrainerDashboard, getTrainerProfileBundle, listProgramTemplates } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { TemplateLibrary, ProgramCard } from "./client";

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
  const templates = await listProgramTemplates(context.profile?.gym_id ?? null);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Training</p>
        <h2 className="mt-2 text-3xl font-black">Workout Programs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Build structured workout plans, add exercises, assign to members, and browse shared templates.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Create Program</h3>
            <p className="text-xs font-semibold text-muted-foreground">Build a new workout plan from scratch</p>
          </CardHeader>
          <CardContent>
            <WorkoutProgramForm members={dashboard.assignedMembers} trainers={trainerList} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Assign Program</h3>
            <p className="text-xs font-semibold text-muted-foreground">Assign a program to a member</p>
          </CardHeader>
          <CardContent>
            <WorkoutAssignmentForm members={dashboard.assignedMembers} programs={programs} trainers={trainerList} />
          </CardContent>
        </Card>
      </div>

      {templates.length > 0 && (
        <TemplateLibrary templates={templates} />
      )}

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">My Programs</h3>
          <p className="text-xs font-semibold text-muted-foreground">{programs.length} program{programs.length !== 1 ? "s" : ""}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
          {programs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
              <p className="text-sm font-bold text-muted-foreground">No programs created yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create your first workout program above or clone a template.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Program Notes</h3>
        </CardHeader>
        <CardContent>
          <TrainerNoteForm members={dashboard.assignedMembers} trainers={trainerList} />
        </CardContent>
      </Card>
    </div>
  );
}
