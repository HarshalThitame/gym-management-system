import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { adminReportService } from "@/services/admin/report-service";
import { ArrowLeft, Users, TrendingUp, UserMinus } from "lucide-react-native";

export default function AdminMembershipAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { profile } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<any>(null);
  useEffect(() => { load(); }, []);
  const load = async () => { try { if (!profile?.gym_id) return; setData(await adminReportService.getMemberReport(profile.gym_id)); } catch {} finally { setLoading(false); } };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Membership (This Gym)</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Total" value={data?.total ?? 0} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Active" value={data?.active ?? 0} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="New (MTD)" value={data?.newThisMonth ?? 0} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Renewals" value={data?.renewalsThisMonth ?? 0} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Expiring" value={data?.expiringThisMonth ?? 0} icon={<UserMinus size={20} />} /></View>
        </View>
      </ScrollView>
    </View>
  );
}
