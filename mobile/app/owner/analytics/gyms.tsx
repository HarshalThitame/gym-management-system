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
import { adminGymService } from "@/services/admin/gym-service";
import { ArrowLeft, Building2, TrendingUp, Users, DollarSign, Trophy } from "lucide-react-native";

export default function GymAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true); const [gyms, setGyms] = useState<any[]>([]);
  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      if (!organizationId) return;
      const g = await adminGymService.getGyms(organizationId);
      const enriched = await Promise.all(g.map(async (gym) => {
        const d = await adminGymService.getGymDashboard(gym.id);
        return { ...gym, ...d };
      }));
      setGyms(enriched.sort((a, b) => (b.monthlyRevenue ?? 0) - (a.monthlyRevenue ?? 0)));
    } catch {} finally { setLoading(false); }
  };
  if (loading) return <LoadingState fullScreen />;

  const topGym = gyms[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Gym Comparison</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {topGym && (
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <Trophy size={24} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" muted>Top Gym</Text>
                <Text variant="h3">{topGym.name}</Text>
              </View>
              <Text variant="h3" color={theme.colors.primary}>₹{(topGym.monthlyRevenue ?? 0).toLocaleString()}</Text>
            </CardContent>
          </Card>
        )}
        {gyms.map((g, i) => (
          <Card key={g.id} variant={i === 0 ? "default" : "muted"}>
            <CardContent style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  <Text variant="caption" muted>#{i + 1}</Text>
                  <Text variant="subtitle">{g.name}</Text>
                </View>
                <Badge variant={g.status === "active" ? "success" : "neutral"} label={g.status} size="sm" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <Text variant="caption" muted>₹{(g.monthlyRevenue ?? 0).toLocaleString()}</Text>
                <Text variant="caption" muted>{g.activeMembers ?? 0} members</Text>
                <Text variant="caption" muted>{g.todayCheckIns ?? 0} today</Text>
                <Text variant="caption" muted>{g.totalTrainers ?? 0} trainers</Text>
              </View>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
