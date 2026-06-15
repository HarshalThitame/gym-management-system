import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmFollowupService } from "@/services/crm/crm-followup-service";
import { Phone, CheckCircle2, Clock, AlertTriangle } from "lucide-react-native";

export default function AdminFollowupsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todays, setTodays] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const [t, o] = await Promise.all([
        crmFollowupService.getTodaysFollowUps(profile.gym_id),
        crmFollowupService.getOverdueFollowUps(profile.gym_id),
      ]);
      setTodays(t); setOverdue(o);
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (id: string) => {
    const ok = await crmFollowupService.completeFollowUp(id);
    if (ok) load();
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Follow-Ups</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Today" value={todays.length} icon={<Clock size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={20} />} /></View>
        </View>
        {overdue.map((fu: any) => (
          <TouchableOpacity key={fu.id} onPress={() => handleComplete(fu.id)}>
            <Card variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <AlertTriangle size={16} color={theme.colors.danger} />
                <Text variant="bodySmall" style={{ flex: 1 }}>{fu.leads?.name ?? "Lead"} · {fu.type}</Text>
                <CheckCircle2 size={18} color={theme.colors.success} />
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
        {todays.map((fu: any) => (
          <TouchableOpacity key={fu.id} onPress={() => handleComplete(fu.id)}>
            <Card variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <Phone size={16} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ flex: 1 }}>{fu.leads?.name ?? "Lead"} · {new Date(fu.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                <CheckCircle2 size={18} color={theme.colors.success} />
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
        {todays.length === 0 && overdue.length === 0 && <EmptyState title="All caught up" description="No pending follow-ups." />}
      </ScrollView>
    </View>
  );
}
