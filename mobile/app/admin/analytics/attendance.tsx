import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { attendanceAnalytics } from "@/services/attendance-analytics";
import { ArrowLeft, CalendarCheck, TrendingUp, Clock } from "lucide-react-native";

export default function AdminAttendanceAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { profile } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<any>(null);
  useEffect(() => { load(); }, []);
  const load = async () => { try { if (!profile?.gym_id) return; setData(await attendanceAnalytics.getGymAnalytics(profile.gym_id)); } catch {} finally { setLoading(false); } };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Attendance (This Gym)</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Total Sessions" value={data?.totalSessions ?? 0} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Avg Daily" value={data?.averageDaily ?? 0} icon={<Clock size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Retention" value={`${data?.memberRetention ?? 0}%`} icon={<TrendingUp size={20} />} /></View>
        </View>
        {data?.peakHours && data.peakHours.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Peak Hours</Text>
            <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
              {data.peakHours.slice(0, 6).map((ph: any, i: number) => (
                <View key={i} style={{ flex: 1, alignItems: "center", padding: theme.spacing.sm, backgroundColor: theme.colors.bgSurfaceMuted, borderRadius: theme.radii.md }}>
                  <Text variant="caption" muted>{ph.hour}:00</Text>
                  <Text variant="body" bold>{ph.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
