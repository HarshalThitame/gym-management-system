import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressChart } from "@/components/member/ProgressChart";
import { progressService } from "@/services/progress-service";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Weight, Activity, TrendingUp } from "lucide-react-native";
import type { FitnessProgress } from "@/types";

export default function MemberProgressDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [history, setHistory] = useState<FitnessProgress[]>([]);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: m } = await supabase.from("members").select("full_name, member_code").eq("id", id).maybeSingle();
      setMember(m);
      const h = await progressService.getProgressHistory(id, 20);
      setHistory(h);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  const latest = history[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{member?.full_name ?? "Member"}</Text>
          <Text variant="caption" muted>{member?.member_code ?? ""}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {latest && (
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <View style={{ alignItems: "center" }}>
                <Weight size={20} color={theme.colors.primary} />
                <Text variant="stat">{latest.weight_kg ?? "—"}</Text>
                <Text variant="caption" muted>Weight</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Activity size={20} color={theme.colors.primary} />
                <Text variant="stat">{latest.body_fat_percentage ?? "—"}</Text>
                <Text variant="caption" muted>Body Fat</Text>
              </View>
            </CardContent>
          </Card>
        )}

        <Text variant="h4">Weight History</Text>
        <ProgressChart data={history} metric="weight_kg" label="Weight" unit="kg" />

        {history.length >= 2 && (
          <>
            <Text variant="h4">Body Fat History</Text>
            <ProgressChart data={history} metric="body_fat_percentage" label="Body Fat" unit="%" />
          </>
        )}

        {history.length === 0 && <EmptyState title="No progress data" description="Progress records will appear as the member checks in." />}
      </ScrollView>
    </View>
  );
}
