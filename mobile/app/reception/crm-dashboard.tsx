import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmAnalyticsService } from "@/services/crm/crm-analytics-service";
import { crmFollowupService } from "@/services/crm/crm-followup-service";
import { crmPipelineService, PIPELINE_STAGES } from "@/services/crm/crm-pipeline-service";
import { MessageSquare, TrendingUp, Users, Phone, CalendarCheck, Target, ChevronRight, BarChart3 } from "lucide-react-native";

export default function ReceptionCRMDashboard() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [todaysFollowups, setTodaysFollowups] = useState<any[]>([]);
  const [pipelineStats, setPipelineStats] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const [a, f, p] = await Promise.all([
        crmAnalyticsService.getGymCRMAnalytics(profile.gym_id),
        crmFollowupService.getTodaysFollowUps(profile.gym_id),
        crmPipelineService.getPipelineStats(profile.gym_id),
      ]);
      setAnalytics(a);
      setTodaysFollowups(f);
      setPipelineStats(p);
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState fullScreen />;

  const quickActions = [
    { label: "New Lead", icon: <UserPlus size={18} />, href: "/reception/leads/add", color: theme.colors.primary },
    { label: "Today's Tasks", icon: <Target size={18} />, href: "/reception/tasks", color: theme.colors.warning },
    { label: "Follow-Ups", icon: <Phone size={18} />, href: "/reception/followups", color: theme.colors.info },
    { label: "Trials", icon: <CalendarCheck size={18} />, href: "/reception/trials", color: theme.colors.success },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>CRM Dashboard</Text>
        <Text variant="h2">Lead Management</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "30%" }}><AdminKpiCard label="New" value={analytics?.newLeads ?? 0} icon={<MessageSquare size={16} />} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Today FU" value={analytics?.followUpsToday ?? 0} icon={<Phone size={16} />} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Overdue" value={analytics?.followUpsOverdue ?? 0} detail="Follow-ups" /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Conversion" value={`${analytics?.conversionRate ?? 0}%`} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Revenue" value={`₹${(analytics?.revenueGenerated ?? 0).toLocaleString()}`} icon={<BarChart3 size={20} />} /></View>
        </View>

        <Card>
          <CardContent style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {quickActions.map((action) => (
              <TouchableOpacity key={action.label} onPress={() => router.push(action.href as never)}
                style={{ flex: 1, minWidth: "45%", flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.bgSurfaceMuted, borderRadius: theme.radii.md }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: action.color + "20", alignItems: "center", justifyContent: "center" }}>
                  {action.icon}
                </View>
                <Text variant="bodySmall" bold>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </CardContent>
        </Card>

        <Text variant="h4">Pipeline</Text>
        <View style={{ gap: theme.spacing.xs }}>
          {PIPELINE_STAGES.filter((s) => s.status !== "archived").map((stage) => {
            const count = pipelineStats[stage.status] ?? 0;
            return (
              <TouchableOpacity key={stage.status} activeOpacity={0.7} onPress={() => router.push("/reception/leads")}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stage.color }} />
                  <Text variant="body" style={{ flex: 1 }}>{stage.label}</Text>
                  <Badge variant="neutral" label={String(count)} size="sm" />
                  <ChevronRight size={14} color={theme.colors.fgMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {todaysFollowups.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Today's Follow-Ups ({todaysFollowups.length})</Text>
            {todaysFollowups.slice(0, 5).map((fu: any) => (
              <Card key={fu.id} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <Phone size={16} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySmall" bold>{fu.leads?.name ?? "Lead"}</Text>
                    <Text variant="caption" muted>{fu.type} · {new Date(fu.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function UserPlus(props: any) { return <MessageSquare size={18} {...props} />; }
