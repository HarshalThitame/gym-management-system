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
import { membershipAnalyticsService } from "@/services/analytics/membership-analytics-service";
import { ArrowLeft, Users, TrendingUp, UserMinus, Activity } from "lucide-react-native";

export default function MembershipAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<any>(null);
  useEffect(() => { load(); }, []);
  const load = async () => {
    try { if (!organizationId) return; const m = await membershipAnalyticsService.getMembershipAnalytics(organizationId); setData(m); } catch {} finally { setLoading(false); }
  };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Membership Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "30%" }}><AdminKpiCard label="Active" value={data?.active ?? 0} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Expired" value={data?.expired ?? 0} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Frozen" value={data?.frozen ?? 0} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Churn Rate" value={`${data?.churnRate ?? 0}%`} icon={<UserMinus size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Retention" value={`${data?.retentionRate ?? 0}%`} icon={<Activity size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="New (MTD)" value={data?.newThisMonth ?? 0} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Expiring" value={data?.expiringThisMonth ?? 0} icon={<TrendingUp size={20} />} detail="This month" /></View>
        </View>
        <Text variant="h4">Monthly Trend</Text>
        <Card variant="muted">
          <CardContent>
            {data?.monthlyTrend?.map((m: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text variant="caption">{m.month}</Text>
                <Text variant="caption" color={theme.colors.success}>+{m.new}</Text>
                <Text variant="caption" color={theme.colors.danger}>-{m.expired}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
