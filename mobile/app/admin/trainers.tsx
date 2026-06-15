import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminGymService } from "@/services/admin/gym-service";
import { Dumbbell, ChevronRight, Plus } from "lucide-react-native";
import type { Trainer } from "@/types";

export default function AdminTrainersScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  useEffect(() => { loadTrainers(); }, []);

  const loadTrainers = async () => {
    try {
      if (!profile?.gym_id) return;
      const t = await adminGymService.getGymTrainers(profile.gym_id);
      setTrainers(t);
    } catch {} finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Trainers</Text>
        <Text variant="bodySmall" muted>{trainers.length} active trainers</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTrainers} tintColor={theme.colors.primary} />}>
        {trainers.length === 0 ? <EmptyState icon={<Dumbbell size={48} />} title="No trainers" description="Add trainers to start assigning them to members." />
          : trainers.map((t) => (
            <TouchableOpacity key={t.id} activeOpacity={0.7} onPress={() => router.push(`/admin/trainers/${t.id}`)}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Text variant="subtitle" color={theme.colors.primary}>{t.display_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{t.display_name}</Text>
                    <Text variant="caption" muted>{t.specialization ?? "General Trainer"}</Text>
                  </View>
                  <Badge variant={t.status === "active" ? "success" : "neutral"} label={t.status} size="sm" />
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
