import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { executiveAnalyticsService, type ExecutiveDashboard } from "@/services/analytics/executive-analytics-service";
import { aiInsightsService, type BusinessInsight } from "@/services/analytics/ai-insights-service";
import { offlineCache } from "@/offline/cache";
import { 
  TrendingUp, Users, CalendarCheck, MessageSquare, 
  CreditCard, Activity, Brain, Target, BarChart3,
  ChevronRight, AlertTriangle, DollarSign,
} from "lucide-react-native";

const HEALTH_COLORS = { excellent: "#22c55e", good: "#3b82f6", average: "#f59e0b", at_risk: "#ef4444" };

export default function OwnerExecutiveDashboard() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);

  const load = useCallback(async () => {
    try {
      if (!organizationId) return;
      const [d, i] = await Promise.all([
        executiveAnalyticsService.getExecutiveDashboard(organizationId),
        aiInsightsService.generateInsights(organizationId),
      ]);
      setDashboard(d);
      setInsights(i);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const healthColor = dashboard ? HEALTH_COLORS[dashboard.health.level] : "#6b7280";

  if (loading) return <LoadingState fullScreen />;

  const modules = [
    { label: "Revenue Analytics", icon: <DollarSign size={18} />, value: `₹${(dashboard?.revenue.month ?? 0).toLocaleString()}`, detail: `${dashboard?.revenue.growth ?? 0}% vs last month`, color: theme.colors.success, route: "/owner/analytics/revenue" },
    { label: "Membership Analytics", icon: <Users size={18} />, value: `${dashboard?.members.active ?? 0} active`, detail: `${dashboard?.members.newThisMonth ?? 0} new this month`, color: theme.colors.primary, route: "/owner/analytics/membership" },
    { label: "Attendance Analytics", icon: <CalendarCheck size={18} />, value: `${dashboard?.attendance.today ?? 0} today`, detail: `${dashboard?.attendance.month ?? 0} this month`, color: theme.colors.info, route: "/owner/analytics/attendance" },
    { label: "CRM Analytics", icon: <MessageSquare size={18} />, value: `${dashboard?.crm.conversionRate ?? 0}% conv.`, detail: `${dashboard?.crm.newLeads ?? 0} new leads`, color: theme.colors.warning, route: "/owner/crm" },
    { label: "Branch Performance", icon: <BarChart3 size={18} />, value: `${dashboard?.subscriptions.branchUsage ?? 0}/${dashboard?.subscriptions.branchLimit ?? 1} branches`, detail: "Compare all branches", color: theme.colors.secondary, route: "/owner/analytics/branches" },
    { label: "Trainer Performance", icon: <Activity size={18} />, value: "Top performers", detail: "View trainer analytics", color: theme.colors.accent, route: "/owner/analytics/trainers" },
    { label: "Financial Health", icon: <CreditCard size={18} />, value: `₹${(dashboard?.revenue.today ?? 0).toLocaleString()} today`, detail: "Collections & dues", color: theme.colors.danger, route: "/owner/analytics/financial" },
    { label: "Subscription & Limits", icon: <Target size={18} />, value: dashboard?.subscriptions.planTier ?? "Free", detail: `${dashboard?.subscriptions.memberUsage ?? 0}/${dashboard?.subscriptions.memberLimit ?? 100} members`, color: theme.colors.info, route: "/owner/analytics/subscription" },
    { label: "AI Insights", icon: <Brain size={18} />, value: `${insights.length} insights`, detail: "Actionable recommendations", color: theme.colors.primary, route: "/owner/analytics/insights" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>Executive Dashboard</Text>
        <Text variant="h2">Business Overview</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}>

        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1, backgroundColor: healthColor + "15", borderRadius: theme.radii.xl, padding: theme.spacing.lg, alignItems: "center", gap: 4 }}>
            <Text variant="stat" style={{ color: healthColor }}>{dashboard?.health.score ?? 0}</Text>
            <Text variant="caption" style={{ color: healthColor, fontWeight: "700" }}>{dashboard?.health.level.toUpperCase() ?? "N/A"}</Text>
            <Text variant="caption" style={{ color: healthColor }}>Health Score</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.xl, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text variant="stat" color={theme.colors.primary}>₹{(dashboard?.revenue.month ?? 0).toLocaleString()}</Text>
            <Text variant="caption" muted>Revenue (MTD)</Text>
            <Text variant="caption" color={dashboard?.revenue.growth && dashboard.revenue.growth >= 0 ? theme.colors.success : theme.colors.danger}>
              {dashboard?.revenue.growth ?? 0}% vs last month
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "23%" }}>
            <Card variant="muted" padded style={{ alignItems: "center" }}>
              <CalendarCheck size={16} color={theme.colors.primary} />
              <Text variant="stat">{dashboard?.attendance.today ?? 0}</Text>
              <Text variant="caption" muted>Today</Text>
            </Card>
          </View>
          <View style={{ width: "23%" }}>
            <Card variant="muted" padded style={{ alignItems: "center" }}>
              <Users size={16} color={theme.colors.primary} />
              <Text variant="stat">{dashboard?.members.active ?? 0}</Text>
              <Text variant="caption" muted>Active</Text>
            </Card>
          </View>
          <View style={{ width: "23%" }}>
            <Card variant="muted" padded style={{ alignItems: "center" }}>
              <Users size={16} color={theme.colors.danger} />
              <Text variant="stat" color={theme.colors.danger}>{dashboard?.members.expired ?? 0}</Text>
              <Text variant="caption" muted>Expired</Text>
            </Card>
          </View>
          <View style={{ width: "23%" }}>
            <Card variant="muted" padded style={{ alignItems: "center" }}>
              <AlertTriangle size={16} color={theme.colors.warning} />
              <Text variant="stat" color={theme.colors.warning}>{dashboard?.members.frozen ?? 0}</Text>
              <Text variant="caption" muted>Frozen</Text>
            </Card>
          </View>
        </View>

        <Card>
          <CardContent style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Analytics Modules</Text>
            {modules.map((m, i) => (
              <TouchableOpacity key={i} onPress={() => router.push(m.route as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: i < modules.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: m.color + "20", alignItems: "center", justifyContent: "center" }}>{m.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{m.label}</Text>
                  <Text variant="caption" muted>{m.detail}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="bodySmall" bold>{m.value}</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.fgMuted} />
              </TouchableOpacity>
            ))}
          </CardContent>
        </Card>

        {insights.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Brain size={18} color={theme.colors.primary} />
              <Text variant="h4">AI Insights</Text>
            </View>
            {insights.slice(0, 3).map((insight, i) => (
              <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => router.push("/owner/analytics/insights")}>
                <Card variant="muted">
                  <CardContent style={{ flexDirection: "row", gap: theme.spacing.md }}>
                    {insight.type === "negative" || insight.type === "warning"
                      ? <AlertTriangle size={20} color={theme.colors.warning} />
                      : <Activity size={20} color={theme.colors.success} />}
                    <View style={{ flex: 1 }}>
                      <Text variant="subtitle">{insight.title}</Text>
                      <Text variant="bodySmall" muted>{insight.description}</Text>
                    </View>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
