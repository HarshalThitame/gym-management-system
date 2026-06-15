import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type TouchableOpacityProps,
} from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = "left",
  style,
  children,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();

  const buttonStyle: ViewStyle[] = [
    styles.base,
    size === "sm" && { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
    size === "md" && { paddingVertical: theme.spacing.md + 2, paddingHorizontal: theme.spacing.xl },
    size === "lg" && { paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing["2xl"] },
    fullWidth && { width: "100%" },
    getButtonStyle(variant, theme),
    (disabled || loading) && { opacity: 0.5 },
    style as ViewStyle,
  ].filter(Boolean);

  const textVariant = size === "sm" ? "buttonSmall" : "button";
  const textColor = getTextColor(variant, theme);

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size={size === "sm" ? 16 : 20} />
      ) : (
        <React.Fragment>
          {icon && iconPosition === "left" && icon}
          <Text
            variant={textVariant}
            color={textColor}
            center
            style={icon ? { marginLeft: iconPosition === "left" ? theme.spacing.sm : 0, marginRight: iconPosition === "right" ? theme.spacing.sm : 0 } : undefined}
          >
            {children}
          </Text>
          {icon && iconPosition === "right" && icon}
        </React.Fragment>
      )}
    </TouchableOpacity>
  );
}

function getButtonStyle(variant: ButtonVariant, theme: ReturnType<typeof useTheme>["theme"]): ViewStyle {
  switch (variant) {
    case "primary":
      return {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radii.md,
      };
    case "secondary":
      return {
        backgroundColor: theme.colors.secondary,
        borderRadius: theme.radii.md,
      };
    case "accent":
      return {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radii.lg,
      };
    case "danger":
      return {
        backgroundColor: theme.colors.danger,
        borderRadius: theme.radii.md,
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        borderRadius: theme.radii.md,
      };
    case "outline":
      return {
        backgroundColor: "transparent",
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      };
    default:
      return {};
  }
}

function getTextColor(variant: ButtonVariant, theme: ReturnType<typeof useTheme>["theme"]): string {
  switch (variant) {
    case "primary":
      return theme.colors.primaryFg;
    case "secondary":
      return theme.colors.secondaryFg;
    case "accent":
      return theme.colors.primaryFg;
    case "danger":
      return theme.colors.dangerFg;
    case "ghost":
      return theme.colors.fg;
    case "outline":
      return theme.colors.fg;
    default:
      return theme.colors.fg;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});

export { type ButtonVariant, type ButtonSize, type ButtonProps };
