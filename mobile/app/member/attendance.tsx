import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useHaptics } from "@/hooks/use-haptics";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { AttendanceStreak } from "@/components/member/AttendanceStreak";
import { attendanceService } from "@/services/attendance-service";
import { attendanceGamification, type AttendanceBadge } from "@/services/attendance-gamification";
import { attendanceAnalytics } from "@/services/attendance-analytics";
import { getMemberId } from "@/lib/member-utils";
import {
  QrCode, Camera, History, Clock, CheckCircle2,
  Trophy, TrendingUp, Star, Zap, Award, BarChart3,
} from "lucide-react-native";
import type { AttendanceSession } from "@/types";

export default function AttendanceTabScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { success: hapticSuccess } = useHaptics();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStatus, setTodayStatus] = useState({ checkedIn: false, checkedOut: false, session: null as AttendanceSession | null });
  const [streak, setStreak] = useState(0);
  const [monthlyPercent, setMonthlyPercent] = useState(0);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [badges, setBadges] = useState<AttendanceBadge[]>([]);
  const [analytics, setAnalytics] = useState({ totalVisits: 0, monthlyAverage: 0, longestStreak: 0, preferredTime: "Morning", daysSinceLastVisit: 0 });
  const [showCheckOut, setShowCheckOut] = useState(false);

  const loadAttendance = useCallback(async () => {
    try {
      if (!profile?.id) return;
      const mid = await getMemberId(profile.id);
      if (!mid) return;

      setMemberId(mid);
      const [today, history, monthly, memberAnalytics, memberBadges] = await Promise.all([
        attendanceService.getTodayStatus(mid),
        attendanceService.getHistory(mid, 10),
        attendanceService.getMonthlyStats(mid, new Date().getFullYear(), new Date().getMonth() + 1),
        attendanceAnalytics.getMemberAnalytics(mid),
        attendanceGamification.getMemberBadges(mid),
      ]);

      setTodayStatus(today);
      setRecentSessions(history);
      setStreak(attendanceService.calculateStreak(history));
      setMonthlyPercent(monthly.attendancePercent);
      setTotalThisMonth(monthly.presentDays);
      setBadges(memberBadges.filter((b) => b.earned).slice(0, 4));
      setAnalytics({
        totalVisits: memberAnalytics.totalVisits,
        monthlyAverage: memberAnalytics.monthlyAverage,
        longestStreak: memberAnalytics.longestStreak,
        preferredTime: memberAnalytics.preferredTime,
        daysSinceLastVisit: memberAnalytics.daysSinceLastVisit,
      });
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [profile?.id]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const handleCheckIn = async () => {
    if (todayStatus.checkedIn) {
      if (memberId && todayStatus.session && !todayStatus.checkedOut) {
        setShowCheckOut(true);
        await attendanceService.checkOut(memberId, todayStatus.session.id);
        hapticSuccess();
        loadAttendance();
        setShowCheckOut(false);
      }
    } else {
      router.push("/member/attendance/qr");
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const earnedBadgeCount = badges.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Attendance</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAttendance(); }} tintColor={theme.colors.primary} />}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleCheckIn} disabled={showCheckOut}
          style={{
            backgroundColor: todayStatus.checkedIn ? theme.colors.successMuted : theme.colors.primary,
            borderRadius: theme.radii.xl, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.md,
          }}>
          {todayStatus.checkedIn ? (
            <CheckCircle2 size={48} color={theme.colors.success} />
          ) : (
            <QrCode size={48} color={theme.colors.primaryFg} />
          )}
          <Text variant="h3" color={todayStatus.checkedIn ? theme.colors.success : theme.colors.primaryFg}>
            {todayStatus.checkedIn ? "Checked In" : "Check In Now"}
          </Text>
          <Text variant="body" color={todayStatus.checkedIn ? theme.colors.success : theme.colors.primaryFg} style={{ opacity: 0.8 }}>
            {todayStatus.checkedIn
              ? todayStatus.checkedOut ? "Session completed" : "Tap to check out"
              : "Show QR at gym entrance"}
          </Text>
        </TouchableOpacity>

        <AttendanceStreak currentStreak={streak} todayCheckedIn={todayStatus.checkedIn}
          monthlyPercent={monthlyPercent} totalThisMonth={totalThisMonth} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "30%" }}>
            <Card variant="muted" padded>
              <Text variant="stat" color={theme.colors.primary}>{analytics.totalVisits}</Text>
              <Text variant="caption" muted>Total Visits</Text>
            </Card>
          </View>
          <View style={{ width: "30%" }}>
            <Card variant="muted" padded>
              <Text variant="stat" color={theme.colors.primary}>{analytics.monthlyAverage}</Text>
              <Text variant="caption" muted>/Month</Text>
            </Card>
          </View>
          <View style={{ width: "30%" }}>
            <Card variant="muted" padded>
              <Text variant="stat" color={theme.colors.primary}>{analytics.longestStreak}</Text>
              <Text variant="caption" muted>Best Streak</Text>
            </Card>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.push("/member/attendance/qr")}>
            <QrCode size={18} /> My QR
          </Button>
          <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.push("/member/attendance/history")}>
            <History size={18} /> History
          </Button>
        </View>

        {earnedBadgeCount > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Trophy size={18} color={theme.colors.warning} />
              <Text variant="h4">Badges ({earnedBadgeCount})</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {badges.map((badge) => (
                <View key={badge.id} style={{
                  paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
                  backgroundColor: theme.colors.warningMuted, borderRadius: theme.radii.full,
                  flexDirection: "row", alignItems: "center", gap: theme.spacing.xs,
                }}>
                  <Award size={14} color={theme.colors.warning} />
                  <Text variant="caption" color={theme.colors.warning} bold>{badge.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="h4">Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push("/member/attendance/history")}>
              <Text variant="caption" color={theme.colors.primary}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentSessions.slice(0, 5).map((session) => (
            <Card key={session.id} variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <Clock size={16} color={theme.colors.fgMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall">
                    {new Date(session.check_in_at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {new Date(session.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    {session.check_out_at && ` - ${new Date(session.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                  </Text>
                </View>
                <Badge variant={session.status === "completed" ? "success" : "warning"} label={session.method.toUpperCase()} size="sm" />
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
