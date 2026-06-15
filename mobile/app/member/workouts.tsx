import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MemberWorkoutsScreen() {
  const { theme } = useTheme();

  return (
    <ScreenShell title="Workouts" subtitle="Your assigned workout programs">
      <View style={{ gap: theme.spacing.lg }}>
        <Card>
          <CardHeader title="Active Program" />
          <CardContent>
            <EmptyState
              title="No workout program"
              description="Your trainer will assign a workout program tailored to your goals."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Today's Log" />
          <CardContent>
            <EmptyState
              title="Nothing logged yet"
              description="Log your sets, reps, and weights after each workout."
            />
          </CardContent>
        </Card>
      </View>
    </ScreenShell>
  );
}
