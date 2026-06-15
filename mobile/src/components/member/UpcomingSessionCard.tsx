import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Calendar, Clock, User } from "lucide-react-native";
import type { TrainerSession, Trainer } from "@/types";

interface UpcomingSessionCardProps {
  session: TrainerSession;
  trainer?: Trainer | null;
}

export function UpcomingSessionCard({ session, trainer }: UpcomingSessionCardProps) {
  const { theme } = useTheme();

  const sessionDate = new Date(session.session_date);
  const isToday = sessionDate.toDateString() === new Date().toDateString();
  const dayName = isToday ? "Today" : sessionDate.toLocaleDateString("en-IN", { weekday: "short" });

  return (
    <Card variant="muted">
      <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
        <View style={{
          width: 48, height: 48, borderRadius: theme.radii.md,
          backgroundColor: theme.colors.primaryMuted,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text variant="caption" color={theme.colors.primary} bold>{dayName}</Text>
          <Text variant="bodySmall" color={theme.colors.primary} bold>
            {sessionDate.getDate()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subtitle">
            {trainer?.display_name ?? "Personal Training"}
          </Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Clock size={12} color={theme.colors.fgMuted} />
              <Text variant="caption" muted>
                {session.starts_at.slice(0, 5)} - {session.ends_at.slice(0, 5)}
              </Text>
            </View>
            {trainer && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <User size={12} color={theme.colors.fgMuted} />
                <Text variant="caption" muted>{trainer.display_name}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}
