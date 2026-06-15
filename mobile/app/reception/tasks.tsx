import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmTaskService } from "@/services/crm/crm-task-service";
import { CheckCircle2, Clock, AlertTriangle, Target } from "lucide-react-native";

export default function TasksScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todays, setTodays] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      if (!profile?.id) return;
      const [t, o] = await Promise.all([
        crmTaskService.getTodaysTasks(profile.id),
        crmTaskService.getOverdueTasks(profile.id),
      ]);
      setTodays(t); setOverdue(o);
    } catch {} finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (id: string) => { await crmTaskService.completeTask(id); load(); };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Tasks</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Today" value={todays.length} icon={<Target size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={20} />} /></View>
        </View>
        {overdue.map((t: any) => (
          <TouchableOpacity key={t.id} onPress={() => handleComplete(t.id)}>
            <Card variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <AlertTriangle size={16} color={theme.colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall">{t.title}</Text>
                  <Text variant="caption" muted>{t.priority}</Text>
                </View>
                <CheckCircle2 size={18} color={theme.colors.success} />
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
        {todays.map((t: any) => (
          <TouchableOpacity key={t.id} onPress={() => handleComplete(t.id)}>
            <Card variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <Clock size={16} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall">{t.title}</Text>
                  <Text variant="caption" muted>{t.priority}</Text>
                </View>
                <CheckCircle2 size={18} color={theme.colors.success} />
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
        {todays.length === 0 && overdue.length === 0 && <EmptyState title="No tasks" description="Tasks will appear here when assigned." />}
      </ScrollView>
    </View>
  );
}
