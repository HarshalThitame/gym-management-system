import { Platform, Alert } from "react-native";
import * as Application from "expo-application";

export async function isDeviceSecure(): Promise<{ secure: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  if (Platform.OS === "android") {
    try {
      const { default: Device } = await import("expo-device");
      if (Device?.isDevice) {
        if (await isRunningOnEmulator()) warnings.push("Running on emulator/simulator");
      }
    } catch {}
  }

  if (__DEV__) {
    warnings.push("Running in development mode");
  }

  return { secure: warnings.length === 0, warnings };
}

async function isRunningOnEmulator(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") return false;
    const installationId = Application?.androidId;
    if (installationId === "unknown" || installationId === "000000000000000") return true;
    return false;
  } catch { return false; }
}

export function shouldShowSensitiveContent(): boolean {
  if (__DEV__) return true;
  return true;
}
