import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { executiveAnalyticsService } from "@/services/analytics/executive-analytics-service";
import { revenueAnalyticsService } from "@/services/analytics/revenue-analytics-service";
import { membershipAnalyticsService } from "@/services/analytics/membership-analytics-service";
import { BarChart3, TrendingUp, Users, CreditCard, CalendarCheck, MessageSquare, Building2, Download, ChevronRight } from "lucide-react-native";

export default function OwnerReportsScreen() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exec, setExec] = useState<any>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { if (!organizationId) return; setExec(await executiveAnalyticsService.getExecutiveDashboard(organizationId)); } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  const reportModules = [
    { title: "Revenue Report", desc: "Daily, monthly, annual revenue with trends and forecasts", icon: <CreditCard size={20} />, route: "/owner/analytics/revenue" },
    { title: "Membership Report", desc: "Active, churn, retention, new and expiring members", icon: <Users size={20} />, route: "/owner/analytics/membership" },
    { title: "Attendance Report", desc: "Daily attendance, peak hours, compliance rates", icon: <CalendarCheck size={20} />, route: "/owner/analytics/attendance" },
    { title: "CRM Report", desc: "Lead pipeline, conversion rates, source tracking", icon: <MessageSquare size={20} />, route: "/owner/crm" },
    { title: "Branch Report", desc: "Branch comparison, rankings, performance scores", icon: <Building2 size={20} />, route: "/owner/analytics/branches" },
    { title: "Financial Report", desc: "Collections, dues, leakage, revenue breakdown", icon: <CreditCard size={20} />, route: "/owner/analytics/financial" },
    { title: "Trainer Report", desc: "Trainer performance, retention, session completion", icon: <TrendingUp size={20} />, route: "/owner/analytics/trainers" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Reports</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <Text variant="caption" muted uppercase>Summary</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Revenue (MTD)" value={`₹${(exec?.revenue.month ?? 0).toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Active Members" value={exec?.members.active ?? 0} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Attendance (MTD)" value={exec?.attendance.month ?? 0} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Conversion" value={`${exec?.crm.conversionRate ?? 0}%`} icon={<TrendingUp size={20} />} /></View>
        </View>

        <Text variant="caption" muted uppercase style={{ marginTop: theme.spacing.md }}>Available Reports</Text>
        {reportModules.map((m, i) => (
          <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => router.push(m.route as never)}>
            <Card variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>{m.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text variant="subtitle">{m.title}</Text>
                  <Text variant="caption" muted>{m.desc}</Text>
                </View>
                <ChevronRight size={18} color={theme.colors.fgMuted} />
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
