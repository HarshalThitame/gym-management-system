import type { Metadata } from "next";
import { CalendarCheck, Clock, Flame, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { RegenerateQrForm } from "@/features/attendance/components/attendance-forms";
import { AttendanceStatusBadge } from "@/features/attendance/components/attendance-status-badge";
import { getMemberAttendancePortal } from "@/features/attendance/services/attendance-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Attendance",
  description: "Protected member attendance history.",
  path: "/member/attendance"
});

export default async function MemberAttendancePage() {
  const context = await requireRole(["member", "super_admin"], "/member/attendance");
  const portal = context.userId ? await getMemberAttendancePortal(context.userId) : null;

  if (!portal) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Attendance</h2>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member attendance record is connected to this login yet.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance</p>
        <h2 className="mt-2 text-3xl font-black">Check-in QR and visit history</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Use your QR at reception and track visit count, streak, monthly activity, and workout duration.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total tracked visits" icon={<CalendarCheck className="size-5" />} label="Attendance Count" value={String(portal.metrics.attendanceCount)} />
        <StatCard detail={portal.metrics.lastVisitAt ? new Date(portal.metrics.lastVisitAt).toLocaleString("en-IN") : "No visit yet"} icon={<Clock className="size-5" />} label="Last Visit" value={portal.metrics.lastVisitAt ? "Recorded" : "None"} />
        <StatCard detail="Consecutive training days" icon={<Flame className="size-5" />} label="Current Streak" value={String(portal.metrics.currentStreak)} />
        <StatCard detail={`${portal.metrics.averageDuration}m average duration`} icon={<QrCode className="size-5" />} label="Monthly Visits" value={String(portal.metrics.monthlyVisits)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Member QR</h3>
            <p className="text-sm leading-6 text-muted-foreground">This QR is scoped to attendance, expires automatically, and can be regenerated if shared accidentally.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center rounded-lg border border-border bg-white p-5">
              {portal.qrSvg ? <div aria-label="Attendance QR code" dangerouslySetInnerHTML={{ __html: portal.qrSvg }} /> : <p className="text-sm font-semibold text-muted-foreground">QR unavailable.</p>}
            </div>
            <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
              <p className="font-bold">Expires</p>
              <p className="mt-1 text-muted-foreground">{portal.qrToken ? new Date(portal.qrToken.expires_at).toLocaleString("en-IN") : "No active token"}</p>
            </div>
            <RegenerateQrForm memberId={portal.member.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Visit History</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {portal.visits.map((visit) => (
              <div className="grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center" key={visit.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{new Date(visit.check_in_at).toLocaleDateString("en-IN")}</p>
                    <AttendanceStatusBadge status={visit.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">In {new Date(visit.check_in_at).toLocaleTimeString("en-IN")} · Out {visit.check_out_at ? new Date(visit.check_out_at).toLocaleTimeString("en-IN") : "still inside"}</p>
                </div>
                <p className="font-semibold capitalize">{visit.check_in_source.replaceAll("_", " ")}</p>
                <p className="font-black">{visit.duration_minutes ?? 0}m</p>
              </div>
            ))}
            {portal.visits.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No visits recorded yet.</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
