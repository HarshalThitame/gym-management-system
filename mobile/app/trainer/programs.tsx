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
import { getSupabaseClient } from "@/api/supabase";
import { Dumbbell, Plus, ChevronRight, Apple } from "lucide-react-native";

export default function TrainerProgramsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);

  useEffect(() => { loadPrograms(); }, []);

  const loadPrograms = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) return;

      const { data } = await supabase
        .from("workout_programs")
        .select("*, members(full_name, member_code)")
        .eq("trainer_id", trainer.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setPrograms(data ?? []);
    } catch {} finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="h2">Programs</Text>
        <TouchableOpacity onPress={() => router.push("/trainer/programs/add")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Plus size={22} color={theme.colors.primaryFg} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPrograms} tintColor={theme.colors.primary} />}>
        {programs.length === 0 ? <EmptyState icon={<Dumbbell size={48} />} title="No programs yet" description="Create workout programs for your assigned members." action={{ label: "Create Program", onPress: () => router.push("/trainer/programs/add") }} />
          : programs.map((p: any) => (
            <TouchableOpacity key={p.id} activeOpacity={0.7} onPress={() => router.push(`/trainer/programs/${p.id}`)}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    {p.type === "diet" ? <Apple size={22} color={theme.colors.primary} /> : <Dumbbell size={22} color={theme.colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{p.name}</Text>
                    <Text variant="caption" muted>{p.members?.full_name ?? "Member"} · {p.status}</Text>
                  </View>
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
