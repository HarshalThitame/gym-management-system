import type { Metadata } from "next";
import { Activity, Brain, CalendarCheck, CalendarDays, CreditCard, Dumbbell, MessageSquare, Target, TrendingUp, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { expireMembershipsFormAction } from "@/features/memberships/actions/membership-actions";
import { getMembershipMetrics } from "@/features/memberships/services/membership-service";
import { getAttendanceDashboard } from "@/features/attendance/services/attendance-service";
import { getClassOperationsDashboard } from "@/features/classes/services/class-service";
import { getCommunicationDashboard } from "@/features/communications/services/communication-service";
import { getFitnessOperationsDashboard } from "@/features/fitness/services/fitness-service";
import { listActiveTrainers } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Admin Dashboard",
  description: "Protected admin dashboard for gym revenue, members, attendance, and leads.",
  path: "/admin"
});

export default async function AdminDashboardPage() {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin");
  const gymId = context.profile?.gym_id ?? null;
  const [metrics, trainers, attendance, classes, fitness, communications] = await Promise.all([
    getMembershipMetrics(gymId),
    listActiveTrainers(gymId),
    getAttendanceDashboard(gymId),
    getClassOperationsDashboard(gymId),
    getFitnessOperationsDashboard(gymId),
    getCommunicationDashboard(gymId)
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={`${metrics.totalMembers} total member records`} icon={<UsersRound className="size-5" />} label="Active Members" value={String(metrics.activeMembers)} />
        <StatCard detail={`${metrics.expiredMembers} expired memberships`} icon={<Activity className="size-5" />} label="Expiring Soon" value={String(metrics.expiringThisWeek)} />
        <StatCard detail={`${metrics.newMembersThisMonth} new member records this month`} icon={<TrendingUp className="size-5" />} label="Renewals This Month" value={String(metrics.renewalsThisMonth)} />
        <StatCard detail={`${attendance.metrics.currentInside} members inside now`} icon={<CalendarCheck className="size-5" />} label="Today Check-ins" value={String(attendance.metrics.todayCheckIns)} />
        <StatCard detail={`${classes.metrics.activeBookings} active class bookings`} icon={<CalendarDays className="size-5" />} label="Class Sessions" value={String(classes.metrics.upcomingSessions)} />
        <StatCard detail={`${fitness.metrics.completedWorkouts30Days} workouts in 30 days`} icon={<Target className="size-5" />} label="Fitness Goals" value={String(fitness.metrics.activeGoals)} />
        <StatCard detail={`${communications.metrics.emailsToday} emails and ${communications.metrics.whatsappToday} WhatsApp queued today`} icon={<MessageSquare className="size-5" />} label="Communications" value={String(communications.metrics.unreadNotifications)} />
        <StatCard detail="Predictive insights and supervised AI operations" icon={<Brain className="size-5" />} label="AI Intelligence" value="Ready" />
        <StatCard detail="Payment records and invoices are tracked" icon={<CreditCard className="size-5" />} label="Revenue" value="Tracked" />
        <StatCard detail="Trainer profiles available for assignments" icon={<Dumbbell className="size-5" />} label="Trainers" value={String(trainers.length)} />
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Membership operations</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/members/new" variant="accent">Add Member</ButtonLink>
          <ButtonLink href="/admin/membership-plans" variant="secondary">Manage Plans</ButtonLink>
          <ButtonLink href="/admin/attendance" variant="secondary">Attendance Desk</ButtonLink>
          <ButtonLink href="/admin/classes" variant="secondary">Manage Classes</ButtonLink>
          <ButtonLink href="/admin/fitness" variant="secondary">Fitness Tracking</ButtonLink>
          <ButtonLink href="/admin/trainers" variant="secondary">Manage Trainers</ButtonLink>
          <ButtonLink href="/admin/communications" variant="secondary">Communication Hub</ButtonLink>
          <ButtonLink href="/admin/ai" variant="secondary">AI Intelligence</ButtonLink>
          <ButtonLink href="/admin/reports" variant="secondary">Analytics Center</ButtonLink>
          <ButtonLink href="/admin/settings" variant="secondary">Enterprise Settings</ButtonLink>
          <ButtonLink href="/admin/staff" variant="secondary">Manage Staff</ButtonLink>
          <form action={expireMembershipsFormAction}>
            <Button type="submit" variant="secondary">Process Expiries</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
