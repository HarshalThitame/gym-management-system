import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { workoutService } from "@/services/workout-service";
import { getSupabaseClient } from "@/api/supabase";
import { useIsOnline } from "@/hooks/use-network";
import { ArrowLeft, Save, WifiOff } from "lucide-react-native";

export default function WorkoutLogScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ exercise: string; program: string }>();
  const isOnline = useIsOnline();

  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!sets || !reps) {
      Alert.alert("Validation", "Please enter sets and reps.");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (!member) return;

      if (isOnline) {
        const result = await workoutService.logWorkout(member.id, params.program ?? "", params.exercise ?? "", {
          sets: parseInt(sets),
          reps: parseInt(reps),
          weight: weight ? parseFloat(weight) : undefined,
          notes: notes || undefined,
        });
        if (result.ok) {
          Alert.alert("Saved", "Workout logged successfully.", [{ text: "OK", onPress: () => router.back() }]);
        } else {
          Alert.alert("Error", result.error ?? "Failed to save.");
        }
      } else {
        await workoutService.logWorkoutOffline(member.id, params.program ?? "", params.exercise ?? "", {
          sets: parseInt(sets),
          reps: parseInt(reps),
          weight: weight ? parseFloat(weight) : undefined,
          notes: notes || undefined,
        });
        Alert.alert("Queued", "Workout will sync when you're back online.", [{ text: "OK", onPress: () => router.back() }]);
      }
    } catch {
      Alert.alert("Error", "Failed to log workout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text variant="h2">Log Workout</Text>
            <Text variant="bodySmall" muted>{params.exercise}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        {!isOnline && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
            backgroundColor: theme.colors.warningMuted, padding: theme.spacing.md,
            borderRadius: theme.radii.md,
          }}>
            <WifiOff size={16} color={theme.colors.warning} />
            <Text variant="bodySmall" color={theme.colors.warning}>Offline - workout will sync later</Text>
          </View>
        )}

        <Input label="Sets" placeholder="3" keyboardType="number-pad" value={sets} onChangeText={setSets} />
        <Input label="Reps" placeholder="10" keyboardType="number-pad" value={reps} onChangeText={setReps} />
        <Input label="Weight (kg)" placeholder="Optional" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
        <Input label="Notes" placeholder="How did it feel?" multiline numberOfLines={3} value={notes} onChangeText={setNotes} />

        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleSave}>
          <Save size={20} color={theme.colors.primaryFg} /> Save Workout
        </Button>
      </ScrollView>
    </View>
  );
}


