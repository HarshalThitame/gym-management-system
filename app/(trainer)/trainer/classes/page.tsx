import type { Metadata } from "next";
import { CalendarCheck, ClipboardCheck, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ClassAttendanceForm, ClassSessionStatusForm } from "@/features/classes/components/class-forms";
import { ClassStatusBadge } from "@/features/classes/components/class-status-badge";
import { getTrainerClassesPortal } from "@/features/classes/services/class-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Trainer Classes",
  description: "Trainer class schedule, group session management, and attendance marking.",
  path: "/trainer/classes"
});

export default async function TrainerClassesPage() {
  const context = await requireRole(["trainer"], "/trainer/classes");
  const portal = await getTrainerClassesPortal(context.userId ?? "", context.profile?.gym_id ?? null);
  const todaysSessions = portal.sessions.filter((session) => session.session_date === new Date().toISOString().slice(0, 10));
  const activeBookings = portal.bookings.filter((booking) => ["booked", "checked_in"].includes(booking.status));
  const averageFill = portal.utilization.length > 0 ? Math.round(portal.utilization.reduce((total, row) => total + row.fillRate, 0) / portal.utilization.length) : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Classes</p>
        <h2 className="mt-2 text-3xl font-black">Schedule, attendance, and class notes</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage assigned group sessions, update session status, and record class attendance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Assigned sessions in the next 30 days" icon={<CalendarCheck className="size-5" />} label="Upcoming" value={String(portal.sessions.length)} />
        <StatCard detail="Confirmed members across listed sessions" icon={<UsersRound className="size-5" />} label="Bookings" value={String(activeBookings.length)} />
        <StatCard detail="Average upcoming class fill" icon={<ClipboardCheck className="size-5" />} label="Fill Rate" value={`${averageFill}%`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader><h3 className="text-2xl font-black">Assigned Sessions</h3></CardHeader>
          <CardContent className="space-y-3">
            {portal.sessions.map((session) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={session.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{session.class?.name ?? "Class session"}</p>
                      <ClassStatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.session_date} · {session.starts_at.slice(0, 5)}-{session.ends_at.slice(0, 5)} · {session.booked_count}/{session.capacity} booked</p>
                  </div>
                  <div className="w-full max-w-sm">
                    <ClassSessionStatusForm session={session} />
                  </div>
                </div>
              </div>
            ))}
            {portal.sessions.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No assigned class sessions found.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-2xl font-black">Today</h3></CardHeader>
          <CardContent className="space-y-3">
            {todaysSessions.map((session) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={session.id}>
                <p className="font-bold">{session.class?.name ?? "Class"}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.starts_at.slice(0, 5)} · {session.location ?? "Studio"}</p>
              </div>
            ))}
            {todaysSessions.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No class sessions today.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Attendance Queue</h3>
          <p className="text-sm leading-6 text-muted-foreground">Mark attendance for booked members. Staff can use the same flow from class operations when needed.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBookings.map((booking) => (
            <div className="rounded-md border border-border bg-surface-muted p-3" key={booking.id}>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Member {booking.member_id.slice(0, 8)} · Session {booking.session_id.slice(0, 8)}</p>
              <ClassAttendanceForm booking={booking} />
            </div>
          ))}
          {activeBookings.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No active bookings to mark.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
