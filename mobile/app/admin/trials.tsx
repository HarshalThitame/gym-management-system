import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmTrialService } from "@/services/crm/crm-trial-service";
import { crmAnalyticsService } from "@/services/crm/crm-analytics-service";
import { CalendarCheck, Clock } from "lucide-react-native";

export default function AdminTrialsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trials, setTrials] = useState<any[]>([]);
  const [todays, setTodays] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const [t, td] = await Promise.all([
        crmTrialService.getTrialsForGym(profile.gym_id),
        crmTrialService.getTodaysTrials(profile.gym_id),
      ]);
      setTrials(t);
      setTodays(td);
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Trials</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Today" value={todays.length} icon={<CalendarCheck size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Total" value={trials.length} icon={<Clock size={20} />} /></View>
        </View>
        {trials.length === 0 ? <EmptyState title="No trials" description="Trials will appear here when scheduled." />
          : trials.map((t: any) => (
            <Card key={t.id} variant="muted">
              <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text variant="bodySmall" bold>{t.leads?.name ?? "Lead"}</Text>
                  <Text variant="caption" muted>{new Date(t.scheduled_at).toLocaleDateString("en-IN")}</Text>
                </View>
                <Badge variant={t.status === "completed" ? "success" : t.status === "no_show" ? "danger" : "warning"} label={t.status} size="sm" />
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
