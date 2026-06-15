import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  size?: "small" | "large";
}

export function LoadingState({
  message = "Loading...",
  fullScreen = false,
  size = "large",
}: LoadingStateProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: fullScreen ? 0 : theme.spacing["6xl"],
        gap: theme.spacing.lg,
      }}
    >
      <ActivityIndicator size={size} color={theme.colors.primary} />
      <Text variant="body" muted center>
        {message}
      </Text>
    </View>
  );

  if (fullScreen) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.bg,
        }}
      >
        {content}
      </View>
    );
  }

  return content;
}
