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
import { financialAnalyticsService } from "@/services/analytics/financial-analytics-service";
import { ArrowLeft, DollarSign, AlertTriangle, CreditCard, TrendingDown, BarChart3 } from "lucide-react-native";

export default function FinancialAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<any>(null);
  useEffect(() => { load(); }, []);
  const load = async () => { try { if (!organizationId) return; setData(await financialAnalyticsService.getFinancialAnalytics(organizationId)); } catch {} finally { setLoading(false); } };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Financial Health</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Collected (MTD)" value={`₹${(data?.collected ?? 0).toLocaleString()}`} icon={<DollarSign size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Pending" value={`₹${(data?.pending ?? 0).toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Overdue" value={`₹${(data?.overdue ?? 0).toLocaleString()}`} icon={<AlertTriangle size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Refunded" value={`₹${(data?.refunded ?? 0).toLocaleString()}`} icon={<TrendingDown size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Projected" value={`₹${(data?.projectedRevenue ?? 0).toLocaleString()}`} icon={<BarChart3 size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Leakage Risk" value={`${data?.leakageRisk ?? 0}%`} detail="Overdue vs collected" /></View>
        </View>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Revenue Breakdown (MTD)</Text>
            <Row label="Membership" value={`₹${(data?.membershipRevenue ?? 0).toLocaleString()}`} />
            <Row label="Personal Training" value={`₹${(data?.ptRevenue ?? 0).toLocaleString()}`} />
            <Row label="Class Fees" value={`₹${(data?.classRevenue ?? 0).toLocaleString()}`} />
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="body" muted>{label}</Text><Text variant="body" bold>{value}</Text></View>;
}
