import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { dietService } from "@/services/diet-service";
import { ArrowLeft, Apple } from "lucide-react-native";
import { getSupabaseClient } from "@/api/supabase";

export default function DietDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [meals, setMeals] = useState<any[]>([]);

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: p } = await supabase.from("nutrition_plans").select("*").eq("id", id).maybeSingle();
      setPlan(p);
      if (p) {
        const m = await dietService.getMeals(p.id);
        setMeals(m);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">{plan?.name ?? "Diet Plan"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {plan?.description && <Text variant="body" muted>{plan.description}</Text>}
        {plan?.daily_calories && <Text variant="body">Target: {plan.daily_calories} cal/day</Text>}

        {meals.map((meal, i) => (
          <Card key={i} variant="muted">
            <CardContent style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                <Apple size={16} color={theme.colors.primary} />
                <Text variant="subtitle">{meal.meal_type}</Text>
              </View>
              <Text variant="bodySmall" muted>{meal.description}</Text>
              {meal.calories && <Text variant="caption">{meal.calories} calories</Text>}
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
