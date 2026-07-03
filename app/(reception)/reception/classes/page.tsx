import type { Metadata } from "next";
import { CalendarDays, ListChecks, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getClassOperationsDashboard } from "@/features/classes/services/class-service";
import { listMembers } from "@/features/memberships/services/membership-service";
import { ReceptionClassBookingForm } from "@/features/reception/components/reception-class-booking-form";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Class Bookings",
  description: "Reception class booking workspace for assigned branch front desk operations.",
  path: "/reception/classes"
});

export default async function ReceptionClassesPage() {
  const scope = await requireReceptionScope("/reception/classes");
  const [dashboard, membersResult] = await Promise.all([
    getClassOperationsDashboard(scope.gymId),
    listMembers({
      gymId: scope.gymId,
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
      pageSize: 80
    })
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Class Bookings</p>
        <h2 className="mt-2 text-3xl font-black">Class booking desk</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Book members into assigned-gym classes, monitor capacity, and route full classes to waitlist support. Class configuration remains blocked.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Scheduled in the next 30 days" icon={<CalendarDays className="size-5" />} label="Upcoming Classes" value={String(dashboard.metrics.upcomingSessions)} />
        <StatCard detail="Active bookings across class sessions" icon={<UsersRound className="size-5" />} label="Booked Members" value={String(dashboard.metrics.activeBookings)} />
        <StatCard detail="Members waiting for seats" icon={<ListChecks className="size-5" />} label="Waitlist" value={String(dashboard.metrics.waitlistedMembers)} />
      </section>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Upcoming Sessions</h3>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {dashboard.sessions.slice(0, 12).map((session) => (
            <div className="space-y-4 rounded-md border border-border bg-surface-muted p-4" key={session.id}>
              <div>
                <p className="text-lg font-black">{session.class?.name ?? "Class session"}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.session_date} · {session.starts_at.slice(0, 5)}-{session.ends_at.slice(0, 5)} · {session.location ?? "No location"}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.booked_count}/{session.capacity} booked · {session.waitlist_count} waiting</p>
              </div>
              <ReceptionClassBookingForm members={membersResult.members} session={session} />
            </div>
          ))}
          {dashboard.sessions.length === 0 ? <EmptyState text="No upcoming class sessions are available for booking." /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
