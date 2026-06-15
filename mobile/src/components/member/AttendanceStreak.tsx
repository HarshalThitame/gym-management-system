import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Flame, CalendarCheck } from "lucide-react-native";

interface AttendanceStreakProps {
  currentStreak: number;
  todayCheckedIn: boolean;
  monthlyPercent: number;
  totalThisMonth: number;
}

export function AttendanceStreak({ currentStreak, todayCheckedIn, monthlyPercent, totalThisMonth }: AttendanceStreakProps) {
  const { theme } = useTheme();

  return (
    <Card variant="muted">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <Flame size={24} color={currentStreak > 0 ? theme.colors.primary : theme.colors.fgMuted} />
          <View>
            <Text variant="stat" color={currentStreak > 0 ? theme.colors.primary : theme.colors.fgMuted}>
              {currentStreak}
            </Text>
            <Text variant="caption" muted>Day Streak</Text>
          </View>
        </View>

        <View style={{ alignItems: "center" }}>
          <CalendarCheck size={20} color={todayCheckedIn ? theme.colors.success : theme.colors.fgMuted} />
          <Text variant="caption" muted style={{ marginTop: 4 }}>
            {todayCheckedIn ? "Checked In" : "Not yet"}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text variant="stat">{monthlyPercent}%</Text>
          <Text variant="caption" muted>This Month</Text>
        </View>
      </View>
    </Card>
  );
}
