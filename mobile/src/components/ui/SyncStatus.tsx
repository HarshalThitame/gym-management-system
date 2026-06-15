import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { RefreshCw, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react-native";

export function SyncStatus() {
  const { theme } = useTheme();
  const { isOnline, queueStatus, hasPendingItems, hasFailedItems, lastSyncAt, manualSync } = useOfflineSync();

  const statusColor = !isOnline ? theme.colors.danger : hasFailedItems ? theme.colors.warning : theme.colors.success;
  const StatusIcon = !isOnline ? WifiOff : hasFailedItems ? AlertCircle : CheckCircle2;

  return (
    <TouchableOpacity
      onPress={manualSync}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
      }}
    >
      <StatusIcon size={14} color={statusColor} />
      <Text variant="caption" style={{ color: statusColor, fontSize: 10 }}>
        {!isOnline ? "Offline" : hasPendingItems ? `${queueStatus.total} pending` : "Synced"}
      </Text>
      {hasPendingItems && isOnline && (
        <RefreshCw size={12} color={theme.colors.fgMuted} />
      )}
    </TouchableOpacity>
  );
}
