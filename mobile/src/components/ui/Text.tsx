import React from "react";
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type TextVariant = keyof ReturnType<typeof import("@/theme/typography").typography>;

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  bold?: boolean;
  center?: boolean;
  uppercase?: boolean;
  capitalize?: boolean;
  children: React.ReactNode;
}

export function Text({
  variant = "body",
  color,
  muted,
  bold,
  center,
  uppercase,
  capitalize,
  style,
  children,
  ...props
}: TextProps) {
  const { theme } = useTheme();
  const typographyStyle = theme.typography[variant] ?? theme.typography.body;

  const textStyle = [
    typographyStyle,
    {
      color: color ?? (muted ? theme.colors.fgMuted : theme.colors.fg),
    },
    bold && { fontWeight: theme.fontWeight.bold },
    center && { textAlign: "center" as const },
    uppercase && { textTransform: "uppercase" as const },
    capitalize && { textTransform: "capitalize" as const },
    style,
  ];

  return (
    <RNText style={textStyle} {...props}>
      {children}
    </RNText>
  );
}

export function Heading({ children, ...props }: TextProps) {
  return (
    <Text variant="h2" {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, ...props }: TextProps) {
  return (
    <Text variant="caption" muted {...props}>
      {children}
    </Text>
  );
}

export function Overline({ children, ...props }: TextProps) {
  return (
    <Text variant="overline" muted {...props}>
      {children}
    </Text>
  );
}
