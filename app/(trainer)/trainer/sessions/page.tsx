import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TrainerSessionForm } from "@/features/training/components/training-forms";
import { getTrainerDashboard } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { SessionsClient, SessionsCalendar, SessionsFilteredList } from "./client";

export const metadata: Metadata = createMetadata({
  title: "Trainer Sessions",
  description: "Create, complete, cancel, and track personal training sessions.",
  path: "/trainer/sessions"
});

export default async function TrainerSessionsPage() {
  const context = await requireRole(["trainer"], "/trainer/sessions");
  const dashboard = await getTrainerDashboard(context.userId ?? "", context.profile?.gym_id ?? null);
  const trainerList = dashboard.trainer ? [dashboard.trainer] : [];

  return (
    <SessionsClient>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainer" }, { label: "Sessions" }]} />
      <div className="animate-fade-in-up">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Training</p>
        <h2 className="mt-2 text-3xl font-black">Sessions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Schedule, manage, and track personal training sessions with conflict protection.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <SessionsCalendar sessions={dashboard.upcomingSessions} />
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">All Sessions</h3>
            </CardHeader>
            <CardContent>
              <SessionsFilteredList sessions={dashboard.upcomingSessions} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Schedule Session</h3>
              <p className="text-xs font-semibold text-muted-foreground">Create new PT session with conflict checks</p>
            </CardHeader>
            <CardContent>
              <TrainerSessionForm members={dashboard.assignedMembers} trainers={trainerList} />
            </CardContent>
          </Card>
        </div>
      </div>
    </SessionsClient>
  );
}
