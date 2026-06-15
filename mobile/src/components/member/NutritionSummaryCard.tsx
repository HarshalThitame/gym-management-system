import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Apple, ChevronRight, Droplets } from "lucide-react-native";

interface NutritionSummaryCardProps {
  hasActivePlan: boolean;
  waterMl: number;
  caloriesToday: number;
  waterGoal?: number;
  onPress: () => void;
}

export function NutritionSummaryCard({ hasActivePlan, waterMl, caloriesToday, waterGoal = 3000, onPress }: NutritionSummaryCardProps) {
  const { theme } = useTheme();
  const waterPercent = Math.min(100, Math.round((waterMl / waterGoal) * 100));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="muted">
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Apple size={20} color={theme.colors.primary} />
              <Text variant="subtitle">{hasActivePlan ? "Diet Plan Active" : "No Diet Plan"}</Text>
            </View>
            <ChevronRight size={20} color={theme.colors.fgMuted} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
            <Droplets size={16} color="#3b82f6" />
            <View style={{ flex: 1 }}>
              <View style={{
                height: 6, borderRadius: 3,
                backgroundColor: theme.colors.border,
                overflow: "hidden",
              }}>
                <View style={{
                  width: `${waterPercent}%`, height: "100%",
                  backgroundColor: "#3b82f6",
                  borderRadius: 3,
                }} />
              </View>
            </View>
            <Text variant="caption">{waterMl} / {waterGoal} ml</Text>
          </View>

          <Text variant="bodySmall" muted>
            {caloriesToday > 0 ? `${caloriesToday} calories logged today` : "No meals logged yet today"}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
