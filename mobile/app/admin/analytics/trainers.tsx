import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { trainerAnalyticsService } from "@/services/analytics/trainer-analytics-service";
import { ArrowLeft, Dumbbell, Trophy } from "lucide-react-native";

export default function AdminTrainerAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { profile } = useAuth();
  const [loading, setLoading] = useState(true); const [trainers, setTrainers] = useState<any[]>([]);
  useEffect(() => { load(); }, []);
  const load = async () => { try { if (!profile?.gym_id) return; setTrainers(await trainerAnalyticsService.getTrainerPerformances(profile.gym_id)); } catch {} finally { setLoading(false); } };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Trainer Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {trainers.map((t, i) => (
          <Card key={t.trainerId} variant={i === 0 ? "default" : "muted"}>
            <CardContent style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  {i === 0 && <Trophy size={16} color={theme.colors.warning} />}
                  <Text variant="subtitle">{t.name}</Text>
                </View>
                <Badge variant={t.score >= 80 ? "success" : "warning"} label={`${t.score}`} size="sm" />
              </View>
              <Text variant="caption" muted>{t.assignedMembers} members · {t.completedSessions} sessions · {t.memberRetention}% retention</Text>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
