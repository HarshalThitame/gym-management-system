import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useOffline } from "@/hooks/use-offline";
import { Text } from "@/components/ui/Text";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { MembershipCard } from "@/components/member/MembershipCard";
import { AttendanceStreak } from "@/components/member/AttendanceStreak";
import { WorkoutSummaryCard } from "@/components/member/WorkoutSummaryCard";
import { NutritionSummaryCard } from "@/components/member/NutritionSummaryCard";
import { UpcomingSessionCard } from "@/components/member/UpcomingSessionCard";
import { getSupabaseClient } from "@/api/supabase";
import { memberDashboardService } from "@/services/member-dashboard-service";
import { membershipService } from "@/services/membership-service";
import { attendanceService } from "@/services/attendance-service";
import { workoutService } from "@/services/workout-service";
import { dietService } from "@/services/diet-service";
import { memberTrainerService } from "@/services/trainer-service";
import { memberNotificationService } from "@/services/notification-service";
import { memberService } from "@/services/member-service";
import {
  Bell, Gift, Zap, CircleDollarSign, Users,
  ChevronRight, Wifi, WifiOff, TrendingUp, UserRound,
} from "lucide-react-native";
import type { Membership, MembershipPlan, TrainerSession, Trainer } from "@/types";

export default function MemberDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile, organizationId } = useAuth();
  const { isOnline } = useOffline();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("");

  const [membership, setMembership] = useState<Membership | null>(null);
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);

  const [attendance, setAttendance] = useState({ checkedIn: false, checkedOut: false, streak: 0, monthlyPercent: 0, totalThisMonth: 0 });
  const [workouts, setWorkouts] = useState({ activePrograms: 0, completedToday: 0, streak: 0 });
  const [nutrition, setNutrition] = useState({ hasPlan: false, waterMl: 0, calories: 0 });
  const [upcomingSessions, setUpcomingSessions] = useState<TrainerSession[]>([]);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.userId || !profile) return;

    try {
      const supabase = getSupabaseClient();
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.userId)
        .maybeSingle();
      const mid = memberData?.id ?? null;
      setMemberId(mid);

      if (mid) {
        const dashboard = await memberDashboardService.getFullDashboard(user.userId, mid);
        supabase.removeChannel(supabase.channel("_unused_"));

        setMembership(dashboard.membership.membership);
        setPlan(dashboard.membership.plan);
        if (dashboard.membership.membership?.end_date) {
          setDaysRemaining(await membershipService.getRemainingDays(dashboard.membership.membership.end_date));
        }

        setAttendance({
          checkedIn: dashboard.attendance.checkedIn,
          checkedOut: dashboard.attendance.checkedOut,
          streak: dashboard.attendance.streak,
          monthlyPercent: dashboard.attendance.monthlyPercent,
          totalThisMonth: dashboard.attendance.presentDays,
        });

        setWorkouts({
          activePrograms: dashboard.workouts.activePrograms,
          completedToday: 0,
          streak: dashboard.workouts.streak,
        });

        setNutrition({
          hasPlan: dashboard.nutrition.hasPlan,
          waterMl: dashboard.nutrition.waterMl,
          calories: dashboard.nutrition.calories,
        });

        setUpcomingSessions(dashboard.upcomingSessions);
        setTrainer(dashboard.trainer);
        setUnreadCount(dashboard.unreadCount);
      }
    } catch {
      // Silently fail - data will be empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.userId, profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "Member";

  if (loading) {
    return <LoadingState fullScreen message="Loading your dashboard..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <View style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
        }}>
          <View style={{ flex: 1 }}>
            <Text variant="overline" muted>Member Portal</Text>
            <Text variant="h2">{greeting}, {firstName}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            {!isOnline && <WifiOff size={20} color={theme.colors.warning} />}
            <TouchableOpacity onPress={() => router.push("/member/notifications")}>
              <View>
                <Bell size={22} color={theme.colors.fg} />
                {unreadCount > 0 && (
                  <View style={{
                    position: "absolute", top: -4, right: -4,
                    width: 16, height: 16, borderRadius: 8,
                    backgroundColor: theme.colors.danger,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 120,
          gap: theme.spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      >
        <MembershipCard membership={membership} plan={plan} daysRemaining={daysRemaining} />

        <AttendanceStreak
          currentStreak={attendance.streak}
          todayCheckedIn={attendance.checkedIn}
          monthlyPercent={attendance.monthlyPercent}
          totalThisMonth={attendance.totalThisMonth}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/member/attendance/qr")}
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.xl,
            padding: theme.spacing.xl,
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          <Zap size={32} color={theme.colors.primaryFg} />
          <Text variant="h4" color={theme.colors.primaryFg}>Quick Check-In</Text>
          <Text variant="body" color={theme.colors.primaryFg} style={{ opacity: 0.8 }}>
            {attendance.checkedIn ? "You're checked in. Tap to view." : "Tap to scan QR at entrance"}
          </Text>
        </TouchableOpacity>

        <WorkoutSummaryCard
          activePrograms={workouts.activePrograms}
          completedToday={workouts.completedToday}
          streak={workouts.streak}
          onPress={() => router.push("/member/workouts")}
        />

        <NutritionSummaryCard
          hasActivePlan={nutrition.hasPlan}
          waterMl={nutrition.waterMl}
          caloriesToday={nutrition.calories}
          onPress={() => router.push("/member/diet")}
        />

        {upcomingSessions.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="h4">Upcoming Sessions</Text>
              <TouchableOpacity onPress={() => router.push("/member/trainer")}>
                <Text variant="caption" color={theme.colors.primary}>See All</Text>
              </TouchableOpacity>
            </View>
            {upcomingSessions.slice(0, 3).map((session) => (
              <UpcomingSessionCard key={session.id} session={session} trainer={trainer} />
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <QuickActionCard
            icon={<CircleDollarSign size={22} color={theme.colors.primary} />}
            label="Payments"
            onPress={() => router.push("/member/billing")}
          />
          <QuickActionCard
            icon={<Gift size={22} color={theme.colors.primary} />}
            label="Referrals"
            onPress={() => router.push("/member/referrals")}
          />
          <QuickActionCard
            icon={<TrendingUp size={22} color={theme.colors.primary} />}
            label="Progress"
            onPress={() => router.push("/member/progress")}
          />
          <QuickActionCard
            icon={<UserRound size={22} color={theme.colors.primary} />}
            label="Trainer"
            onPress={() => router.push("/member/trainer")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickActionCard({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1, minWidth: "45%",
        backgroundColor: theme.colors.bgSurface,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        borderWidth: 1, borderColor: theme.colors.border,
        alignItems: "center", gap: theme.spacing.sm,
      }}
    >
      {icon}
      <Text variant="caption" bold>{label}</Text>
    </TouchableOpacity>
  );
}


