import React from "react";
import { View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react-native";

export default function TrainerErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center", padding: theme.spacing["2xl"] }}>
      <AlertTriangle size={48} color={theme.colors.danger} />
      <Text variant="h3" center style={{ marginTop: theme.spacing.xl, color: theme.colors.danger }}>Trainer Error</Text>
      <Text variant="body" muted center style={{ marginTop: theme.spacing.sm, maxWidth: 280 }}>{error.message}</Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing["2xl"] }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: theme.spacing.md, backgroundColor: theme.colors.bgSurfaceMuted, borderRadius: theme.radii.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <ArrowLeft size={18} color={theme.colors.fg} /><Text variant="body">Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={reset} style={{ padding: theme.spacing.md, backgroundColor: theme.colors.primary, borderRadius: theme.radii.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <RefreshCw size={18} color={theme.colors.primaryFg} /><Text variant="body" color={theme.colors.primaryFg}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
