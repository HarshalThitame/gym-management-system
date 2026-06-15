import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { workoutService } from "@/services/workout-service";
import { Dumbbell, ChevronRight, Clock, TrendingUp, Plus } from "lucide-react-native";
import type { WorkoutProgram } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function WorkoutsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [todayExercises, setTodayExercises] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      const supabase = getSupabaseClient();
      const uid = profile?.id;
      if (!uid) return;
      const { data: member } = await supabase.from("members").select("id").eq("user_id", uid).maybeSingle();
      if (member) {
        const progs = await workoutService.getActivePrograms(member.id);
        setPrograms(progs);
        setStreak(await workoutService.getWorkoutStreak(member.id));

        if (progs.length > 0 && progs[0]) {
          const exercises = await workoutService.getProgramExercises(progs[0].id);
          const dayOfWeek = new Date().getDay();
          setTodayExercises(exercises.filter((e: any) => e.day_of_week === dayOfWeek));
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Workouts</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
            <View style={{ alignItems: "center" }}>
              <Text variant="stat">{streak}</Text>
              <Text variant="caption" muted>Day Streak</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: theme.colors.border }} />
            <View style={{ alignItems: "center" }}>
              <Text variant="stat">{programs.length}</Text>
              <Text variant="caption" muted>Programs</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: theme.colors.border }} />
            <View style={{ alignItems: "center" }}>
              <Text variant="stat">{todayExercises.length}</Text>
              <Text variant="caption" muted>Today</Text>
            </View>
          </CardContent>
        </Card>

        {todayExercises.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Today's Exercises</Text>
            {todayExercises.map((ex, i) => (
              <Card key={i} variant="muted">
                <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{ex.exercise_name}</Text>
                    <Text variant="bodySmall" muted>
                      {ex.sets} sets × {ex.reps} reps{ex.weight ? ` @ ${ex.weight}kg` : ""}
                    </Text>
                  </View>
                  <Button variant="primary" size="sm" onPress={() => router.push(`/member/workouts/log?exercise=${ex.exercise_name}&program=${programs[0]?.id}`)}>
                    Log
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h4">Active Programs</Text>
          {programs.length === 0 ? (
            <EmptyState
              title="No workout programs"
              description="Your trainer will assign a program tailored to your goals."
            />
          ) : (
            programs.map((program) => (
              <TouchableOpacity key={program.id} activeOpacity={0.7} onPress={() => router.push(`/member/workouts/${program.id}`)}>
                <Card variant="muted">
                  <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, flex: 1 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                        <Dumbbell size={22} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="subtitle">{program.name}</Text>
                        <Text variant="bodySmall" muted>
                          {program.start_date ? new Date(program.start_date).toLocaleDateString() : "No start date"}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={theme.colors.fgMuted} />
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h4">History</Text>
          <TouchableOpacity onPress={() => {}}>
            <Card variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <Clock size={20} color={theme.colors.fgMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="subtitle">Past Workouts</Text>
                  <Text variant="bodySmall" muted>View your workout history and progress</Text>
                </View>
                <ChevronRight size={20} color={theme.colors.fgMuted} />
              </CardContent>
            </Card>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
