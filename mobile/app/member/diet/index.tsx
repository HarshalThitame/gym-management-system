import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { dietService } from "@/services/diet-service";
import { Apple, Droplets, Plus, ChevronRight, Flame, Beef, Wheat, Droplet } from "lucide-react-native";
import type { NutritionPlan } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function DietScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [meals, setMeals] = useState<any[]>([]);
  const [nutrition, setNutrition] = useState({ water_ml: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [waterToAdd, setWaterToAdd] = useState(250);

  useEffect(() => {
    loadDiet();
  }, []);

  const loadDiet = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const p = await dietService.getActivePlan(member.id);
        setPlan(p);
        if (p) {
          const m = await dietService.getMeals(p.id);
          setMeals(m);
        }
        const n = await dietService.getTodayNutrition(member.id);
        setNutrition(n);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const addWater = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        await dietService.logWaterIntake(member.id, waterToAdd);
        setNutrition((prev) => ({ ...prev, water_ml: prev.water_ml + waterToAdd }));
      }
    } catch {}
  };

  if (loading) return <LoadingState fullScreen />;

  const waterPercent = Math.min(100, Math.round((nutrition.water_ml / 3000) * 100));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Diet & Nutrition</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="caption" muted uppercase>Daily Nutrition</Text>
              <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
                <Nutrient icon={<Flame size={14} color="#ef4444" />} label="Cal" value={nutrition.calories} />
                <Nutrient icon={<Beef size={14} color="#3b82f6" />} label="P" value={nutrition.protein} />
                <Nutrient icon={<Wheat size={14} color="#f59e0b" />} label="C" value={nutrition.carbs} />
                <Nutrient icon={<Droplet size={14} color="#22c55e" />} label="F" value={nutrition.fat} />
              </View>
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                  <Droplets size={16} color="#3b82f6" />
                  <Text variant="bodySmall">Water</Text>
                </View>
                <Text variant="bodySmall">{nutrition.water_ml} / 3000 ml</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.border, overflow: "hidden" }}>
                <View style={{ width: `${waterPercent}%`, height: "100%", backgroundColor: "#3b82f6", borderRadius: 4 }} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              {[100, 250, 500].map((ml) => (
                <TouchableOpacity
                  key={ml}
                  onPress={() => { setWaterToAdd(ml); addWater(); }}
                  style={{
                    flex: 1, padding: theme.spacing.sm,
                    backgroundColor: theme.colors.bgSurface,
                    borderRadius: theme.radii.md,
                    alignItems: "center",
                    borderWidth: ml === waterToAdd ? 1 : 0,
                    borderColor: theme.colors.primary,
                  }}
                >
                  <Text variant="caption">+{ml}ml</Text>
                </TouchableOpacity>
              ))}
            </View>
          </CardContent>
        </Card>

        {!plan ? (
          <EmptyState title="No Diet Plan" description="Your trainer can assign a personalized nutrition plan." />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">{plan.name}</Text>
            {plan.description && <Text variant="body" muted>{plan.description}</Text>}

            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" muted uppercase>Meal Schedule</Text>
              {meals.length === 0 ? (
                <Text variant="bodySmall" muted>No meals defined yet.</Text>
              ) : (
                meals.map((meal, i) => (
                  <Card key={i} variant="muted">
                    <CardContent style={{ gap: theme.spacing.xs }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text variant="subtitle">{meal.meal_type}</Text>
                        <Text variant="bodySmall" muted>{meal.meal_time?.slice(0, 5) ?? ""}</Text>
                      </View>
                      <Text variant="bodySmall" muted>{meal.description}</Text>
                      <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: 4 }}>
                        {meal.calories && <Text variant="caption">{meal.calories} cal</Text>}
                        {meal.protein && <Text variant="caption">{meal.protein}g protein</Text>}
                      </View>
                    </CardContent>
                  </Card>
                ))
              )}
            </View>
          </View>
        )}

        <Button variant="secondary" fullWidth onPress={() => router.push("/member/diet/meal-log")}>
          <Plus size={18} /> Log Meal
        </Button>
      </ScrollView>
    </View>
  );
}

function Nutrient({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      {icon}
      <Text style={{ fontSize: 10, fontWeight: "600", marginTop: 2 }}>{value}{label}</Text>
    </View>
  );
}
