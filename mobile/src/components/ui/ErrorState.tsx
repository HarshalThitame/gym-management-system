import React from "react";
import { View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  onGoBack,
}: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: theme.spacing["6xl"],
        paddingHorizontal: theme.spacing["2xl"],
        backgroundColor: theme.colors.bg,
      }}
    >
      <AlertTriangle size={48} color={theme.colors.danger} />
      <Text
        variant="h4"
        center
        style={{ marginTop: theme.spacing.xl, color: theme.colors.danger }}
      >
        {title}
      </Text>
      <Text
        variant="body"
        muted
        center
        style={{ marginTop: theme.spacing.sm, maxWidth: 280 }}
      >
        {message}
      </Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing["2xl"] }}>
        {onGoBack && (
          <Button variant="secondary" onPress={onGoBack}>
            Go Back
          </Button>
        )}
        {onRetry && (
          <Button variant="primary" onPress={onRetry}>
            Try Again
          </Button>
        )}
      </View>
    </View>
  );
}
