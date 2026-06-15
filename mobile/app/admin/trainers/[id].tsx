import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, User, Users, TrendingUp } from "lucide-react-native";

export default function AdminTrainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState<any>(null);
  const [stats, setStats] = useState({ members: 0, sessions: 0 });

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: t } = await supabase.from("trainers").select("*").eq("id", id).maybeSingle();
      setTrainer(t);
      if (t) {
        const [members, sessions] = await Promise.all([
          supabase.from("trainer_assignments").select("id", { count: "exact", head: true }).eq("trainer_id", id).eq("status", "active"),
          supabase.from("trainer_sessions").select("id", { count: "exact", head: true }).eq("trainer_id", id).gte("session_date", new Date().toISOString().split("T")[0]),
        ]);
        setStats({ members: members.count ?? 0, sessions: sessions.count ?? 0 });
      }
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!trainer) return <Text>Trainer not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">{trainer.display_name}</Text>
        <Badge variant={trainer.status === "active" ? "success" : "neutral"} label={trainer.status} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Assigned Members" value={stats.members} icon={<Users size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Upcoming Sessions" value={stats.sessions} icon={<TrendingUp size={20} />} /></View>
        </View>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <Row label="Specialization" value={trainer.specialization ?? "General"} />
            <Row label="Email" value={trainer.email ?? "N/A"} />
            <Row label="Phone" value={trainer.phone ?? "N/A"} />
            <Row label="Status" value={trainer.status} />
            {trainer.bio && <Row label="Bio" value={trainer.bio} />}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
    <Text variant="body" muted>{label}</Text>
    <Text variant="body" bold style={{ flex: 1, textAlign: "right" }}>{value}</Text>
  </View>;
}
