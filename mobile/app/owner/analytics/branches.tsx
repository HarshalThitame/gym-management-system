import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { branchAnalyticsService, type BranchPerformance } from "@/services/analytics/branch-analytics-service";
import { ArrowLeft, Building2, TrendingUp, Trophy } from "lucide-react-native";

export default function BranchAnalyticsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchPerformance[]>([]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      if (!organizationId) return;
      const b = await branchAnalyticsService.getBranchPerformances(organizationId);
      setBranches(b);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  const topBranch = branches[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Branch Performance</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {topBranch && (
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <Trophy size={24} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" muted>Top Performer</Text>
                <Text variant="h3">{topBranch.branchName}</Text>
              </View>
              <Text variant="stat" color={theme.colors.primary}>{topBranch.score}</Text>
            </CardContent>
          </Card>
        )}

        {branches.map((b, i) => (
          <Card key={b.branchId} variant={i === 0 ? "default" : "muted"}>
            <CardContent style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <Text variant="caption" muted style={{ width: 24 }}>#{i + 1}</Text>
                  <Text variant="subtitle">{b.branchName}</Text>
                </View>
                <Badge variant={b.score >= 80 ? "success" : b.score >= 50 ? "warning" : "danger"} label={`${b.score}`} size="sm" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <Text variant="caption" muted>₹{b.revenue.toLocaleString()}</Text>
                <Text variant="caption" muted>{b.members} members</Text>
                <Text variant="caption" muted>{b.attendance} visits</Text>
                <Text variant="caption" muted>{b.conversionRate}% conv</Text>
              </View>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
