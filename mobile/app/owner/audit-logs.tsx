import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Clock, FileText } from "lucide-react-native";

export default function AuditLogsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!organizationId) return;
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("activity_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50);
      setLogs(data ?? []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Audit Logs</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {logs.length === 0 ? <EmptyState icon={<FileText size={48} />} title="No audit logs" description="Activity logs will appear here as events occur." />
          : logs.map((log: any) => (
            <Card key={log.id} variant="muted">
              <CardContent style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Clock size={14} color={theme.colors.fgMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall">{log.event_type?.replace(/_/g, " ")}</Text>
                  <Text variant="caption" muted>{log.entity_type} · {new Date(log.created_at).toLocaleString("en-IN")}</Text>
                </View>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
