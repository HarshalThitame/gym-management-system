import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { attendanceAnalytics } from "@/services/attendance-analytics";
import { adminReportService } from "@/services/admin/report-service";
import { ArrowLeft, CalendarCheck, TrendingUp, Clock, Sun, Cloud, BarChart3 } from "lucide-react-native";

export default function AttendanceAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { profile } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<any>(null);
  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      if (!profile?.gym_id) return;
      const [a, r] = await Promise.all([attendanceAnalytics.getGymAnalytics(profile.gym_id), adminReportService.getAttendanceReport(profile.gym_id)]);
      setData({ ...a, ...r });
    } catch {} finally { setLoading(false); }
  };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Attendance Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Today" value={data?.today ?? 0} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="This Month" value={data?.thisMonth ?? data?.totalSessions ?? 0} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Avg Daily" value={data?.avgDaily ?? data?.averageDaily ?? 0} icon={<Clock size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Retention" value={`${data?.memberRetention ?? 0}%`} icon={<BarChart3 size={20} />} /></View>
        </View>

        <Text variant="h4">Peak Hours</Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          {(data?.peakHours ?? []).slice(0, 6).map((ph: any, i: number) => (
            <Card key={i} variant="muted" padded style={{ flex: 1, alignItems: "center" }}>
              <Text variant="caption" muted>{ph.hour}:00</Text>
              <Text variant="stat" color={theme.colors.primary}>{ph.count}</Text>
            </Card>
          ))}
        </View>

        {data?.busiestDay && data?.busiestDay !== "N/A" && (
          <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}><AdminKpiCard label="Busiest Day" value={new Date(data.busiestDay).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })} icon={<Sun size={20} />} /></View>
            <View style={{ flex: 1 }}><AdminKpiCard label="Slowest Day" value={data.slowestDay !== "N/A" ? new Date(data.slowestDay).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) : "N/A"} icon={<Cloud size={20} />} /></View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
