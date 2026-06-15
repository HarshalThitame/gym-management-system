import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { dietService } from "@/services/diet-service";
import { ArrowLeft, Save } from "lucide-react-native";
import { getSupabaseClient } from "@/api/supabase";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-Workout", "Post-Workout"];

export default function MealLogScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [mealType, setMealType] = useState("Breakfast");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const ok = await dietService.logMeal(member.id, {
          meal_type: mealType,
          calories: calories ? parseFloat(calories) : undefined,
          protein: protein ? parseFloat(protein) : undefined,
          carbs: carbs ? parseFloat(carbs) : undefined,
          fat: fat ? parseFloat(fat) : undefined,
          notes: notes || undefined,
        });
        if (ok) {
          Alert.alert("Logged", "Meal logged successfully.", [{ text: "OK", onPress: () => router.back() }]);
        } else {
          Alert.alert("Error", "Failed to log meal.");
        }
      }
    } catch {
      Alert.alert("Error", "Failed to log meal.");
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
          <Text variant="h2">Log Meal</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {MEAL_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setMealType(type)}
              style={{
                paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.full,
                backgroundColor: mealType === type ? theme.colors.primary : theme.colors.bgSurfaceMuted,
              }}
            >
              <Text variant="caption" color={mealType === type ? theme.colors.primaryFg : theme.colors.fg}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input label="Calories" placeholder="450" keyboardType="decimal-pad" value={calories} onChangeText={setCalories} />
        <Input label="Protein (g)" placeholder="25" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} />
        <Input label="Carbs (g)" placeholder="50" keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} />
        <Input label="Fat (g)" placeholder="15" keyboardType="decimal-pad" value={fat} onChangeText={setFat} />
        <Input label="Notes" placeholder="What did you eat?" multiline numberOfLines={3} value={notes} onChangeText={setNotes} />

        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleSave}>
          <Save size={20} color={theme.colors.primaryFg} /> Log Meal
        </Button>
      </ScrollView>
    </View>
  );
}
