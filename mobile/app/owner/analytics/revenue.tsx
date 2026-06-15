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
import { revenueAnalyticsService, type RevenueAnalytics } from "@/services/analytics/revenue-analytics-service";
import { ArrowLeft, TrendingUp, DollarSign, BarChart3 } from "lucide-react-native";

export default function RevenueAnalyticsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevenueAnalytics | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!organizationId) return;
      const r = await revenueAnalyticsService.getRevenueAnalytics(organizationId);
      setData(r);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  const maxMonthly = Math.max(1, ...(data?.monthly.map((m) => m.amount) ?? [0]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Revenue Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Monthly" value={`₹${(data?.totalMonth ?? 0).toLocaleString()}`} icon={<DollarSign size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Annual" value={`₹${(data?.totalYear ?? 0).toLocaleString()}`} icon={<BarChart3 size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Growth" value={`${data?.growth ?? 0}%`} icon={<TrendingUp size={20} />} detail="vs last month" /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Forecast" value={`₹${(data?.forecast ?? 0).toLocaleString()}`} icon={<TrendingUp size={20} />} detail="Projected month end" /></View>
        </View>

        <Text variant="h4">Monthly Trend</Text>
        <Card variant="muted">
          <CardContent>
            {data?.monthly.slice(-12).map((m) => (
              <View key={m.month} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
                <Text variant="caption" style={{ width: 60 }}>{m.month.slice(-2)}/{m.month.slice(0, 4)}</Text>
                <View style={{ flex: 1, height: 20, backgroundColor: theme.colors.border, borderRadius: 4, overflow: "hidden" }}>
                  <View style={{ width: `${(m.amount / maxMonthly) * 100}%`, height: "100%", backgroundColor: theme.colors.primary, borderRadius: 4 }} />
                </View>
                <Text variant="caption" style={{ width: 80, textAlign: "right" }}>₹{m.amount.toLocaleString()}</Text>
              </View>
            ))}
          </CardContent>
        </Card>

        <Text variant="h4">By Payment Method</Text>
        <Card variant="muted">
          <CardContent>
            {Object.entries(data?.byMethod ?? {}).sort(([, a], [, b]) => b - a).map(([method, amount]) => (
              <View key={method} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.xs }}>
                <Text variant="body">{method.replace("_", " ")}</Text>
                <Text variant="body" bold>₹{amount.toLocaleString()}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
