import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export function useHaptics() {
  const light = useCallback(() => {
    if (isWeb) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const medium = useCallback(() => {
    if (isWeb) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const heavy = useCallback(() => {
    if (isWeb) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  const success = useCallback(() => {
    if (isWeb) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const error = useCallback(() => {
    if (isWeb) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, []);

  const warning = useCallback(() => {
    if (isWeb) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);

  const selection = useCallback(() => {
    if (isWeb) return;
    Haptics.selectionAsync().catch(() => {});
  }, []);

  return { light, medium, heavy, success, error, warning, selection };
}
