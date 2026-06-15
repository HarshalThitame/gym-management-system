import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Save, Dumbbell } from "lucide-react-native";

export default function AddProgramScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) { Alert.alert("Validation", "Program name is required."); return; }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) { Alert.alert("Error", "Trainer profile not found."); return; }

      const { error } = await supabase.from("workout_programs").insert({
        gym_id: profile?.gym_id,
        trainer_id: trainer.id,
        name,
        description: description || null,
        status: "active",
        start_date: new Date().toISOString().split("T")[0],
      });
      if (error) { Alert.alert("Error", error.message); } else {
        Alert.alert("Created", "Workout program created. Add exercises from the program detail screen.", [{ text: "OK", onPress: () => router.back() }]);
      }
    } catch { Alert.alert("Error", "Failed to create program."); } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Create Program</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.lg }}>
            <Input label="Program Name *" value={name} onChangeText={setName} />
            <Input label="Description" multiline numberOfLines={3} value={description} onChangeText={setDescription} />
          </CardContent>
        </Card>
        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleSave}>
          <Dumbbell size={20} color={theme.colors.primaryFg} /> Create Program
        </Button>
      </ScrollView>
    </View>
  );
}
