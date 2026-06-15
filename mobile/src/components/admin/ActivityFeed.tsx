import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Clock, UserPlus, CreditCard, CalendarCheck, Dumbbell } from "lucide-react-native";
import type { ActivityEvent } from "@/types";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  member_created: <UserPlus size={16} />,
  payment_received: <CreditCard size={16} />,
  check_in: <CalendarCheck size={16} />,
  membership_renewed: <CreditCard size={16} />,
  session_completed: <Dumbbell size={16} />,
};

interface ActivityFeedProps {
  activities: ActivityEvent[];
  maxItems?: number;
}

export function ActivityFeed({ activities, maxItems = 10 }: ActivityFeedProps) {
  const { theme } = useTheme();

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader title="Recent Activity" />
        <CardContent>
          <EmptyState title="No recent activity" description="Activity will appear here as members check in and transactions occur." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Recent Activity" />
      <CardContent style={{ gap: theme.spacing.sm }}>
        {activities.slice(0, maxItems).map((event) => (
          <View key={event.id} style={{
            flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderBottomWidth: 1, borderBottomColor: theme.colors.border,
          }}>
            <View style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: theme.colors.bgSurfaceMuted,
              alignItems: "center", justifyContent: "center",
            }}>
              {ACTIVITY_ICONS[event.event_type] ?? <Clock size={16} color={theme.colors.fgMuted} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodySmall">{event.event_type.replace(/_/g, " ")}</Text>
              <Text variant="caption" muted>
                {new Date(event.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}
