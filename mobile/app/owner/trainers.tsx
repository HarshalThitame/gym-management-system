import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { Dumbbell } from "lucide-react-native";

export default function OwnerTrainersScreen() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!organizationId) return;
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("trainers").select("*, gyms(name)").eq("organization_id", organizationId).order("display_name");
      setTrainers(data ?? []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">All Trainers</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {trainers.length === 0 ? <EmptyState icon={<Dumbbell size={48} />} title="No trainers" description="Trainers across all gyms will appear here." />
          : trainers.map((t: any) => (
            <Card key={t.id} variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                  <Text variant="subtitle" color={theme.colors.primary}>{t.display_name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="subtitle">{t.display_name}</Text>
                  <Text variant="caption" muted>{t.specialization ?? "Trainer"} · {t.gyms?.name ?? ""}</Text>
                </View>
                <Badge variant={t.status === "active" ? "success" : "neutral"} label={t.status} size="sm" />
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
