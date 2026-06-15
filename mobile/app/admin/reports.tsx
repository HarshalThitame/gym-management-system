import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { adminReportService } from "@/services/admin/report-service";
import { BarChart3, TrendingUp, Users, CreditCard, CalendarCheck } from "lucide-react-native";

export default function AdminReportsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ monthly: 0, daily: [] as number[], weekly: [] as number[] });
  const [members, setMembers] = useState({ total: 0, active: 0, newThisMonth: 0, expiring: 0 });
  const [attendance, setAttendance] = useState({ today: 0, week: 0, month: 0, avgDaily: 0 });

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      if (!profile?.gym_id) return;
      const [r, m, a] = await Promise.all([
        adminReportService.getRevenueReport(profile.gym_id),
        adminReportService.getMemberReport(profile.gym_id),
        adminReportService.getAttendanceReport(profile.gym_id),
      ]);
      setRevenue({ monthly: r.monthly, daily: r.daily, weekly: r.weekly });
      setMembers({ total: m.total, active: m.active, newThisMonth: m.newThisMonth, expiring: m.expiringThisMonth });
      setAttendance({ today: a.today, week: a.thisWeek, month: a.thisMonth, avgDaily: a.averageDaily ?? 0 });
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Reports</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadReports} tintColor={theme.colors.primary} />}>
        <Text variant="caption" muted uppercase>Revenue</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Monthly Revenue" value={`₹${revenue.monthly.toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Today" value={`₹${(revenue.daily[revenue.daily.length - 1] ?? 0).toLocaleString()}`} icon={<TrendingUp size={20} />} /></View>
        </View>

        <Text variant="caption" muted uppercase>Members</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "30%" }}><AdminKpiCard label="Total" value={members.total} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Active" value={members.active} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="New (MTD)" value={members.newThisMonth} /></View>
        </View>

        <Text variant="caption" muted uppercase>Attendance</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Today" value={attendance.today} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="This Month" value={attendance.month} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Weekly Avg" value={attendance.avgDaily} icon={<BarChart3 size={20} />} /></View>
        </View>
      </ScrollView>
    </View>
  );
}
