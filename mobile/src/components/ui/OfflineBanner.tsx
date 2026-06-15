import React, { useEffect, useRef } from "react";
import { View, Animated, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { Wifi, WifiOff, RefreshCw, CloudOff, Cloud } from "lucide-react-native";

interface OfflineBannerProps {
  showSyncButton?: boolean;
}

export function OfflineBanner({ showSyncButton = true }: OfflineBannerProps) {
  const { theme } = useTheme();
  const { isOnline, queueStatus, hasPendingItems, hasFailedItems, manualSync } = useOfflineSync();
  const slideAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: (!isOnline || hasFailedItems) ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, hasFailedItems]);

  if (isOnline && !hasPendingItems && !hasFailedItems) return null;

  const bannerHeight = 40;

  return (
    <Animated.View style={{
      transform: [{ translateY: slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -bannerHeight],
      }) }],
      height: bannerHeight,
      backgroundColor: !isOnline ? theme.colors.danger : hasFailedItems ? theme.colors.warning : theme.colors.info,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    }}>
      {!isOnline ? (
        <WifiOff size={14} color="#fff" />
      ) : hasFailedItems ? (
        <CloudOff size={14} color="#fff" />
      ) : (
        <Cloud size={14} color="#fff" />
      )}
      <Text variant="caption" style={{ color: "#fff", flex: 1 }}>
        {!isOnline ? "You are offline. Changes will sync when connected." :
         hasFailedItems ? `${queueStatus.failed} items failed to sync.` :
         `Syncing ${queueStatus.total} items...`}
      </Text>
      {showSyncButton && (hasFailedItems || hasPendingItems) && isOnline && (
        <TouchableOpacity onPress={manualSync} style={{ padding: 4 }}>
          <RefreshCw size={14} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
