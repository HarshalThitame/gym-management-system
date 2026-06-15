import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmAnalyticsService } from "@/services/crm/crm-analytics-service";
import { crmLeadService } from "@/services/crm/crm-lead-service";
import { MessageSquare, TrendingUp, Users, BarChart3, Target } from "lucide-react-native";

export default function OwnerCRMDashboard() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      if (!organizationId) return;
      const [a, recent] = await Promise.all([
        crmAnalyticsService.getOrgCRMAnalytics(organizationId),
        crmLeadService.getLeadsByOrg(organizationId),
      ]);
      setAnalytics(a);
      setRecentLeads(recent.slice(0, 10));
    } catch {} finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState fullScreen />;

    const sourceEntries = Object.entries(analytics?.leadsBySource ?? {}) as [string, number][];
    const topSources = sourceEntries.sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>Organization CRM</Text>
        <Text variant="h2">Sales Overview</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Total Leads" value={analytics?.totalLeads ?? 0} icon={<MessageSquare size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Conversion Rate" value={`${analytics?.conversionRate ?? 0}%`} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Converted" value={analytics?.convertedLeads ?? 0} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Pipeline Value" value={`₹${(analytics?.pipelineValue ?? 0).toLocaleString()}`} icon={<Target size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Revenue Generated" value={`₹${(analytics?.revenueGenerated ?? 0).toLocaleString()}`} icon={<BarChart3 size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Lost Leads" value={analytics?.lostLeads ?? 0} /></View>
        </View>

        {topSources.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Top Lead Sources</Text>
            {topSources.map(([source, count]) => (
              <View key={source} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <Text variant="body">{source.replace(/_/g, " ")}</Text>
                <Text variant="body" bold>{count}</Text>
              </View>
            ))}
          </View>
        )}

        <Text variant="h4">Recent Leads</Text>
        {recentLeads.map((lead: any) => (
          <Card key={lead.id} variant="muted">
            <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text variant="bodySmall" bold>{lead.name}</Text>
                <Text variant="caption" muted>{lead.source?.replace("_", " ")} · {new Date(lead.created_at).toLocaleDateString("en-IN")}</Text>
              </View>
              <Text variant="caption" bold>{lead.status}</Text>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
