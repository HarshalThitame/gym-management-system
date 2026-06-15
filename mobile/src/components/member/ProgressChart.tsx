import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import type { FitnessProgress } from "@/types";

interface ProgressChartProps {
  data: FitnessProgress[];
  metric: "weight_kg" | "body_fat_percentage" | "chest_cm" | "waist_cm";
  label: string;
  unit: string;
}

export function ProgressChart({ data, metric, label, unit }: ProgressChartProps) {
  const { theme } = useTheme();
  const values = data
    .filter((d) => d[metric] != null)
    .slice(0, 12)
    .reverse();

  if (values.length === 0) {
    return (
      <Card variant="muted">
        <Text variant="bodySmall" muted center style={{ padding: theme.spacing.lg }}>
          No {label.toLowerCase()} data recorded yet.
        </Text>
      </Card>
    );
  }

  const latest = values[values.length - 1]?.[metric] ?? 0;
  const first = values[0]?.[metric] ?? 0;
  const change = latest - first;
  const isImprovement = metric === "body_fat_percentage" || metric === "waist_cm" ? change < 0 : change > 0;

  const maxVal = Math.max(...values.map((v) => v[metric] ?? 0));
  const minVal = Math.min(...values.map((v) => v[metric] ?? 0));
  const range = maxVal - minVal || 1;

  return (
    <Card variant="muted">
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="caption" muted uppercase>{label}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Text variant="h3">{latest}{unit}</Text>
            {change !== 0 && (
              <Text
                variant="caption"
                color={isImprovement ? theme.colors.success : theme.colors.danger}
              >
                {change > 0 ? "+" : ""}{change.toFixed(1)}{unit}
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 120, justifyContent: "flex-end", gap: 2 }}>
          {values.map((v, i) => {
            const val = v[metric] ?? 0;
            const height = Math.max(8, ((val - minVal) / range) * 100);
            return (
              <View
                key={i}
                style={{
                  height: 2,
                  backgroundColor: theme.colors.primaryMuted,
                  borderRadius: 1,
                  marginLeft: `${(i / (values.length - 1)) * 80}%`,
                  width: `${20}%`,
                }}
              />
            );
          })}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="caption" muted>
            {values.length > 0 ? new Date(values[0]?.recorded_at ?? "").toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
          </Text>
          <Text variant="caption" muted>
            {values.length > 1 ? new Date(values[values.length - 1]?.recorded_at ?? "").toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
          </Text>
        </View>
      </View>
    </Card>
  );
}
