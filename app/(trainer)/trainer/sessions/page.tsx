import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrainerSessionForm, TrainerSessionStatusForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { getTrainerDashboard } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Trainer Sessions",
  description: "Create, complete, cancel, and track personal training sessions.",
  path: "/trainer/sessions"
});

export default async function TrainerSessionsPage() {
  const context = await requireRole(["trainer", "gym_admin", "super_admin"], "/trainer/sessions");
  const dashboard = await getTrainerDashboard(context.userId ?? "", context.profile?.gym_id ?? null);
  const trainerList = dashboard.trainer ? [dashboard.trainer] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Schedule Session</h2>
          <p className="text-sm leading-6 text-muted-foreground">Create member sessions with schedule conflict protection and package usage tracking when completed.</p>
        </CardHeader>
        <CardContent>
          <TrainerSessionForm members={dashboard.assignedMembers} trainers={trainerList} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Upcoming Sessions</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.upcomingSessions.map((session) => (
            <div className="rounded-md border border-border bg-surface-muted p-4" key={session.id}>
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                    <TrainingStatusBadge status={session.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.session_date} · {session.starts_at.slice(0, 5)}-{session.ends_at.slice(0, 5)} · {session.workout_type}</p>
                  {session.notes ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{session.notes}</p> : null}
                </div>
                <div className="w-full max-w-sm">
                  <TrainerSessionStatusForm session={session} />
                </div>
              </div>
            </div>
          ))}
          {dashboard.upcomingSessions.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No upcoming sessions scheduled.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
