import { useCallback } from "react";
import { AccessibilityInfo, Platform } from "react-native";

const isWeb = Platform.OS === "web";

export function useAccessibility() {
  const announceForAccessibility = useCallback((message: string) => {
    if (isWeb) return;
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const isScreenReaderEnabled = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;
    return AccessibilityInfo.isScreenReaderEnabled();
  }, []);

  return {
    announceForAccessibility,
    isScreenReaderEnabled,
    accessibilityProps: (label: string, hint?: string) => ({
      accessible: true,
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: "button" as const,
    }),
    accessibilityLabel: (label: string) => ({
      accessible: true,
      accessibilityLabel: label,
    }),
  };
}
