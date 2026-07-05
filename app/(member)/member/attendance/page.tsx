import type { Metadata } from "next";
import { CalendarCheck, Clock, Flame, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { RegenerateQrForm } from "@/features/attendance/components/attendance-forms";
import { DynamicAttendanceQr } from "@/features/member/components/dynamic-attendance-qr";
import { AttendanceStatusBadge } from "@/features/attendance/components/attendance-status-badge";
import { getMemberAttendancePortal } from "@/features/attendance/services/attendance-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection, AnimatedListSection, AnimatedListItem } from "@/features/member/components/page-wrappers";
import { StreakHeatmap } from "@/features/member/components/streak-heatmap";
import { SelfCheckInButton } from "@/features/member/components/self-checkin-button";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Attendance",
  description: "Protected member attendance history.",
  path: "/member/attendance"
});

export default async function MemberAttendancePage() {
  const context = await requireMemberPortalAccess("/member/attendance");
  const portal = context.userId ? await getMemberAttendancePortal(context.userId) : null;

  if (!portal) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Attendance</h2></CardHeader>
        <CardContent>
          <div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member attendance record is connected to this login yet.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Attendance" title="Check-in QR and visit history" description="Use your QR at reception and track visit count, streak, monthly activity, and workout duration." />

      <AnimatedCardSection>
        <SelfCheckInButton memberId={portal.member.id} />
      </AnimatedCardSection>

      <AnimatedCardSection delay={0.05}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Total tracked visits" icon={<CalendarCheck className="size-5" />} label="Attendance Count" value={String(portal.metrics.attendanceCount)} />
          <StatCard detail={portal.metrics.lastVisitAt ? new Date(portal.metrics.lastVisitAt).toLocaleString("en-IN") : "No visit yet"} icon={<Clock className="size-5" />} label="Last Visit" value={portal.metrics.lastVisitAt ? "Recorded" : "None"} />
          <StatCard detail="Consecutive training days" icon={<Flame className="size-5" />} label="Current Streak" value={String(portal.metrics.currentStreak)} />
          <StatCard detail={`${portal.metrics.averageDuration}m average duration`} icon={<QrCode className="size-5" />} label="Monthly Visits" value={String(portal.metrics.monthlyVisits)} />
        </div>
      </AnimatedCardSection>

      <Card variant="glass">
        <CardHeader>
          <h3 className="text-2xl font-black">Attendance Activity</h3>
          <p className="text-sm leading-6 text-muted-foreground">Your gym visits over the past year. Consistent training builds lasting results.</p>
        </CardHeader>
        <CardContent>
          <StreakHeatmap visits={portal.visits} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1fr]">
        <AnimatedCardSection delay={0.1}>
          <Card variant="glass">
            <CardHeader>
              <h3 className="text-2xl font-black">Member QR</h3>
              <p className="text-sm leading-6 text-muted-foreground">This QR rotates automatically for live attendance use. The static QR fallback and regeneration flow remain available below.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <DynamicAttendanceQr
                fallbackExpiresAt={portal.qrToken?.expires_at ?? null}
                fallbackQrSvg={portal.qrSvg}
                memberId={portal.member.id}
              />
              <RegenerateQrForm memberId={portal.member.id} />
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.15}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Visit History</h3></CardHeader>
            <CardContent className="space-y-3">
              <AnimatedListSection>
                {portal.visits.map((visit) => (
                  <AnimatedListItem key={visit.id}>
                    <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-4 text-sm md:grid-cols-[1fr_auto_auto] md:items-center card-hover">
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
                  </AnimatedListItem>
                ))}
              </AnimatedListSection>
              {portal.visits.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No visits recorded yet.</div> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>
      </div>
    </div>
  );
}
