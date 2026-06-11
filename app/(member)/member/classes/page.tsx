import type { Metadata } from "next";
import { CalendarCheck, Clock, Dumbbell, Timer, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { BookClassForm, CancelClassBookingForm } from "@/features/classes/components/class-forms";
import { ClassStatusBadge } from "@/features/classes/components/class-status-badge";
import { getAvailableSeats } from "@/features/classes/lib/business-rules";
import { getMemberClassesPortal } from "@/features/classes/services/class-service";
import { requirePrimaryRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Classes",
  description: "Browse classes, book sessions, track waitlists, and review class attendance.",
  path: "/member/classes"
});

export default async function MemberClassesPage() {
  const context = await requirePrimaryRole(["member"], "/member/classes");
  const portal = context.userId ? await getMemberClassesPortal(context.userId) : null;

  if (!portal) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Class access</h2></CardHeader>
        <CardContent><div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member profile is connected to this login yet.</div></CardContent>
      </Card>
    );
  }

  const upcomingBookings = portal.bookings.filter((booking) => ["booked", "checked_in"].includes(booking.status));
  const attendedCount = portal.attendance.filter((row) => row.status === "attended" || row.status === "late").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Class Booking</p>
        <h2 className="mt-2 text-3xl font-black">Browse and book group sessions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Book upcoming classes, track waitlists, cancel within policy windows, and review attendance history.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Confirmed upcoming sessions" icon={<CalendarCheck className="size-5" />} label="Bookings" value={String(upcomingBookings.length)} />
        <StatCard detail="Active waiting list entries" icon={<UsersRound className="size-5" />} label="Waitlisted" value={String(portal.waitlists.filter((row) => row.status === "waiting").length)} />
        <StatCard detail="Recorded attended classes" icon={<Dumbbell className="size-5" />} label="Attended" value={String(attendedCount)} />
        <StatCard detail="Sessions available this month" icon={<Clock className="size-5" />} label="Available" value={String(portal.availableSessions.length)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Available Classes</h3>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {portal.availableSessions.map((session) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={session.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-black">{session.class?.name ?? "Class session"}</h4>
                  <ClassStatusBadge status={session.status} />
                </div>
                <p className="mt-2 text-xs font-bold text-muted-foreground">{session.category?.name ?? "Class"} · {session.session_date} · {session.starts_at.slice(0, 5)}-{session.ends_at.slice(0, 5)}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{session.trainer?.display_name ?? "Trainer pending"} · {getAvailableSeats(session)} seats available · {session.waitlist_count} waiting</p>
                <div className="mt-4"><BookClassForm session={session} /></div>
              </div>
            ))}
            {portal.availableSessions.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No sessions are currently open for booking.</div> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Upcoming Bookings</h3></CardHeader>
            <CardContent className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div className="rounded-md border border-border bg-surface-muted p-3" key={booking.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{booking.session?.class?.name ?? "Class"}</p>
                    <ClassStatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{booking.session?.session_date ?? ""} · {booking.session?.starts_at.slice(0, 5) ?? ""}</p>
                  <div className="mt-3"><CancelClassBookingForm bookingId={booking.id} /></div>
                </div>
              ))}
              {upcomingBookings.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No upcoming booked classes.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-2xl font-black">Waitlist</h3></CardHeader>
            <CardContent className="space-y-3">
              {portal.waitlists.slice(0, 8).map((waitlist) => (
                <div className="rounded-md border border-border bg-surface-muted p-3" key={waitlist.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{waitlist.session?.class?.name ?? "Class"}</p>
                    <ClassStatusBadge status={waitlist.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">Position {waitlist.position} · {waitlist.session?.session_date ?? ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="size-5" />
            <h3 className="text-2xl font-black">Class Attendance</h3>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {portal.attendance.slice(0, 12).map((row) => (
            <div className="rounded-md border border-border bg-surface-muted p-3" key={row.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{row.marked_at.slice(0, 10)}</p>
                <ClassStatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Method: {row.method}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
