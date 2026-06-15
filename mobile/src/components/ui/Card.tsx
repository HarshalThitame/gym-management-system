import React from "react";
import { View, type ViewStyle, type ViewProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

interface CardProps extends ViewProps {
  variant?: "default" | "muted" | "outline" | "elevated";
  padded?: boolean;
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  padded = true,
  style,
  children,
  ...props
}: CardProps) {
  const { theme } = useTheme();

  const cardStyle: ViewStyle[] = [
    {
      backgroundColor: getBackgroundColor(variant, theme),
      borderRadius: theme.radii.lg,
      borderWidth: variant === "outline" ? 1 : 0,
      borderColor: variant === "outline" ? theme.colors.border : undefined,
    },
    variant === "elevated" && theme.shadows.md,
    padded && { padding: theme.spacing.lg },
    style as ViewStyle,
  ];

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

interface CardHeaderProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export function CardHeader({ title, description, action, children }: CardHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      {children ?? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            {title && <Text variant="h4">{title}</Text>}
            {description && (
              <Text variant="bodySmall" muted style={{ marginTop: theme.spacing.xs }}>
                {description}
              </Text>
            )}
          </View>
          {action && <View style={{ marginLeft: theme.spacing.md }}>{action}</View>}
        </View>
      )}
    </View>
  );
}

export function CardContent({ children, style, ...props }: ViewProps) {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
}

function getBackgroundColor(variant: string, theme: ReturnType<typeof useTheme>["theme"]): string {
  switch (variant) {
    case "default":
      return theme.colors.bgSurface;
    case "muted":
      return theme.colors.bgSurfaceMuted;
    case "outline":
      return theme.colors.bgSurface;
    case "elevated":
      return theme.colors.bgSurface;
    default:
      return theme.colors.bgSurface;
  }
}
