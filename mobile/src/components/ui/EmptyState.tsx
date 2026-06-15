import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: theme.spacing["6xl"],
        paddingHorizontal: theme.spacing["2xl"],
      }}
    >
      {icon && (
        <View style={{ marginBottom: theme.spacing.lg, opacity: 0.5 }}>
          {icon}
        </View>
      )}
      <Text variant="h4" center>
        {title}
      </Text>
      {description && (
        <Text
          variant="body"
          muted
          center
          style={{ marginTop: theme.spacing.sm, maxWidth: 280 }}
        >
          {description}
        </Text>
      )}
      {action && (
        <Button
          variant="primary"
          size="md"
          onPress={action.onPress}
          style={{ marginTop: theme.spacing["2xl"] }}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
}
