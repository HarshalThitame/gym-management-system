import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmAnalyticsService } from "@/services/crm/crm-analytics-service";
import { crmPipelineService, PIPELINE_STAGES } from "@/services/crm/crm-pipeline-service";
import { MessageSquare, TrendingUp, Users, BarChart3, Target, ChevronRight } from "lucide-react-native";

export default function AdminCRMDashboard() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [pipelineStats, setPipelineStats] = useState<Record<string, number>>({});
  const [topSources, setTopSources] = useState<[string, number][]>([]);

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const [a, p] = await Promise.all([
        crmAnalyticsService.getGymCRMAnalytics(profile.gym_id),
        crmPipelineService.getPipelineStats(profile.gym_id),
      ]);
      setAnalytics(a);
      setPipelineStats(p);
      setTopSources(Object.entries(a.leadsBySource).sort(([, a], [, b]) => b - a).slice(0, 5));
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>CRM Analytics</Text>
        <Text variant="h2">Sales Performance</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Total Leads" value={analytics?.totalLeads ?? 0} icon={<MessageSquare size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Conversion" value={`${analytics?.conversionRate ?? 0}%`} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Revenue" value={`₹${(analytics?.revenueGenerated ?? 0).toLocaleString()}`} icon={<BarChart3 size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Avg Days" value={analytics?.averageConversionDays ?? 0} detail="To convert" icon={<Target size={20} />} /></View>
        </View>

        <Text variant="h4">Pipeline</Text>
        <View style={{ gap: theme.spacing.xs }}>
          {PIPELINE_STAGES.map((stage) => {
            const count = pipelineStats[stage.status] ?? 0;
            const maxCount = Math.max(1, ...Object.values(pipelineStats));
            const barWidth = (count / maxCount) * 100;
            return (
              <View key={stage.status} style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="caption" muted>{stage.label}</Text>
                  <Text variant="caption" bold>{count}</Text>
                </View>
                <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${barWidth}%`, height: "100%", backgroundColor: stage.color, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>

        {topSources.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Top Sources</Text>
            {topSources.map(([source, count]) => (
              <View key={source} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.xs }}>
                <Text variant="body">{source.replace(/_/g, " ")}</Text>
                <Text variant="body" bold>{count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
