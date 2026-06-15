import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { adminReportService } from "@/services/admin/report-service";
import { attendanceAnalytics } from "@/services/attendance-analytics";
import { getSupabaseClient } from "@/api/supabase";
import { CalendarCheck, TrendingUp, Clock, BarChart3, Sun, Cloud, Moon, Activity } from "lucide-react-native";

export default function AdminAttendanceScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, thisMonth: 0, avgDaily: 0 });
  const [analytics, setAnalytics] = useState({ averageDaily: 0, busiestDay: "", slowestDay: "", memberRetention: 0, peakHours: [] as { hour: number; count: number }[] });
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);

  const loadAttendance = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const [r, a] = await Promise.all([
        adminReportService.getAttendanceReport(profile.gym_id),
        attendanceAnalytics.getGymAnalytics(profile.gym_id),
      ]);
      setStats({ today: r.today, thisWeek: r.thisWeek, thisMonth: r.thisMonth, avgDaily: (r as any).avgDaily ?? (r as any).averageDaily ?? 0 });
      setAnalytics(a);

      const supabase = getSupabaseClient();
      const { data } = await supabase.from("attendance_sessions")
        .select("check_in_at, status, members(full_name, member_code), method")
        .eq("gym_id", profile.gym_id)
        .order("check_in_at", { ascending: false }).limit(20);
      setRecentCheckins(data ?? []);
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Attendance Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAttendance} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Today" value={stats.today} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="This Week" value={stats.thisWeek} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Monthly" value={stats.thisMonth} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Avg Daily" value={stats.avgDaily} icon={<Clock size={20} />} /></View>
        </View>

        <Text variant="caption" muted uppercase>Business Insights</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Retention Rate" value={`${analytics.memberRetention}%`} icon={<Activity size={20} />} detail="Members completing sessions" /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Busiest Day" value={analytics.busiestDay !== "N/A" ? new Date(analytics.busiestDay).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "N/A"} icon={<Sun size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Slowest Day" value={analytics.slowestDay !== "N/A" ? new Date(analytics.slowestDay).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "N/A"} icon={<Cloud size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Avg Daily" value={analytics.averageDaily} icon={<BarChart3 size={20} />} detail="Last 30 days" /></View>
        </View>

        {analytics.peakHours.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Peak Hours</Text>
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              {analytics.peakHours.slice(0, 4).map((ph) => (
                <Card key={ph.hour} variant="muted" padded style={{ flex: 1 }}>
                  <Text variant="caption" muted>{ph.hour}:00</Text>
                  <Text variant="stat" color={theme.colors.primary}>{ph.count}</Text>
                  <Text variant="caption" muted>check-ins</Text>
                </Card>
              ))}
            </View>
          </View>
        )}

        <Text variant="h4">Recent Check-Ins</Text>
        {recentCheckins.length === 0 ? <EmptyState title="No check-ins today" description="Attendance records will appear here." />
          : recentCheckins.map((c: any, i: number) => (
            <Card key={c.id ?? i} variant="muted">
              <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text variant="bodySmall" bold>{c.members?.full_name ?? "Member"}</Text>
                  <Text variant="caption" muted>{c.members?.member_code ?? ""} · {c.method}</Text>
                </View>
                <Text variant="caption" muted>
                  {new Date(c.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
