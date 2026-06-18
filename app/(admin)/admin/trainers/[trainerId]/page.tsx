import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, CalendarCheck, Clock, Star, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { listMembers } from "@/features/memberships/services/membership-service";
import { formatMoney } from "@/features/memberships/lib/business-rules";
import {
  AvailabilityForm,
  CertificationForm,
  EndAssignmentForm,
  TrainerAssignmentForm,
  TrainerForm,
  TrainerNoteForm,
  TrainerSessionForm,
  TrainerSessionStatusForm,
  TrainerSpecializationForm,
  WorkoutAssignmentForm,
  WorkoutExerciseForm,
  WorkoutProgramForm
} from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { formatTrainingLabel } from "@/features/training/lib/business-rules";
import { getTrainerProfileBundle, listActiveTrainers } from "@/features/training/services/training-service";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

type TrainerProfilePageProps = {
  params: Promise<{ trainerId: string }>;
};

export async function generateMetadata({ params }: TrainerProfilePageProps): Promise<Metadata> {
  const { trainerId } = await params;
  return createMetadata({
    title: "Trainer Profile",
    description: `Trainer operations profile ${trainerId}.`,
    path: `/admin/trainers/${trainerId}`
  });
}

export default async function AdminTrainerProfilePage({ params }: TrainerProfilePageProps) {
  const scope = await requireGymAdminScope("/admin/trainers");
  const { trainerId } = await params;
  const gymId = scope.gymId;
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "trainer_management", actionName: "admin.trainer.profile.read" });
  const [bundle, activeTrainers, membersResult, planContext] = await Promise.all([
    getTrainerProfileBundle(trainerId),
    listActiveTrainers(gymId),
    listMembers({ gymId, pageSize: 100 }),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);

  if (!bundle || bundle.trainer.gym_id !== gymId) {
    notFound();
  }

  const activeAssignments = bundle.assignments.filter((assignment) => assignment.status === "active");
  const upcomingSessions = bundle.sessions.filter((session) => session.status === "scheduled" || session.status === "rescheduled");
  const completedSessions = bundle.sessions.filter((session) => session.status === "completed");
  const averageRating = bundle.feedback.length > 0
    ? bundle.feedback.reduce((total, feedback) => total + feedback.rating, 0) / bundle.feedback.length
    : 0;
  const trainerAssignmentEnabled = planContext?.features.workoutAssignment === true;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-black">{bundle.trainer.display_name}</h2>
            <TrainingStatusBadge status={bundle.trainer.status} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{bundle.trainer.employee_code} · {bundle.profile?.headline ?? "Performance Coach"} · {bundle.trainer.email ?? "No email"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Active member assignments" icon={<UsersRound className="size-5" />} label="Assigned Members" value={String(activeAssignments.length)} />
        <StatCard detail={`${completedSessions.length} completed sessions`} icon={<CalendarCheck className="size-5" />} label="Upcoming Sessions" value={String(upcomingSessions.length)} />
        <StatCard detail={formatMoney(bundle.trainer.hourly_rate_amount)} icon={<Clock className="size-5" />} label="Hourly Rate" value={`${bundle.trainer.years_experience} yrs`} />
        <StatCard detail={`${bundle.feedback.length} feedback records`} icon={<Star className="size-5" />} label="Rating" value={averageRating.toFixed(1)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Profile Management</h3>
          </CardHeader>
          <CardContent>
            <TrainerForm profile={bundle.profile} trainer={bundle.trainer} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Specializations</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm font-bold capitalize">
                {bundle.specializations.map((specialization) => (
                  <span className="rounded-full border border-border bg-surface-muted px-3 py-1" key={specialization.id}>{formatTrainingLabel(specialization.specialization)} · {specialization.proficiency}</span>
                ))}
              </div>
              <TrainerSpecializationForm trainerId={bundle.trainer.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="size-5" />
                <h3 className="text-2xl font-black">Certifications</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {bundle.certifications.map((certification) => (
                <div className="rounded-md border border-border bg-surface-muted p-3" key={certification.id}>
                  <p className="font-bold">{certification.certification_name}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{certification.issuing_organization} · expires {certification.expiry_date ?? "not set"}</p>
                </div>
              ))}
              <CertificationForm trainerId={bundle.trainer.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Availability</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {bundle.availability.map((availability) => (
              <div className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold" key={availability.id}>
                Day {availability.day_of_week} · {availability.starts_at.slice(0, 5)}-{availability.ends_at.slice(0, 5)} {availability.is_active ? "" : "· inactive"}
              </div>
            ))}
            <AvailabilityForm trainerId={bundle.trainer.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Member Assignments</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {trainerAssignmentEnabled ? (
              <TrainerAssignmentForm defaultTrainerId={bundle.trainer.id} members={membersResult.members} trainers={activeTrainers} />
            ) : (
              <FeatureLocked compact featureName="Trainer Assignment" requiredPlan="Standard" />
            )}
            {bundle.assignments.map((assignment) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={assignment.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-bold">{assignment.member?.full_name ?? "Unknown member"}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{assignment.assignment_type.replaceAll("_", " ")} · {assignment.status}</p>
                  </div>
                  {assignment.status === "active" ? <EndAssignmentForm assignment={assignment} /> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Sessions</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {trainerAssignmentEnabled ? (
              <TrainerSessionForm defaultTrainerId={bundle.trainer.id} members={membersResult.members} trainers={activeTrainers} />
            ) : (
              <FeatureLocked compact featureName="PT Sessions" requiredPlan="Standard" />
            )}
            {bundle.sessions.slice(0, 8).map((session) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={session.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{session.member?.full_name ?? "Unknown member"}</p>
                      <TrainingStatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.session_date} · {session.starts_at.slice(0, 5)} · {session.workout_type}</p>
                  </div>
                  {session.status === "scheduled" || session.status === "rescheduled" ? <div className="w-full max-w-sm"><TrainerSessionStatusForm session={session} /></div> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Workout Programs</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {trainerAssignmentEnabled ? (
              <>
                <WorkoutProgramForm defaultTrainerId={bundle.trainer.id} members={membersResult.members} trainers={activeTrainers} />
                <WorkoutAssignmentForm members={membersResult.members} programs={bundle.programs} trainers={activeTrainers} />
              </>
            ) : (
              <FeatureLocked compact featureName="Workout Program Assignment" requiredPlan="Standard" />
            )}
            {bundle.programs.map((program) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={program.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{program.name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{program.goal} · {program.difficulty}</p>
                  </div>
                  <TrainingStatusBadge status={program.status} />
                </div>
                <div className="mt-3">
                  <WorkoutExerciseForm programId={program.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Trainer Notes</h3>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-[0.9fr_1fr]">
          <TrainerNoteForm defaultTrainerId={bundle.trainer.id} members={membersResult.members} trainers={activeTrainers} />
          <div className="space-y-3">
            {bundle.notes.map((note) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={note.id}>
                <p className="font-bold">{note.title}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{note.note_type} · {note.visibility}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
