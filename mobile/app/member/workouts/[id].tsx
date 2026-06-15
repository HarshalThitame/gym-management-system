import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Image, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { getSupabaseClient } from "@/api/supabase";
import { workoutService } from "@/services/workout-service";
import { ArrowLeft, Dumbbell, Play, Image as ImageIcon } from "lucide-react-native";

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);
  const [program, setProgram] = useState<any>(null);

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: prog } = await supabase.from("workout_programs").select("*").eq("id", id).maybeSingle();
      setProgram(prog);
      const exs = await workoutService.getProgramExercises(id);
      setExercises(exs);
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const grouped = exercises.reduce<Record<number, any[]>>((acc, ex) => {
    const day = ex.day_of_week ?? 0;
    if (!acc[day]) acc[day] = [];
    acc[day].push(ex);
    return acc;
  }, {});

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">{program?.name ?? "Workout Program"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {Object.entries(grouped).map(([day, dayExs]) => (
          <View key={day} style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Dumbbell size={16} color={theme.colors.primary} />
              <Text variant="h4">{dayNames[parseInt(day)]}</Text>
            </View>
            {dayExs.map((ex, i) => (
              <Card key={i} variant="muted">
                <CardContent style={{ gap: theme.spacing.xs }}>
                  <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
                    {ex.image_url && (
                      <Image source={{ uri: ex.image_url }} style={{ width: 60, height: 60, borderRadius: theme.radii.md }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text variant="subtitle">{ex.exercise_name}</Text>
                      <Text variant="bodySmall" muted>
                        {ex.sets} sets × {ex.reps} reps
                        {ex.weight ? ` @ ${ex.weight}kg` : ""}
                        {ex.rest_seconds ? ` · Rest ${ex.rest_seconds}s` : ""}
                      </Text>
                    </View>
                  </View>
                  {ex.notes && <Text variant="bodySmall" muted>{ex.notes}</Text>}
                  {ex.instruction_video_url && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(ex.instruction_video_url)}
                      style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingVertical: 4 }}
                    >
                      <Play size={14} color={theme.colors.primary} />
                      <Text variant="caption" color={theme.colors.primary}>Watch instruction video</Text>
                    </TouchableOpacity>
                  )}
                  <Button
                    variant="primary" size="sm"
                    onPress={() => router.push(`/member/workouts/log?exercise=${ex.exercise_name}&program=${id}`)}
                    style={{ marginTop: theme.spacing.xs }}
                  >
                    Log Set
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}


