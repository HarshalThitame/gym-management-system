import type { Metadata } from "next";
import { Activity, Brain, CalendarCheck, CalendarDays, CreditCard, Dumbbell, MessageSquare, ReceiptText, Target, TrendingUp, UsersRound, WalletCards, Zap, Bell, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
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
  const capacityPercentage = attendance.metrics.capacityPercentage;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good Morning" : now.getHours() < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-8">
      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-purple-600/10 to-pink-500/10 p-8 md:p-12 glass border border-accent/20 shadow-premium-lg">
        <div className="absolute inset-0 bg-gradient-mesh-animated opacity-50" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-accent to-purple-600 shadow-glow animate-pulse-glow">
                  <Zap className="size-6 text-white" />
                </div>
                <Badge variant="cinematic" className="text-sm px-4 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    System Online
                  </span>
                </Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-black gradient-text mb-3">
                {greeting}, Admin
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Here&apos;s what&apos;s happening at your gym today. Track performance, manage operations, and make data-driven decisions.
              </p>
            </div>
            
            {/* Live Occupancy Indicator */}
            <div className="flex-shrink-0 animate-fade-in-right">
              <div className="relative w-48 h-48">
                <svg className="transform -rotate-90 w-48 h-48">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - capacityPercentage / 100)}`}
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-black gradient-text">{attendance.metrics.currentInside}</div>
                  <div className="text-sm font-bold text-muted-foreground">Active Now</div>
                  <div className="text-xs text-muted-foreground mt-1">{capacityPercentage}% capacity</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="glass rounded-xl p-4 border border-accent/20 hover:scale-105 transition-all duration-300 hover:shadow-glow">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <UsersRound className="size-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-black">{metrics.activeMembers}</div>
                  <div className="text-xs text-muted-foreground">Active Members</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 border border-accent/20 hover:scale-105 transition-all duration-300 hover:shadow-glow">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CreditCard className="size-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-black">{formatCurrency(revenue.todayRevenue)}</div>
                  <div className="text-xs text-muted-foreground">Today&apos;s Revenue</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 border border-accent/20 hover:scale-105 transition-all duration-300 hover:shadow-glow">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CalendarDays className="size-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-black">{classes.metrics.upcomingSessions}</div>
                  <div className="text-xs text-muted-foreground">Upcoming Classes</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 border border-accent/20 hover:scale-105 transition-all duration-300 hover:shadow-glow">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Bell className="size-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-black">{communications.metrics.unreadNotifications}</div>
                  <div className="text-xs text-muted-foreground">Notifications</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={`${attendance.metrics.currentInside} members inside now`} icon={<CalendarCheck className="size-5" />} label="Today's Attendance" value={String(attendance.metrics.todayCheckIns)} status="good" trend="up" />
        <StatCard detail={`${metrics.activeMembers} active memberships`} icon={<UsersRound className="size-5" />} label="Current Members" value={String(metrics.totalMembers)} status="good" />
        <StatCard detail={`${metrics.expiringThisWeek} expiring this week`} icon={<Activity className="size-5" />} label="Active Memberships" value={String(metrics.activeMembers)} status="watch" />
        <StatCard detail={`${metrics.expiringToday} renewals due today`} icon={<Activity className="size-5" />} label="Expired Memberships" value={String(metrics.expiredMembers)} status={metrics.expiredMembers > 0 ? "risk" : "good"} />
        <StatCard detail="Paid payments recorded today" icon={<CreditCard className="size-5" />} label="Revenue Today" value={formatCurrency(revenue.todayRevenue)} status="good" trend="up" />
        <StatCard detail="Paid payments recorded this month" icon={<WalletCards className="size-5" />} label="Revenue This Month" value={formatCurrency(revenue.monthRevenue)} status="good" />
        <StatCard detail="Personal training paid revenue this month" icon={<Dumbbell className="size-5" />} label="PT Revenue" value={formatCurrency(revenue.ptRevenue)} status="good" />
        <StatCard detail={`${revenue.activeTrainerAssignments} active trainer-member links`} icon={<Dumbbell className="size-5" />} label="Trainer Utilization" value={`${trainerUtilization}%`} status={trainerUtilization > 70 ? "good" : "watch"} />
        <StatCard detail="Pending, processing, and failed payment rows" icon={<ReceiptText className="size-5" />} label="Pending Payments" value={String(revenue.pendingPayments)} status={revenue.pendingPayments > 10 ? "watch" : "good"} />
        <StatCard detail={`${classes.metrics.activeBookings} active class bookings`} icon={<CalendarDays className="size-5" />} label="Class Sessions" value={String(classes.metrics.upcomingSessions)} status="good" />
        <StatCard detail={`${fitness.metrics.completedWorkouts30Days} workouts in 30 days`} icon={<Target className="size-5" />} label="Fitness Goals" value={String(fitness.metrics.activeGoals)} status="good" />
        <StatCard detail={`${recentActivities} recent attendance, class, and payment signals`} icon={<TrendingUp className="size-5" />} label="Recent Activities" value={String(recentActivities)} status="good" />
        <StatCard detail={`${metrics.newMembersThisMonth} new members this month`} icon={<TrendingUp className="size-5" />} label="Growth Metrics" value={String(metrics.renewalsThisMonth)} status="good" trend="up" />
        <StatCard detail={`${communications.metrics.emailsToday} emails and ${communications.metrics.whatsappToday} WhatsApp queued today`} icon={<MessageSquare className="size-5" />} label="Communications" value={String(communications.metrics.unreadNotifications)} status={communications.metrics.unreadNotifications > 20 ? "watch" : "good"} />
        <StatCard detail="Predictive insights and supervised AI operations" icon={<Brain className="size-5" />} label="AI Intelligence" value="Ready" status="good" />
        <StatCard detail="Trainer profiles available for assignments" icon={<Dumbbell className="size-5" />} label="Trainers" value={String(trainers.length)} status="good" />
      </div>

      {/* Quick Actions */}
      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-purple-600 shadow-glow-sm">
              <Zap className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black gradient-text">Quick Actions</h2>
              <p className="text-sm text-muted-foreground">Common operations and shortcuts</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <ButtonLink href="/admin/members/new" variant="accent" className="hover:scale-105 transition-all">
            <UsersRound className="size-4" />
            Add Member
          </ButtonLink>
          <ButtonLink href="/admin/membership-plans" variant="secondary" className="hover:scale-105 transition-all">
            <CreditCard className="size-4" />
            Manage Plans
          </ButtonLink>
          <ButtonLink href="/admin/attendance" variant="secondary" className="hover:scale-105 transition-all">
            <CalendarCheck className="size-4" />
            Attendance
          </ButtonLink>
          <ButtonLink href="/admin/classes" variant="secondary" className="hover:scale-105 transition-all">
            <CalendarDays className="size-4" />
            Classes
          </ButtonLink>
          <ButtonLink href="/admin/fitness" variant="secondary" className="hover:scale-105 transition-all">
            <Target className="size-4" />
            Fitness
          </ButtonLink>
          <ButtonLink href="/admin/trainers" variant="secondary" className="hover:scale-105 transition-all">
            <Dumbbell className="size-4" />
            Trainers
          </ButtonLink>
          <ButtonLink href="/admin/communications" variant="secondary" className="hover:scale-105 transition-all">
            <MessageSquare className="size-4" />
            Messages
          </ButtonLink>
          <ButtonLink href="/admin/ai" variant="secondary" className="hover:scale-105 transition-all">
            <Brain className="size-4" />
            AI Insights
          </ButtonLink>
          <ButtonLink href="/admin/reports" variant="secondary" className="hover:scale-105 transition-all">
            <TrendingUp className="size-4" />
            Analytics
          </ButtonLink>
          <ButtonLink href="/admin/settings" variant="secondary" className="hover:scale-105 transition-all">
            <Activity className="size-4" />
            Settings
          </ButtonLink>
          <ButtonLink href="/admin/staff" variant="secondary" className="hover:scale-105 transition-all">
            <UsersRound className="size-4" />
            Staff
          </ButtonLink>
          <form action={expireMembershipsFormAction} className="contents">
            <Button type="submit" variant="secondary" className="hover:scale-105 transition-all">
              <Clock className="size-4" />
              Process Expiries
            </Button>
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
