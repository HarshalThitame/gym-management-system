import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { adminOrganizationService } from "@/services/admin/organization-service";
import { CreditCard, TrendingUp, Calendar, ChevronRight, Building2 } from "lucide-react-native";

export default function OwnerBillingScreen() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalGyms: 0, totalBranches: 0, totalMembers: 0,
    monthlyRevenue: 0, activeMembers: 0, planTier: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      if (!organizationId) return;
      const d = await adminOrganizationService.getDashboard(organizationId);
      setData({
        totalGyms: d.totalGyms, totalBranches: d.totalBranches,
        totalMembers: d.totalMembers, monthlyRevenue: d.monthlyRevenue,
        activeMembers: d.activeMembers,
        planTier: d.subscription?.plan_tier ?? d.tenantConfig?.plan_tier ?? "Free",
      });
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Billing & Subscription</Text>
        <Badge variant={data.planTier === "enterprise" ? "primary" : "info"} label={data.planTier.toUpperCase()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Monthly Revenue" value={`₹${data.monthlyRevenue.toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Active Members" value={data.activeMembers} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Gyms" value={data.totalGyms} icon={<Building2 size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Branches" value={data.totalBranches} icon={<Building2 size={20} />} /></View>
        </View>

        <TouchableOpacity onPress={() => router.push("/owner/subscription")}>
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <CreditCard size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">Subscription Details</Text>
                <Text variant="caption" muted>Current plan: {data.planTier}</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.fgMuted} />
            </CardContent>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/owner/reports")}>
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <TrendingUp size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">Revenue Reports</Text>
                <Text variant="caption" muted>Monthly, quarterly and annual analytics</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.fgMuted} />
            </CardContent>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
