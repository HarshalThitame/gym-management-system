import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MemberClassesScreen() {
  const { theme } = useTheme();

  return (
    <ScreenShell title="Classes" subtitle="Book and manage your classes">
      <View style={{ gap: theme.spacing.lg }}>
        <Card>
          <CardHeader title="Upcoming Classes" />
          <CardContent>
            <EmptyState
              title="No classes booked"
              description="Browse the schedule and book a class that fits your routine."
              action={{ label: "Browse Schedule", onPress: () => {} }}
            />
          </CardContent>
        </Card>
      </View>
    </ScreenShell>
  );
}
