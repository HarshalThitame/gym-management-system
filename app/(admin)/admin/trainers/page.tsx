import type { Metadata } from "next";
import { CalendarCheck, Dumbbell, Star, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { formatMoney } from "@/features/memberships/lib/business-rules";
import { TrainerAssignmentForm, TrainerForm, PtPurchaseForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { formatTrainingLabel } from "@/features/training/lib/business-rules";
import { listActiveTrainers, listPersonalTrainingPackages, listTrainers } from "@/features/training/services/training-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

type AdminTrainersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    specialization?: string;
    page?: string;
  }>;
};

export const metadata: Metadata = createMetadata({
  title: "Trainer Management",
  description: "Manage trainer profiles, assignments, personal training packages, and coaching operations.",
  path: "/admin/trainers"
});

export default async function AdminTrainersPage({ searchParams }: AdminTrainersPageProps) {
  const scope = await requireGymAdminScope("/admin/trainers");
  const params = await searchParams;
  const gymId = scope.gymId;
  const page = Number(params.page ?? "1");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const [trainerResult, activeTrainers, memberResult, packages, planContext] = await Promise.all([
    listTrainers({
      gymId,
      query: params.q,
      status: params.status,
      specialization: params.specialization,
      page
    }),
    listActiveTrainers(gymId),
    listMembers({ gymId, pageSize: 100 }),
    listPersonalTrainingPackages(gymId),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);
  const trainerAssignmentEnabled = planContext?.features.trainerAssignmentEnabled === true;
  const members = memberResult.members;
  const activeAssignments = trainerResult.trainers.reduce((total, trainer) => total + trainer.activeAssignments, 0);
  const upcomingSessions = trainerResult.trainers.reduce((total, trainer) => total + trainer.upcomingSessions, 0);
  const completedSessions = trainerResult.trainers.reduce((total, trainer) => total + trainer.completedSessions, 0);
  const averageRating = trainerResult.trainers.length > 0
    ? trainerResult.trainers.reduce((total, trainer) => total + trainer.averageRating, 0) / trainerResult.trainers.length
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Operations</p>
          <h2 className="mt-2 text-3xl font-black">Trainers, assignments, and PT packages</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Create trainer records, manage profile depth, assign members, track coaching workload, and connect personal training packages to billing-ready records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/trainers/packages" variant="secondary">PT Packages</ButtonLink>
          <ButtonLink href="/api/training/reports?type=sessions" variant="secondary">Sessions CSV</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={`${trainerResult.total} records in directory`} icon={<Dumbbell className="size-5" />} label="Active Trainers" value={String(activeTrainers.length)} />
        <StatCard detail="Members with active trainer links" icon={<UsersRound className="size-5" />} label="Assignments" value={String(activeAssignments)} />
        <StatCard detail={`${completedSessions} completed sessions tracked`} icon={<CalendarCheck className="size-5" />} label="Upcoming Sessions" value={String(upcomingSessions)} />
        <StatCard detail="Average submitted trainer rating" icon={<Star className="size-5" />} label="Rating" value={averageRating.toFixed(1)} />
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-5" method="get">
            <input className="h-11 rounded-md border border-border bg-surface px-3 md:col-span-2" name="q" placeholder="Search trainer name, email, phone, code" defaultValue={params.q ?? ""} />
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="status" defaultValue={params.status ?? "all"}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On leave</option>
              <option value="archived">Archived</option>
            </select>
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="specialization" defaultValue={params.specialization ?? "all"}>
              <option value="all">All specialties</option>
              <option value="strength_training">Strength</option>
              <option value="weight_loss">Weight loss</option>
              <option value="muscle_building">Muscle building</option>
              <option value="hiit">HIIT</option>
              <option value="yoga">Yoga</option>
              <option value="rehabilitation">Rehabilitation</option>
            </select>
            <button className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">Apply Filters</button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Trainer Directory</h3>
            <p className="text-sm leading-6 text-muted-foreground">Open a trainer to manage certifications, availability, sessions, notes, assignments, and analytics.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {trainerResult.trainers.map((trainer) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={trainer.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black">{trainer.display_name}</h4>
                      <TrainingStatusBadge status={trainer.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{trainer.employee_code} · {trainer.profile?.headline ?? "Performance Coach"} · {trainer.years_experience} yrs</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold capitalize text-muted-foreground">
                      {trainer.specializations.slice(0, 4).map((specialization) => (
                        <span className="rounded-full border border-border bg-surface px-2.5 py-1" key={specialization.id}>{formatTrainingLabel(specialization.specialization)}</span>
                      ))}
                    </div>
                  </div>
                  <ButtonLink href={`/admin/trainers/${trainer.id}`} variant="secondary">Open</ButtonLink>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <Metric label="Assignments" value={String(trainer.activeAssignments)} />
                  <Metric label="Upcoming" value={String(trainer.upcomingSessions)} />
                  <Metric label="Completed" value={String(trainer.completedSessions)} />
                  <Metric label="Rate" value={formatMoney(trainer.hourly_rate_amount)} />
                </div>
              </div>
            ))}
            {trainerResult.trainers.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No trainers match the current filters.</div> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Create Trainer</h3>
            </CardHeader>
            <CardContent>
              <TrainerForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Assign Trainer</h3>
            </CardHeader>
            <CardContent>
              {trainerAssignmentEnabled ? (
                <TrainerAssignmentForm members={members} trainers={activeTrainers} />
              ) : (
                <FeatureLocked compact featureName="Trainer Assignment" requiredPlan="Standard" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Assign PT Package</h3>
            </CardHeader>
            <CardContent>
              {trainerAssignmentEnabled ? (
                <PtPurchaseForm members={members} packages={packages.filter((packageRow) => packageRow.status === "active")} trainers={activeTrainers} />
              ) : (
                <FeatureLocked compact featureName="PT Package Assignment" requiredPlan="Standard" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
