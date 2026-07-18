import type { Metadata } from "next";
import { Activity, Apple, Bell, CalendarCheck, CalendarDays, Droplets, Dumbbell, Flame, MessageSquareText, Trophy, Zap } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getPlanDurationDays } from "@/features/memberships/lib/plan-utils";
import { getMemberDashboardOverview } from "@/features/memberships/services/membership-service";
import { getMemberLoyaltyData } from "@/features/member/services/loyalty-service";
import { getMemberAchievements } from "@/features/member/services/achievement-service";
import { LoyaltyWidget, LeaderboardWidget } from "@/features/member/components/loyalty-widgets";
import { AchievementWall, AchievementStats } from "@/features/member/components/achievement-wall";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { getOrganizationEntitlements } from "@/features/entitlement";
import { WelcomeBanner } from "@/features/member/components/welcome-banner";
import { DashboardSection, DashboardStatRow } from "@/features/member/components/dashboard-sections";
import { createMetadata } from "@/lib/seo/metadata";

const FEATURE_GATED_LINKS: Record<string, { href: string; label: string; variant?: "primary-gradient" | "outline-cinematic" }> = {
  class_booking: { href: "/member/classes", label: "Book Classes" },
  diet_workout_plans: { href: "/member/workouts", label: "View Workouts" },
  goal_tracking: { href: "/member/fitness", label: "Track Fitness" },
  ai_coach: { href: "/member/ai-coach", label: "AI Coach" },
};

const ALWAYS_ON_LINKS = [
  { href: "/member/profile", label: "Complete Profile", variant: "primary-gradient" as const },
  { href: "/member/membership", label: "View Membership" },
  { href: "/member/payments", label: "Payments & Invoices" },
  { href: "/member/attendance", label: "Attendance QR" },
  { href: "/membership-plans", label: "Renew Membership", variant: "primary-gradient" as const },
];

export const metadata: Metadata = createMetadata({
  title: "Member Dashboard",
  description: "Your fitness journey at a glance. Track progress, book classes, and stay on top of your goals.",
  path: "/member"
});

