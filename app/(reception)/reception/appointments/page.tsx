import type { Metadata } from "next";
import { CalendarCheck, CalendarDays, CalendarPlus, Clock, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getAppointmentDashboard } from "@/features/appointments/services/appointment-service";
import { listActiveTrainers } from "@/features/training/services/training-service";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { AppointmentForm, AppointmentStatusBadge, AppointmentTypeBadge, QuickStatusActions } from "@/features/appointments/components/appointment-forms";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Appointments",
  description: "Schedule and manage appointments, consultations, and trial sessions from the front desk.",
  path: "/reception/appointments"
});

export default async function ReceptionAppointmentsPage() {
  const scope = await requireReceptionScope("/reception/appointments");
  const [dashboard, membersResult, trainers] = await Promise.all([
    getAppointmentDashboard(scope.gymId, {
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    }),
    listMembers({
      gymId: scope.gymId,
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
      pageSize: 100
    }),
    listActiveTrainers(scope.gymId, {
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    })
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Appointments</p>
        <h2 className="mt-2 text-3xl font-black bg-gradient-to-r from-foreground via-accent to-purple-400 bg-clip-text text-transparent">Appointment desk</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Schedule consultations, trial sessions, trainer meetings, and follow-ups for assigned branch members.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          detail="Scheduled for today"
          icon={<CalendarCheck className="size-5" />}
          label="Today's Appointments"
          value={String(dashboard.metrics.todayAppointments)}
        />
        <StatCard
          detail="Completed today"
          icon={<CalendarDays className="size-5" />}
          label="Completed"
          value={String(dashboard.metrics.todayCompleted)}
        />
        <StatCard
          detail="Cancelled or no-show"
          icon={<Clock className="size-5" />}
          label="Cancelled / No-Shows"
          value={String(dashboard.metrics.todayCancelled + dashboard.metrics.todayNoShows)}
        />
        <StatCard
          detail="Awaiting confirmation"
          icon={<CalendarPlus className="size-5" />}
          label="Pending Confirmations"
          value={String(dashboard.metrics.pendingConfirmations)}
        />
        <StatCard
          detail="In the next 7 days"
          icon={<UsersRound className="size-5" />}
          label="Upcoming"
          value={String(dashboard.metrics.upcomingAppointments)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Schedule Appointment</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Fill in the details below to schedule a new appointment.
            </p>
          </CardHeader>
          <CardContent>
            <AppointmentForm members={membersResult.members} trainers={trainers} />
          </CardContent>
        </Card>

        <section className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Today&apos;s Appointments</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.today.map((appointment) => (
                <div
                  className="rounded-md border border-border bg-surface p-4"
                  key={appointment.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{appointment.title}</p>
                        <AppointmentStatusBadge status={appointment.status} />
                      </div>
                      <AppointmentTypeBadge type={appointment.type} />
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {appointment.member?.full_name ?? "Unknown member"}
                        {" · "}
                        {new Date(appointment.starts_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                        {" - "}
                        {new Date(appointment.ends_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                      {appointment.trainer?.display_name ? (
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          Trainer: {appointment.trainer.display_name}
                        </p>
                      ) : null}
                      {appointment.location ? (
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          Location: {appointment.location}
                        </p>
                      ) : null}
                    </div>
                    <QuickStatusActions appointment={appointment} />
                  </div>
                </div>
              ))}
              {dashboard.today.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
                  No appointments scheduled for today.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Upcoming (Next 7 Days)</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.upcoming.map((appointment) => (
                <div
                  className="rounded-md border border-border bg-surface-muted p-4"
                  key={appointment.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{appointment.title}</p>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {appointment.member?.full_name ?? "Unknown member"}
                        {" · "}
                        {new Date(appointment.starts_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                </div>
              ))}
              {dashboard.upcoming.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
                  No upcoming appointments scheduled.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Recent Activity</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.recent.map((appointment) => (
            <div
              className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 md:grid-cols-[1fr_auto] md:items-center"
              key={appointment.id}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{appointment.title}</p>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {appointment.member?.full_name ?? "Unknown member"}
                  {appointment.trainer?.display_name ? ` · ${appointment.trainer.display_name}` : ""}
                  {" · "}
                  {new Date(appointment.starts_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </p>
                {appointment.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{appointment.notes.slice(0, 120)}</p>
                ) : null}
              </div>
              <AppointmentTypeBadge type={appointment.type} />
            </div>
          ))}
          {dashboard.recent.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No recent appointment activity.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
