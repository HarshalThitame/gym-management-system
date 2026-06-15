import React from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  type ViewStyle,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

interface ScreenShellProps extends ScrollViewProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  stickyHeader?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ScreenShell({
  title,
  subtitle,
  headerRight,
  padded = true,
  refreshing = false,
  onRefresh,
  stickyHeader,
  footer,
  style,
  children,
  ...props
}: ScreenShellProps) {
  const { theme } = useTheme();

  const contentStyle: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.bg,
  };

  const paddingStyle: ViewStyle = padded
    ? { paddingHorizontal: theme.spacing.lg }
    : {};

  return (
    <SafeAreaView style={contentStyle} edges={["top"]}>
      {(title || subtitle || headerRight || stickyHeader) && (
        <View style={{ backgroundColor: theme.colors.bg }}>
          {stickyHeader}
          {(title || headerRight) && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                {title && <Text variant="h1">{title}</Text>}
                {subtitle && (
                  <Text variant="bodySmall" muted style={{ marginTop: theme.spacing.xs }}>
                    {subtitle}
                  </Text>
                )}
              </View>
              {headerRight && (
                <View style={{ marginLeft: theme.spacing.md }}>{headerRight}</View>
              )}
            </View>
          )}
        </View>
      )}
      <ScrollView
        style={contentStyle}
        contentContainerStyle={[
          paddingStyle,
          { paddingBottom: theme.spacing["6xl"] },
          style as ViewStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          ) : undefined
        }
        {...props}
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            backgroundColor: theme.colors.bg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          {footer}
        </View>
      )}
    </SafeAreaView>
  );
}
