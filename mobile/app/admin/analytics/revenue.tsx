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
import { ArrowLeft, DollarSign, TrendingUp, CreditCard } from "lucide-react-native";

export default function AdminRevenueAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { profile } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<any>(null);
  useEffect(() => { load(); }, []);
  const load = async () => { try { if (!profile?.gym_id) return; setData(await adminReportService.getRevenueReport(profile.gym_id)); } catch {} finally { setLoading(false); } };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Revenue (This Gym)</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <AdminKpiCard label="Monthly Revenue" value={`₹${(data?.monthly ?? 0).toLocaleString()}`} icon={<DollarSign size={20} />} />
        {data?.byMethod && Object.entries(data.byMethod).map(([m, a]: any) => (
          <View key={m} style={{ flexDirection: "row", justifyContent: "space-between", padding: theme.spacing.md, backgroundColor: theme.colors.bgSurfaceMuted, borderRadius: theme.radii.md }}>
            <Text variant="body">{m.replace("_", " ")}</Text>
            <Text variant="body" bold>₹{a.toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
