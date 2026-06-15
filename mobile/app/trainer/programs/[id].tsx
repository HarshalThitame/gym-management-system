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
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Dumbbell, Clock, Users } from "lucide-react-native";

export default function TrainerProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: p } = await supabase.from("workout_programs").select("*, members(full_name)").eq("id", id).maybeSingle();
      setProgram(p);
      if (p) {
        const { data: exs } = await supabase.from("program_exercises").select("*").eq("program_id", id).order("day_of_week").order("sort_order");
        setExercises(exs ?? []);
      }
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!program) return <Text>Program not found</Text>;

  const grouped = exercises.reduce<Record<number, any[]>>((acc, ex) => {
    const day = ex.day_of_week ?? 0;
    if (!acc[day]) acc[day] = [];
    acc[day].push(ex);
    return acc;
  }, {});

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{program.name}</Text>
          <Text variant="caption" muted>{(program as any).members?.full_name ?? "Member"}</Text>
        </View>
        <Badge variant={program.status === "active" ? "success" : "neutral"} label={program.status} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {Object.entries(grouped).map(([day, dayExs]) => (
          <View key={day} style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">{dayNames[parseInt(day)]}</Text>
            {dayExs.map((ex, i) => (
              <Card key={i} variant="muted">
                <CardContent style={{ gap: theme.spacing.xs }}>
                  <Text variant="subtitle">{ex.exercise_name}</Text>
                  <Text variant="caption" muted>{ex.sets} sets × {ex.reps} reps{ex.weight ? ` @ ${ex.weight}kg` : ""}</Text>
                </CardContent>
              </Card>
            ))}
          </View>
        ))}
        {exercises.length === 0 && <EmptyState title="No exercises" description="Add exercises to this program." />}
      </ScrollView>
    </View>
  );
}
