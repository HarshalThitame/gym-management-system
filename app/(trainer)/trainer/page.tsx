import type { Metadata } from "next";
import { Activity, CalendarCheck, CalendarDays, Dumbbell, MessageSquare, Star, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getTrainerClassesPortal } from "@/features/classes/services/class-service";
import { getTrainerNotificationCenter } from "@/features/communications/services/communication-service";
import { getTrainerFitnessPortal } from "@/features/fitness/services/fitness-service";
import { formatMoney } from "@/features/memberships/lib/business-rules";
import { TrainerSessionForm, TrainerSessionStatusForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { getTrainerDashboard } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Trainer Dashboard",
  description: "Protected trainer dashboard for assigned members and sessions.",
  path: "/trainer"
});

export default async function TrainerDashboardPage() {
  const context = await requireRole(["trainer", "gym_admin", "super_admin"], "/trainer");
  const [dashboard, classPortal, fitnessPortal, communications] = await Promise.all([
    getTrainerDashboard(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerClassesPortal(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerFitnessPortal(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerNotificationCenter(context.userId ?? "", context.profile?.gym_id ?? null)
  ]);
  const trainerList = dashboard.trainer ? [dashboard.trainer] : [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Dashboard</p>
        <h2 className="mt-2 text-3xl font-black">{dashboard.trainer?.display_name ?? "Trainer profile not linked"}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage today&apos;s coaching work, assigned members, upcoming personal training sessions, and performance signals.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard detail="Active coaching assignments" icon={<UsersRound className="size-5" />} label="Assigned Members" value={String(dashboard.metrics.assignedMembers)} />
        <StatCard detail="Scheduled for today" icon={<CalendarDays className="size-5" />} label="Today" value={String(dashboard.metrics.todaySessions)} />
        <StatCard detail="Next 30 days" icon={<Dumbbell className="size-5" />} label="Upcoming" value={String(dashboard.metrics.upcomingSessions)} />
        <StatCard detail="Assigned group sessions" icon={<CalendarCheck className="size-5" />} label="Classes" value={String(classPortal.sessions.length)} />
        <StatCard detail={`${fitnessPortal.metrics.membersMissingWorkouts} need follow-up`} icon={<Activity className="size-5" />} label="Progress" value={String(fitnessPortal.metrics.activeGoals)} />
        <StatCard detail={`${communications?.metrics.priority ?? 0} priority alerts`} icon={<MessageSquare className="size-5" />} label="Messages" value={String(communications?.metrics.unread ?? 0)} />
        <StatCard detail={`${formatMoney(dashboard.metrics.ptRevenue)} PT package value`} icon={<Star className="size-5" />} label="Rating" value={dashboard.metrics.averageRating.toFixed(1)} />
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

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Today&apos;s Sessions</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.todaysSessions.map((session) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={session.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                      <TrainingStatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.starts_at.slice(0, 5)}-{session.ends_at.slice(0, 5)} · {session.workout_type}</p>
                  </div>
                  {session.status === "scheduled" || session.status === "rescheduled" ? <div className="w-full max-w-sm"><TrainerSessionStatusForm session={session} /></div> : null}
                </div>
              </div>
            ))}
            {dashboard.todaysSessions.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No sessions scheduled for today.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Schedule Session</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrainerSessionForm members={dashboard.assignedMembers} trainers={trainerList} />
            <ButtonLink href="/trainer/classes" variant="secondary">Manage Group Classes</ButtonLink>
            <ButtonLink href="/trainer/progress" variant="secondary">Review Progress</ButtonLink>
            <ButtonLink href="/trainer/communications" variant="secondary">Communications</ButtonLink>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Assigned Members</h3>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {dashboard.assignedMembers.map((member) => (
            <div className="rounded-md border border-border bg-surface-muted p-4" key={member.id}>
              <p className="font-bold">{member.full_name}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.member_code} · {member.phone}</p>
            </div>
          ))}
          {dashboard.assignedMembers.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No active member assignments yet.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
