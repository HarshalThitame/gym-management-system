import type { Metadata } from "next";
import { CalendarCheck, Dumbbell, MessageSquareText, PackageCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/features/memberships/lib/business-rules";
import { TrainerFeedbackForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { getMemberTrainingPortal } from "@/features/training/services/training-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { RestTimer } from "@/features/member/components/rest-timer";
import { ExerciseLibrary } from "@/features/member/components/exercise-library";
import { listExercises } from "@/features/fitness/services/fitness-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Workouts",
  description: "Member workout programs, personal training packages, trainer notes, and session history.",
  path: "/member/workouts"
});

export default async function MemberWorkoutsPage() {
  const context = await requireMemberPortalAccess("/member/workouts");
  const portal = context.userId ? await getMemberTrainingPortal(context.userId) : null;
  const exercisesResult = await listExercises({ gymId: context.profile?.gym_id ?? null, pageSize: 80 });

  if (!portal) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Training access</h2></CardHeader>
        <CardContent><div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member training profile is connected to this login yet.</div></CardContent>
      </Card>
    );
  }

  const activePackage = portal.packages.find((packageRow) => packageRow.status === "active") ?? null;
  const nextSession = portal.sessions.find((session) => session.status === "scheduled" || session.status === "rescheduled") ?? null;
  const feedbackSession = portal.sessions.find((session) => session.status === "completed") ?? portal.sessions[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Training Portal" title="Workout programs and coaching" description="View assigned plans, personal training packages, upcoming sessions, and trainer notes shared with you." />

      <AnimatedCardSection>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail={portal.trainer?.display_name ?? "No trainer assigned"} icon={<Dumbbell className="size-5" />} label="Trainer" value={portal.trainer ? "Assigned" : "None"} />
          <StatCard detail={activePackage ? `${activePackage.remaining_sessions} sessions remaining` : "No active package"} icon={<PackageCheck className="size-5" />} label="PT Package" value={activePackage?.status.replaceAll("_", " ") ?? "None"} />
          <StatCard detail={nextSession ? `${nextSession.session_date} at ${nextSession.starts_at.slice(0, 5)}` : "No upcoming session"} icon={<CalendarCheck className="size-5" />} label="Next Session" value={nextSession?.workout_type ?? "None"} />
          <StatCard detail="Trainer notes shared with member" icon={<MessageSquareText className="size-5" />} label="Notes" value={String(portal.notes.length)} />
        </div>
      </AnimatedCardSection>

      <AnimatedCardSection delay={0.05}>
        <RestTimer defaultDuration={60} />
      </AnimatedCardSection>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <AnimatedCardSection delay={0.1}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Assigned Programs</h3></CardHeader>
            <CardContent className="space-y-4">
              {portal.programs.map((assignment) => (
                <div className="rounded-xl border border-border bg-surface-muted p-4 card-hover" key={assignment.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black">{assignment.program?.name ?? "Workout program"}</h4>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{assignment.program?.goal ?? "Goal pending"} · starts {assignment.starts_on}</p>
                    </div>
                    <TrainingStatusBadge status={assignment.status} />
                  </div>
                  <div className="mt-4 space-y-2">
                    {assignment.exercises.map((exercise) => (
                      <div className="rounded-lg border border-border bg-surface p-3 card-hover" key={exercise.id}>
                        <p className="font-bold">Day {exercise.day_number}: {exercise.exercise_name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{exercise.sets} sets · {exercise.reps} reps · {exercise.rest_seconds ?? 0}s rest</p>
                        {exercise.instructions ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{exercise.instructions}</p> : null}
                      </div>
                    ))}
                    {assignment.exercises.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">Exercises will appear after your trainer adds them.</p> : null}
                  </div>
                </div>
              ))}
              {portal.programs.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No workout program assigned yet.</div> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <div className="space-y-5">
          <AnimatedCardSection delay={0.15}>
            <Card variant="glass">
              <CardHeader><h3 className="text-2xl font-black">Personal Training Packages</h3></CardHeader>
              <CardContent className="space-y-3">
                {portal.packages.map((packageRow) => (
                  <div className="rounded-lg border border-border bg-surface-muted p-3 card-hover" key={packageRow.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{formatMoney(packageRow.price_amount)}</p>
                        <p className="text-xs font-semibold text-muted-foreground">{packageRow.remaining_sessions}/{packageRow.total_sessions} sessions remaining · expires {packageRow.expires_on}</p>
                      </div>
                      <TrainingStatusBadge status={packageRow.status} />
                    </div>
                  </div>
                ))}
                {portal.packages.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No PT package purchased yet.</p> : null}
              </CardContent>
            </Card>
          </AnimatedCardSection>

          <AnimatedCardSection delay={0.2}>
            <Card variant="glass">
              <CardHeader><h3 className="text-2xl font-black">Sessions</h3></CardHeader>
              <CardContent className="space-y-3">
                {portal.sessions.slice(0, 8).map((session) => (
                  <div className="rounded-lg border border-border bg-surface-muted p-3 card-hover" key={session.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{session.workout_type}</p>
                      <TrainingStatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.trainer?.display_name ?? "Trainer"} · {session.session_date} · {session.starts_at.slice(0, 5)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </AnimatedCardSection>
        </div>
      </div>

      <AnimatedCardSection delay={0.25}>
        <Card variant="glass">
          <CardHeader>
            <h3 className="text-2xl font-black">Exercise Library</h3>
            <p className="text-sm leading-6 text-muted-foreground">Browse exercises by muscle group, difficulty, and equipment. Click to see instructions.</p>
          </CardHeader>
          <CardContent>
            <ExerciseLibrary exercises={exercisesResult.exercises} compact />
          </CardContent>
        </Card>
      </AnimatedCardSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <AnimatedCardSection delay={0.25}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Trainer Notes</h3></CardHeader>
            <CardContent className="space-y-3">
              {portal.notes.map((note) => (
                <div className="rounded-lg border border-border bg-surface-muted p-4 card-hover" key={note.id}>
                  <p className="font-bold">{note.title}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{note.note_type.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.body}</p>
                </div>
              ))}
              {portal.notes.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No trainer notes shared yet.</p> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.3}>
          {portal.trainer ? (
            <TrainerFeedbackForm memberId={portal.member.id} sessionId={feedbackSession?.id ?? ""} trainerId={portal.trainer.id} />
          ) : null}
        </AnimatedCardSection>
      </div>
    </div>
  );
}