export default async function MemberDashboardPage() {
  const context = await requireMemberPortalAccess("/member");
  const overview = context.userId ? await getMemberDashboardOverview(context.userId) : null;

  const entitlements = context.organizationId
    ? await getOrganizationEntitlements(context.organizationId).catch(() => null)
    : null;
  const activeFeatureKeys = new Set(entitlements?.activeFeatureKeys ?? []);
  const membership = overview?.currentMembership ?? null;
  const plan = overview?.currentPlan ?? null;
  const metrics = overview?.metrics;
  const displayName = context.profile?.full_name || context.email || "Member";
  const remainingDays = membership ? getRemainingDays(membership.end_date) : 0;
  const totalDays = plan ? getPlanDurationDays(plan.plan_type) : 30;

  let loyaltyData = null;
  if (overview?.member?.id && context.organizationId) {
    try {
      loyaltyData = await getMemberLoyaltyData(overview.member.id, context.organizationId);
    } catch {
      loyaltyData = null;
    }
  }

  let achievementsData = null;
  if (overview?.member?.id) {
    try {
      achievementsData = await getMemberAchievements(overview.member.id);
    } catch {
      achievementsData = null;
    }
  }

  return (
    <div className="space-y-6">
      <WelcomeBanner
        displayName={displayName}
        attendanceStreak={metrics?.attendanceStreak ?? 0}
        workoutStreak={metrics?.workoutStreak ?? 0}
        remainingDays={remainingDays}
        totalMembershipDays={totalDays}
        membershipStatus={membership?.status ?? "none"}
        lastVisitAt={metrics?.lastVisitAt ?? null}
      />

      <DashboardSection title="Daily Activity" icon={<Zap className="size-4" />} delay={0.1} variant="glass">
        <DashboardStatRow>
          <StatCard
            detail={metrics?.activeWorkoutPrograms ? "Active program assigned" : "No workout assigned"}
            icon={<Dumbbell className="size-5" />}
            label="Today's Workout"
            value={metrics?.activeWorkoutPrograms ? "Ready" : "None"}
            status={metrics?.activeWorkoutPrograms ? "good" : undefined}
          />
          <StatCard
            detail={overview?.activeNutritionPlan?.name ?? "No nutrition plan"}
            icon={<Apple className="size-5" />}
            label="Calories Today"
            value={String(metrics?.caloriesToday ?? 0)}
            trend="neutral"
          />
          <StatCard
            detail="Water intake logged today"
            icon={<Droplets className="size-5" />}
            label="Water Today"
            value={`${metrics?.waterToday ?? 0} ml`}
            trend="neutral"
          />
          <StatCard
            detail={`${metrics?.completedWorkouts ?? 0} completed workouts`}
            icon={<Flame className="size-5" />}
            label="Workout Streak"
            value={`${metrics?.workoutStreak ?? 0} days`}
            status={(metrics?.workoutStreak ?? 0) >= 7 ? "good" : (metrics?.workoutStreak ?? 0) > 0 ? "watch" : undefined}
            trend={(metrics?.workoutStreak ?? 0) >= 3 ? "up" : undefined}
          />
        </DashboardStatRow>
      </DashboardSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection title="Attendance" icon={<CalendarCheck className="size-4" />} delay={0.15} variant="glass">
          <DashboardStatRow>
            <StatCard
              detail={`${metrics?.attendanceCount ?? 0} total check-ins`}
              icon={<CalendarCheck className="size-5" />}
              label="Attendance Streak"
              value={`${metrics?.attendanceStreak ?? 0} days`}
              status={(metrics?.attendanceStreak ?? 0) >= 7 ? "good" : (metrics?.attendanceStreak ?? 0) > 0 ? "watch" : undefined}
              trend={(metrics?.attendanceStreak ?? 0) >= 5 ? "up" : undefined}
            />
            <StatCard
              detail={metrics?.lastVisitAt ? `Last visit ${new Date(metrics.lastVisitAt).toLocaleDateString("en-IN")}` : "No visits recorded"}
              icon={<CalendarDays className="size-5" />}
              label="Total Visits"
              value={String(metrics?.attendanceCount ?? 0)}
            />
          </DashboardStatRow>
        </DashboardSection>

        <DashboardSection title="Engagement" icon={<Activity className="size-4" />} delay={0.15} variant="glass">
          <DashboardStatRow>
            <StatCard
              detail={`${metrics?.activeWaitlists ?? 0} waitlisted`}
              icon={<CalendarDays className="size-5" />}
              label="Booked Classes"
              value={String(metrics?.bookedClasses ?? 0)}
              status={(metrics?.bookedClasses ?? 0) > 0 ? "good" : undefined}
            />
            <StatCard
              detail={overview?.nextPtSession?.starts_at ? `${overview.nextPtSession.session_date} at ${overview.nextPtSession.starts_at.slice(0, 5)}` : "No upcoming sessions"}
              icon={<Dumbbell className="size-5" />}
              label="PT Sessions"
              value={String(metrics?.upcomingPtSessions ?? 0)}
              status={(metrics?.upcomingPtSessions ?? 0) > 0 ? "good" : undefined}
            />
          </DashboardStatRow>
        </DashboardSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection title="Achievements" icon={<Trophy className="size-4" />} delay={0.2} variant="glow">
          <DashboardStatRow>
            <StatCard
              detail="Milestones and badges"
              icon={<Trophy className="size-5" />}
              label="Achievements"
              value={String(metrics?.milestoneCount ?? 0)}
              status={(metrics?.milestoneCount ?? 0) > 0 ? "good" : undefined}
            />
            <StatCard
              detail={overview?.activeGoal?.title ?? "No active goal"}
              icon={<Activity className="size-5" />}
              label="Active Goal"
              value={overview?.activeGoal ? "In Progress" : "None"}
              status={overview?.activeGoal ? "good" : undefined}
            />
          </DashboardStatRow>
        </DashboardSection>

        <DashboardSection title="Communications" icon={<Bell className="size-4" />} delay={0.2} variant="glow">
          <DashboardStatRow>
            <StatCard
              detail={`${metrics?.totalCommunicationRecords ?? 0} total messages`}
              icon={<MessageSquareText className="size-5" />}
              label="Unread"
              value={String(metrics?.unreadNotifications ?? 0)}
              status={(metrics?.unreadNotifications ?? 0) > 0 ? "watch" : "good"}
            />
            <StatCard
              detail={`${metrics?.priorityNotifications ?? 0} high priority`}
              icon={<Bell className="size-5" />}
              label="Alerts"
              value={String(metrics?.priorityNotifications ?? 0)}
              status={(metrics?.priorityNotifications ?? 0) > 0 ? "risk" : "good"}
            />
          </DashboardStatRow>
        </DashboardSection>
      </div>

      {achievementsData && achievementsData.achievements.length > 0 && (
        <>
          <DashboardSection title="Achievements" icon={<Trophy className="size-4" />} delay={0.2} variant="glow">
            <AchievementWall achievements={achievementsData.achievements} />
          </DashboardSection>
          <AchievementStats
            totalAchievements={achievementsData.totalAchievements}
            latestAchievement={achievementsData.latestAchievement}
            streakCount={achievementsData.streakMilestoneCount}
            workoutCount={achievementsData.workoutMilestoneCount}
          />
        </>
      )}

      {loyaltyData && loyaltyData.config?.is_active && (
        <div className="grid gap-6 xl:grid-cols-2">
          <LoyaltyWidget balance={loyaltyData.balance} config={loyaltyData.config} />
          <LeaderboardWidget leaderboard={loyaltyData.leaderboard} currentMemberId={overview?.member?.id} />
        </div>
      )}

      <DashboardSection title="Quick Actions" delay={0.25} variant="glass">
        <div className="flex flex-wrap gap-3">
          {ALWAYS_ON_LINKS.map((link) => (
            <ButtonLink key={link.href} href={link.href} size="lg" variant={link.variant ?? "outline-cinematic"}>{link.label}</ButtonLink>
          ))}
          {Object.entries(FEATURE_GATED_LINKS).map(([featureKey, link]) =>
            activeFeatureKeys.has(featureKey) ? (
              <ButtonLink key={link.href} href={link.href} size="lg" variant={link.variant ?? "outline-cinematic"}>{link.label}</ButtonLink>
            ) : null
          )}
        </div>
      </DashboardSection>
    </div>
  );
}
