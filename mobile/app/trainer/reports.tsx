import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { BarChart3, Users, Calendar, Dumbbell } from "lucide-react-native";

export default function TrainerReportsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ members: 0, sessions: 0, workouts: 0 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) return;
      const [members, sessions, workouts] = await Promise.all([
        supabase.from("trainer_assignments").select("id", { count: "exact", head: true }).eq("trainer_id", trainer.id).eq("status", "active"),
        supabase.from("trainer_sessions").select("id", { count: "exact", head: true }).eq("trainer_id", trainer.id).gte("session_date", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("trainer_id", trainer.id).gte("logged_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      setStats({ members: members.count ?? 0, sessions: sessions.count ?? 0, workouts: workouts.count ?? 0 });
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">My Reports</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Assigned Members" value={stats.members} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="30d Sessions" value={stats.sessions} icon={<Calendar size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="30d Workouts" value={stats.workouts} icon={<Dumbbell size={20} />} /></View>
        </View>
      </ScrollView>
    </View>
  );
}
