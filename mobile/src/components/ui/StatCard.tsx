import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({ label, value, detail, icon, trend, trendValue }: StatCardProps) {
  const { theme } = useTheme();

  return (
    <Card variant="muted" padded>
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text variant="statLabel" muted>{label}</Text>
          {icon && icon}
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: theme.spacing.sm }}>
          <Text variant="stat">{value}</Text>
          {trend && trendValue && (
            <Text
              variant="caption"
              style={{
                color: trend === "up" ? theme.colors.success : trend === "down" ? theme.colors.danger : theme.colors.fgMuted,
              }}
            >
              {trendValue}
            </Text>
          )}
        </View>
        {detail && (
          <Text variant="bodySmall" muted numberOfLines={2}>
            {detail}
          </Text>
        )}
      </View>
    </Card>
  );
}
