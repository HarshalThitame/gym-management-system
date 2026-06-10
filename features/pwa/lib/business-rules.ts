export const queueableOfflineActionTypes = [
  "workout_log",
  "nutrition_log",
  "profile_update",
  "attendance_check_in",
  "attendance_check_out",
  "class_booking_request"
] as const;

export type QueueableOfflineActionType = (typeof queueableOfflineActionTypes)[number];

export type InstallPlatform = "ios" | "android" | "desktop" | "unsupported";

export function isQueueableOfflineAction(type: string): type is QueueableOfflineActionType {
  return queueableOfflineActionTypes.includes(type as QueueableOfflineActionType);
}

export function getInstallPlatform(userAgent: string, hasStandaloneNavigator = false): InstallPlatform {
  const normalized = userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(normalized) || hasStandaloneNavigator;
  const isAndroid = normalized.includes("android");
  const isChromium = /chrome|crios|edg|samsungbrowser/.test(normalized);
  const isDesktop = /macintosh|windows|linux|cros/.test(normalized) && !isAndroid;

  if (isIos) {
    return "ios";
  }

  if (isAndroid && isChromium) {
    return "android";
  }

  if (isDesktop && isChromium) {
    return "desktop";
  }

  return "unsupported";
}

export function shouldShowInstallPrompt(input: {
  isStandalone: boolean;
  hasDismissedPrompt: boolean;
  platform: InstallPlatform;
  daysSinceDismissed?: number;
}) {
  if (input.isStandalone || input.platform === "unsupported") {
    return false;
  }

  if (!input.hasDismissedPrompt) {
    return true;
  }

  return (input.daysSinceDismissed ?? 0) >= 14;
}

export function isCachedSnapshotFresh(input: { cachedAt: string | null; maxAgeMinutes: number; now?: Date }) {
  if (!input.cachedAt) {
    return false;
  }

  const cachedAt = new Date(input.cachedAt);
  if (Number.isNaN(cachedAt.getTime())) {
    return false;
  }

  const now = input.now ?? new Date();
  const ageMs = now.getTime() - cachedAt.getTime();
  return ageMs >= 0 && ageMs <= input.maxAgeMinutes * 60_000;
}

export function getNetworkStatusMessage(isOnline: boolean, queuedActions: number) {
  if (isOnline && queuedActions > 0) {
    return `${queuedActions} offline ${queuedActions === 1 ? "action is" : "actions are"} ready to sync.`;
  }

  if (isOnline) {
    return "Online and synced.";
  }

  return "Offline. New actions will be saved on this device.";
}
