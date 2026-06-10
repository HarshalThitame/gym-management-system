import type { Metadata } from "next";
import { Activity, Bell, CalendarCheck, CalendarDays, CreditCard, Flame } from "lucide-react";
import { MobileReadinessPanel } from "@/components/pwa/mobile-readiness-panel";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { getMemberAttendancePortal } from "@/features/attendance/services/attendance-service";
import { getMemberClassesPortal } from "@/features/classes/services/class-service";
import { getMemberNotificationCenter } from "@/features/communications/services/communication-service";
import { getMemberFitnessPortal } from "@/features/fitness/services/fitness-service";
import { MembershipStatusBadge } from "@/features/memberships/components/membership-status-badge";
import { formatMoney, getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Dashboard",
  description: "Apex member dashboard for membership status, attendance, and upcoming classes.",
  path: "/member"
});

export default async function MemberDashboardPage() {
  const context = await requireRole(["member", "super_admin"], "/member");
  const [profile, attendance, classes, fitness, notifications] = context.userId
    ? await Promise.all([getMemberDashboard(context.userId), getMemberAttendancePortal(context.userId), getMemberClassesPortal(context.userId), getMemberFitnessPortal(context.userId), getMemberNotificationCenter(context.userId)])
    : [null, null, null, null, null];
  const membership = profile?.currentMembership ?? null;
  const plan = profile?.currentPlan ?? null;

  return (
    <div className="space-y-8">
      <MobileReadinessPanel />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard detail={plan?.name ?? "No membership assigned"} icon={<CreditCard className="size-5" />} label="Membership" value={membership?.status ?? "None"} />
        <StatCard detail={attendance?.metrics.lastVisitAt ? `Last visit ${new Date(attendance.metrics.lastVisitAt).toLocaleDateString("en-IN")}` : "No visit recorded"} icon={<Flame className="size-5" />} label="Attendance" value={`${attendance?.metrics.attendanceCount ?? 0} visits`} />
        <StatCard detail={`${classes?.waitlists.filter((row) => row.status === "waiting").length ?? 0} active waitlists`} icon={<CalendarCheck className="size-5" />} label="Classes" value={`${classes?.bookings.filter((row) => row.status === "booked").length ?? 0} booked`} />
        <StatCard detail={fitness?.activeGoal?.title ?? "No active goal"} icon={<Activity className="size-5" />} label="Fitness" value={`${fitness?.metrics.completedWorkouts ?? 0} workouts`} />
        <StatCard detail={`${notifications?.metrics.priority ?? 0} priority alerts`} icon={<Bell className="size-5" />} label="Notifications" value={String(notifications?.metrics.unread ?? 0)} />
        <StatCard detail={membership?.end_date ?? "No expiry date"} icon={<CalendarDays className="size-5" />} label="Remaining Days" value={membership ? String(getRemainingDays(membership.end_date)) : "0"} />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black">Membership Status</h2>
            <MembershipStatusBadge status={membership?.status ?? "none"} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">Your current plan, expiry, and renewal path are shown from the protected membership records connected to your account.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {membership && plan ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-border bg-surface-muted p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Plan</p>
                <p className="mt-2 font-black">{plan.name}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Expiry</p>
                <p className="mt-2 font-black">{membership.end_date}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Amount</p>
                <p className="mt-2 font-black">{formatMoney(membership.total_amount)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member membership record is connected to this login yet.</div>
          )}
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/member/profile" variant="primary">Complete Profile</ButtonLink>
            <ButtonLink href="/member/membership" variant="secondary">View Membership</ButtonLink>
            <ButtonLink href="/member/payments" variant="secondary">Payments and Invoices</ButtonLink>
            <ButtonLink href="/member/attendance" variant="secondary">Attendance QR</ButtonLink>
            <ButtonLink href="/member/classes" variant="secondary">Book Classes</ButtonLink>
            <ButtonLink href="/member/workouts" variant="secondary">View Workouts</ButtonLink>
            <ButtonLink href="/member/fitness" variant="secondary">Track Fitness</ButtonLink>
            <ButtonLink href="/member/notifications" variant="secondary">Notification Center</ButtonLink>
            <ButtonLink href="/membership-plans" variant="accent">Renew Membership</ButtonLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
