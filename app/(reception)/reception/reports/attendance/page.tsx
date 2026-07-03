import type { Metadata } from "next";
import { ArrowLeft, CalendarCheck, Clock, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAttendanceDashboard } from "@/features/attendance/services/attendance-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Attendance Report",
  description: "Daily attendance report for front desk operations.",
  path: "/reception/reports/attendance"
});

export default async function AttendanceReportPage() {
  const scope = await requireReceptionScope("/reception/reports/attendance");
  const dashboard = await getAttendanceDashboard(scope.gymId);

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/reports" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
          <h2 className="text-2xl font-black">Attendance Report</h2>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Checked in today" icon={<CalendarCheck className="size-5" />} label="Today's Check-Ins" value={String(dashboard.metrics.todayCheckIns)} />
        <StatCard detail="Currently inside gym" icon={<UsersRound className="size-5" />} label="Currently Inside" value={String(dashboard.metrics.currentInside)} />
        <StatCard detail="Weekly visits" icon={<Clock className="size-5" />} label="Weekly Visits" value={String(dashboard.metrics.weeklyAttendance)} />
        <StatCard detail="Monthly visits" icon={<CalendarCheck className="size-5" />} label="Monthly Visits" value={String(dashboard.metrics.monthlyAttendance)} />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Current Sessions</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.currentSessions.map((session) => (
            <div className="rounded-md border border-border bg-surface p-4" key={session.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black">{session.member?.full_name ?? "Member"}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    Checked in: {new Date(session.check_in_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <Badge variant="success-glow">{session.status}</Badge>
              </div>
            </div>
          ))}
          {dashboard.currentSessions.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No members currently checked in.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
