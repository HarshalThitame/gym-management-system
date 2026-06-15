import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { Activity, Dumbbell, TrendingUp } from "lucide-react-native";

export default function AdminFitnessScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ workouts: 0, goals: 0 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!profile?.gym_id) return;
      const supabase = getSupabaseClient();
      const [workouts, goals] = await Promise.all([
        supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("logged_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("fitness_goals").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).eq("status", "active"),
      ]);
      setStats({ workouts: workouts.count ?? 0, goals: goals.count ?? 0 });
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Fitness Tracking</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="30d Workouts" value={stats.workouts} icon={<Dumbbell size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Active Goals" value={stats.goals} icon={<Activity size={20} />} /></View>
        </View>
        <EmptyState icon={<Activity size={48} />} title="Fitness overview" description="Member workout logs, fitness goals, and progress tracking across your gym." />
      </ScrollView>
    </View>
  );
}
