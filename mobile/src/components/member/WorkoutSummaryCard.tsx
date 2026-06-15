import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Dumbbell, ChevronRight } from "lucide-react-native";

interface WorkoutSummaryCardProps {
  activePrograms: number;
  completedToday: number;
  streak: number;
  onPress: () => void;
}

export function WorkoutSummaryCard({ activePrograms, completedToday, streak, onPress }: WorkoutSummaryCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="muted">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: theme.colors.primaryMuted,
              alignItems: "center", justifyContent: "center",
            }}>
              <Dumbbell size={22} color={theme.colors.primary} />
            </View>
            <View>
              <Text variant="subtitle">{activePrograms > 0 ? "Active Program" : "No Program"}</Text>
              <Text variant="bodySmall" muted>
                {activePrograms > 0
                  ? `${completedToday} done today · ${streak} day streak`
                  : "Ask your trainer for a workout plan"}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={theme.colors.fgMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}
