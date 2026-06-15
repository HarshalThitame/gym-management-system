import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { crmTrialService } from "@/services/crm/crm-trial-service";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle } from "lucide-react-native";

export default function TrialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [trial, setTrial] = useState<any>(null);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("trial_sessions").select("*, leads(name, phone)").eq("id", id).maybeSingle();
      setTrial(data);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!trial) return <Text>Trial not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Trial Session</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <Text variant="h3">{trial.leads?.name ?? "Lead"}</Text>
            <Text variant="body" muted>{trial.leads?.phone ?? ""}</Text>
            <Badge variant={trial.status === "completed" ? "success" : trial.status === "no_show" ? "danger" : "warning"} label={trial.status} />
            <Text variant="body">Scheduled: {new Date(trial.scheduled_at).toLocaleString("en-IN")}</Text>
            {trial.completed_at && <Text variant="body">Completed: {new Date(trial.completed_at).toLocaleString("en-IN")}</Text>}
            {trial.feedback && <Text variant="body">{trial.feedback}</Text>}
            <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              {trial.status === "scheduled" && (
                <>
                  <Button variant="primary" style={{ flex: 1 }} onPress={async () => { await crmTrialService.completeTrial(id, "Trial completed", true); load(); }}><CheckCircle2 size={16} color="#fff" /> Convert</Button>
                  <TouchableOpacity onPress={async () => { await crmTrialService.markNoShow(id); load(); }} style={{ padding: theme.spacing.md }}><XCircle size={20} color={theme.colors.danger} /></TouchableOpacity>
                </>
              )}
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
