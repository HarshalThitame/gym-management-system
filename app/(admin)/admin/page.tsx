import type { Metadata } from "next";
import { Activity, Brain, CalendarCheck, CalendarDays, CreditCard, Dumbbell, MessageSquare, ReceiptText, Target, TrendingUp, UsersRound, WalletCards } from "lucide-react";
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
import { formatCurrency } from "@/features/billing/lib/money";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PaymentRow = Pick<Database["public"]["Tables"]["payments"]["Row"], "amount" | "payment_type" | "paid_at" | "collected_at" | "created_at">;

export const metadata: Metadata = createMetadata({
  title: "Admin Dashboard",
  description: "Protected admin dashboard for gym revenue, members, attendance, and leads.",
  path: "/admin"
});

export default async function AdminDashboardPage() {
  const scope = await requireGymAdminScope("/admin");
  const gymId = scope.gymId;
  const [metrics, trainers, attendance, classes, fitness, communications, revenue] = await Promise.all([
    getMembershipMetrics(gymId),
    listActiveTrainers(gymId),
    getAttendanceDashboard(gymId),
    getClassOperationsDashboard(gymId),
    getFitnessOperationsDashboard(gymId),
    getCommunicationDashboard(gymId),
    getGymRevenueMetrics(gymId)
  ]);
  const trainerUtilization = trainers.length > 0 ? Math.min(Math.round((revenue.activeTrainerAssignments / trainers.length) * 100), 100) : 0;
  const recentActivities = attendance.recentSessions.length + classes.sessions.length + revenue.recentPayments;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={`${attendance.metrics.currentInside} members inside now`} icon={<CalendarCheck className="size-5" />} label="Today's Attendance" value={String(attendance.metrics.todayCheckIns)} />
        <StatCard detail={`${metrics.activeMembers} active memberships`} icon={<UsersRound className="size-5" />} label="Current Members" value={String(metrics.totalMembers)} />
        <StatCard detail={`${metrics.expiringThisWeek} expiring this week`} icon={<Activity className="size-5" />} label="Active Memberships" value={String(metrics.activeMembers)} />
        <StatCard detail={`${metrics.expiringToday} renewals due today`} icon={<Activity className="size-5" />} label="Expired Memberships" value={String(metrics.expiredMembers)} />
        <StatCard detail="Paid payments recorded today" icon={<CreditCard className="size-5" />} label="Revenue Today" value={formatCurrency(revenue.todayRevenue)} />
        <StatCard detail="Paid payments recorded this month" icon={<WalletCards className="size-5" />} label="Revenue This Month" value={formatCurrency(revenue.monthRevenue)} />
        <StatCard detail="Personal training paid revenue this month" icon={<Dumbbell className="size-5" />} label="PT Revenue" value={formatCurrency(revenue.ptRevenue)} />
        <StatCard detail={`${revenue.activeTrainerAssignments} active trainer-member links`} icon={<Dumbbell className="size-5" />} label="Trainer Utilization" value={`${trainerUtilization}%`} />
        <StatCard detail="Pending, processing, and failed payment rows" icon={<ReceiptText className="size-5" />} label="Pending Payments" value={String(revenue.pendingPayments)} />
        <StatCard detail={`${classes.metrics.activeBookings} active class bookings`} icon={<CalendarDays className="size-5" />} label="Class Sessions" value={String(classes.metrics.upcomingSessions)} />
        <StatCard detail={`${fitness.metrics.completedWorkouts30Days} workouts in 30 days`} icon={<Target className="size-5" />} label="Fitness Goals" value={String(fitness.metrics.activeGoals)} />
        <StatCard detail={`${recentActivities} recent attendance, class, and payment signals`} icon={<TrendingUp className="size-5" />} label="Recent Activities" value={String(recentActivities)} />
        <StatCard detail={`${metrics.newMembersThisMonth} new members this month`} icon={<TrendingUp className="size-5" />} label="Growth Metrics" value={String(metrics.renewalsThisMonth)} />
        <StatCard detail={`${communications.metrics.emailsToday} emails and ${communications.metrics.whatsappToday} WhatsApp queued today`} icon={<MessageSquare className="size-5" />} label="Communications" value={String(communications.metrics.unreadNotifications)} />
        <StatCard detail="Predictive insights and supervised AI operations" icon={<Brain className="size-5" />} label="AI Intelligence" value="Ready" />
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
          <ButtonLink href="/admin/settings" variant="secondary">Branch Settings</ButtonLink>
          <ButtonLink href="/admin/staff" variant="secondary">Manage Staff</ButtonLink>
          <form action={expireMembershipsFormAction}>
            <Button type="submit" variant="secondary">Process Expiries</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function getGymRevenueMetrics(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let paymentsQuery = supabase
    .from("payments")
    .select("amount,payment_type,paid_at,collected_at,created_at")
    .eq("status", "paid")
    .gte("created_at", monthStart.toISOString());
  let pendingQuery = supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "processing", "failed"]);
  let assignmentQuery = supabase
    .from("trainer_assignments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  let recentPaymentsQuery = supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStart.toISOString());

  if (gymId) {
    paymentsQuery = paymentsQuery.eq("gym_id", gymId);
    pendingQuery = pendingQuery.eq("gym_id", gymId);
    assignmentQuery = assignmentQuery.eq("gym_id", gymId);
    recentPaymentsQuery = recentPaymentsQuery.eq("gym_id", gymId);
  }

  const [paymentsResult, pendingResult, assignmentResult, recentPaymentsResult] = await Promise.all([
    paymentsQuery,
    pendingQuery,
    assignmentQuery,
    recentPaymentsQuery
  ]);
  const firstError = [paymentsResult, pendingResult, assignmentResult, recentPaymentsResult].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const paidOnOrAfter = (payment: PaymentRow, date: Date) => new Date(payment.paid_at ?? payment.collected_at ?? payment.created_at) >= date;

  return {
    todayRevenue: payments.filter((payment) => paidOnOrAfter(payment, todayStart)).reduce((total, payment) => total + payment.amount, 0),
    monthRevenue: payments.reduce((total, payment) => total + payment.amount, 0),
    ptRevenue: payments.filter((payment) => payment.payment_type === "personal_training").reduce((total, payment) => total + payment.amount, 0),
    pendingPayments: pendingResult.count ?? 0,
    activeTrainerAssignments: assignmentResult.count ?? 0,
    recentPayments: recentPaymentsResult.count ?? 0
  };
}
