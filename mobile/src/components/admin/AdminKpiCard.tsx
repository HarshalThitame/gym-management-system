import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";

interface AdminKpiCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ReactNode;
  trend?: { value: string; up: boolean };
  onPress?: () => void;
}

export function AdminKpiCard({ label, value, detail, icon, trend, onPress }: AdminKpiCardProps) {
  const { theme } = useTheme();

  const content = (
    <View style={{
      backgroundColor: theme.colors.bgSurface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text variant="caption" muted uppercase>{label}</Text>
        {icon && <View style={{ opacity: 0.6 }}>{icon}</View>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: theme.spacing.sm }}>
        <Text variant="stat">{value}</Text>
        {trend && (
          <Text
            variant="caption"
            color={trend.up ? theme.colors.success : theme.colors.danger}
          >
            {trend.value}
          </Text>
        )}
      </View>
      {detail && <Text variant="bodySmall" muted numberOfLines={2}>{detail}</Text>}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
  }
  return content;
}

export function AdminKpiRow({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
      {children}
    </View>
  );
}

export function AdminKpiItem({ children, flex = 1 }: { children: React.ReactNode; flex?: number }) {
  return <View style={{ flex, minWidth: "45%" }}>{children}</View>;
}
