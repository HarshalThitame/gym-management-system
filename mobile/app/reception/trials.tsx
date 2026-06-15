import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmTrialService } from "@/services/crm/crm-trial-service";
import { crmAnalyticsService } from "@/services/crm/crm-analytics-service";
import { CalendarCheck, Users, TrendingUp, Plus, ChevronRight, Clock, XCircle } from "lucide-react-native";

export default function ReceptionTrialsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trials, setTrials] = useState<any[]>([]);
  const [todaysTrials, setTodaysTrials] = useState<any[]>([]);
  const [stats, setStats] = useState({ scheduled: 0, active: 0, completed: 0 });

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const [t, td, a] = await Promise.all([
        crmTrialService.getTrialsForGym(profile.gym_id),
        crmTrialService.getTodaysTrials(profile.gym_id),
        crmAnalyticsService.getGymCRMAnalytics(profile.gym_id),
      ]);
      setTrials(t);
      setTodaysTrials(td);
      setStats({ scheduled: a.trialsScheduled, active: a.trialsActive, completed: a.trialsCompleted });
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { load(); }, [load]);

  const handleNoShow = async (trialId: string) => {
    Alert.alert("Mark No Show", "Mark this trial as no-show?", [
      { text: "Cancel", style: "cancel" },
      { text: "No Show", style: "destructive", onPress: async () => { await crmTrialService.markNoShow(trialId); load(); } },
    ]);
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Trial Management</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Today" value={todaysTrials.length} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Active" value={stats.active} icon={<Users size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Completed" value={stats.completed} icon={<TrendingUp size={20} />} /></View>
        </View>

        {todaysTrials.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Today's Trials</Text>
            {todaysTrials.map((t: any) => (
              <Card key={t.id} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <CalendarCheck size={22} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{t.leads?.name ?? "Lead"}</Text>
                    <Text variant="caption" muted>{new Date(t.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <Badge variant={t.status === "scheduled" ? "warning" : "success"} label={t.status} size="sm" />
                  {t.status === "scheduled" && (
                    <TouchableOpacity onPress={() => handleNoShow(t.id)} style={{ padding: 4 }}>
                      <XCircle size={18} color={theme.colors.danger} />
                    </TouchableOpacity>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        <Text variant="h4">All Trials ({trials.length})</Text>
        {trials.length === 0 ? <EmptyState title="No trials" description="Schedule a trial for your leads to get started." action={{ label: "Schedule Trial", onPress: () => router.push("/reception/leads") }} />
          : trials.map((t: any) => (
            <Card key={t.id} variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <Clock size={16} color={theme.colors.fgMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" bold>{t.leads?.name ?? "Lead"}</Text>
                  <Text variant="caption" muted>{new Date(t.scheduled_at).toLocaleDateString("en-IN")} · {t.status}</Text>
                </View>
                <Badge variant={t.status === "completed" ? "success" : t.status === "no_show" ? "danger" : t.status === "cancelled" ? "neutral" : "warning"} label={t.status} size="sm" />
                {t.feedback && <Text variant="caption" muted style={{ maxWidth: 100 }} numberOfLines={1}>{t.feedback}</Text>}
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
