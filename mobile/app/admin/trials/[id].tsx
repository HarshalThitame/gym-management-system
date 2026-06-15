import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft } from "lucide-react-native";

export default function AdminTrialDetailScreen() {
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
  if (!trial) return <Text>Not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Trial Detail</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <Text variant="h3">{trial.leads?.name ?? "Lead"}</Text>
            <Badge variant={trial.status === "completed" ? "success" : "warning"} label={trial.status} />
            <Text variant="body">Scheduled: {new Date(trial.scheduled_at).toLocaleString("en-IN")}</Text>
            {trial.completed_at && <Text variant="body">Completed: {new Date(trial.completed_at).toLocaleString("en-IN")}</Text>}
            {trial.feedback && <Text variant="body">Feedback: {trial.feedback}</Text>}
            <Text variant="body">Converted: {trial.converted ? "Yes" : "No"}</Text>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
