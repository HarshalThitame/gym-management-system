import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "info" | "neutral";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  label: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; fg: string }> = {
  primary: { bg: "primaryMuted", fg: "primary" },
  success: { bg: "successMuted", fg: "success" },
  warning: { bg: "warningMuted", fg: "warning" },
  danger: { bg: "dangerMuted", fg: "danger" },
  info: { bg: "infoMuted", fg: "info" },
  neutral: { bg: "bgSurfaceMuted", fg: "fgMuted" },
};

export function Badge({ variant = "neutral", size = "md", label, dot }: BadgeProps) {
  const { theme } = useTheme();
  const v = variantStyles[variant];
  const bgColor = (theme.colors as Record<string, string>)[v.bg];
  const fgColor = (theme.colors as Record<string, string>)[v.fg];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bgColor,
        borderRadius: theme.radii.full,
        paddingHorizontal: size === "sm" ? theme.spacing.sm : theme.spacing.md,
        paddingVertical: size === "sm" ? 2 : 4,
        gap: theme.spacing.xs,
      }}
    >
      {dot && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: fgColor,
          }}
        />
      )}
      <Text
        variant={size === "sm" ? "caption" : "caption"}
        style={{ color: fgColor, fontWeight: theme.fontWeight.bold }}
      >
        {label}
      </Text>
    </View>
  );
}
