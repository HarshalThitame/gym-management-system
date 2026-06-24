import type { Metadata } from "next";
import { Activity, Apple, Bell, CalendarCheck, CalendarDays, CreditCard, Droplets, Dumbbell, Flame, Megaphone, MessageSquareText, Trophy } from "lucide-react";
import { MobileReadinessPanel } from "@/components/pwa/mobile-readiness-panel";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { MembershipStatusBadge } from "@/features/memberships/components/membership-status-badge";
import type { MembershipStatus } from "@/types/membership";
import { formatMoney, getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getMemberDashboardOverview } from "@/features/memberships/services/membership-service";
import { requirePrimaryRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Dashboard",
  description: "Apex member dashboard for membership status, attendance, and upcoming classes.",
  path: "/member"
});

export default async function MemberDashboardPage() {
  const context = await requirePrimaryRole(["member"], "/member");
  const overview = context.userId ? await getMemberDashboardOverview(context.userId) : null;
  const membership = overview?.currentMembership ?? null;
  const plan = overview?.currentPlan ?? null;
  const metrics = overview?.metrics;

  return (
    <div className="space-y-8">
      <MobileReadinessPanel />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={metrics?.activeWorkoutPrograms ? "Active program assigned" : "No workout assigned"} icon={<Dumbbell className="size-5" />} label="Today's Workout" value={metrics?.activeWorkoutPrograms ? "Ready" : "None"} />
        <StatCard detail={overview?.activeNutritionPlan?.name ?? "No nutrition plan assigned"} icon={<Apple className="size-5" />} label="Today's Nutrition" value={String(metrics?.caloriesToday ?? 0)} />
        <StatCard detail="Water intake logged today" icon={<Droplets className="size-5" />} label="Water Goal" value={`${metrics?.waterToday ?? 0} ml`} />
        <StatCard detail={`${metrics?.completedWorkouts ?? 0} completed workouts`} icon={<Flame className="size-5" />} label="Workout Streak" value={`${metrics?.workoutStreak ?? 0} days`} />
        <StatCard detail={metrics?.lastVisitAt ? `Last visit ${new Date(metrics.lastVisitAt).toLocaleDateString("en-IN")}` : "No visit recorded"} icon={<CalendarCheck className="size-5" />} label="Attendance Streak" value={`${metrics?.attendanceStreak ?? 0} days`} />
        <StatCard detail={`${metrics?.activeWaitlists ?? 0} active waitlists`} icon={<CalendarDays className="size-5" />} label="Upcoming Classes" value={`${metrics?.bookedClasses ?? 0} booked`} />
        <StatCard detail={overview?.nextPtSession ? `${overview.nextPtSession.session_date} at ${overview.nextPtSession.starts_at.slice(0, 5)}` : "No upcoming PT session"} icon={<Dumbbell className="size-5" />} label="Upcoming PT Sessions" value={String(metrics?.upcomingPtSessions ?? 0)} />
        <StatCard detail={plan?.name ?? "No membership assigned"} icon={<CreditCard className="size-5" />} label="Membership Status" value={membership?.status ?? "None"} />
        <StatCard detail={membership?.end_date ?? "No expiry date"} icon={<CalendarDays className="size-5" />} label="Membership Expiry" value={membership ? String(getRemainingDays(membership.end_date)) : "0"} />
        <StatCard detail={overview?.activeGoal?.title ?? "No active goal"} icon={<Activity className="size-5" />} label="Progress Summary" value={overview?.activeGoal ? `${metrics?.completedWorkouts ?? 0} workouts` : "No goal"} />
        <StatCard detail="Milestones and badges unlocked" icon={<Trophy className="size-5" />} label="Achievements" value={String(metrics?.milestoneCount ?? 0)} />
        <StatCard detail={`${metrics?.totalCommunicationRecords ?? 0} communication records`} icon={<MessageSquareText className="size-5" />} label="Trainer Messages" value={String(metrics?.unreadNotifications ?? 0)} />
        <StatCard detail="Visible gym notices" icon={<Megaphone className="size-5" />} label="Announcements" value={String(metrics?.announcements ?? 0)} />
        <StatCard detail={`${metrics?.priorityNotifications ?? 0} priority alerts`} icon={<Bell className="size-5" />} label="Notifications" value={String(metrics?.unreadNotifications ?? 0)} />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black">Membership Status</h2>
            <MembershipStatusBadge status={(membership?.status ?? "none") as MembershipStatus | "none"} />
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
                <p className="mt-2 font-black">{formatMoney(membership.total_amount ?? 0)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member membership record is connected to this login yet.</div>
          )}
          <div>
            <h3 className="text-lg font-black">Quick Actions</h3>
            <div className="mt-3 flex flex-wrap gap-3">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
