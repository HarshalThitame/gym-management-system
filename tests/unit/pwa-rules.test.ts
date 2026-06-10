import { describe, expect, it } from "vitest";
import {
  getInstallPlatform,
  getNetworkStatusMessage,
  isCachedSnapshotFresh,
  isQueueableOfflineAction,
  shouldShowInstallPrompt
} from "@/features/pwa/lib/business-rules";

describe("PWA business rules", () => {
  it("detects major install platforms", () => {
    expect(getInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)")).toBe("ios");
    expect(getInstallPlatform("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Mobile")).toBe("android");
    expect(getInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/125.0")).toBe("desktop");
  });

  it("blocks install prompts for standalone and recently dismissed sessions", () => {
    expect(shouldShowInstallPrompt({ isStandalone: true, hasDismissedPrompt: false, platform: "android" })).toBe(false);
    expect(shouldShowInstallPrompt({ isStandalone: false, hasDismissedPrompt: true, platform: "android", daysSinceDismissed: 4 })).toBe(false);
    expect(shouldShowInstallPrompt({ isStandalone: false, hasDismissedPrompt: true, platform: "android", daysSinceDismissed: 14 })).toBe(true);
  });

  it("validates queueable offline actions", () => {
    expect(isQueueableOfflineAction("workout_log")).toBe(true);
    expect(isQueueableOfflineAction("nutrition_log")).toBe(true);
    expect(isQueueableOfflineAction("payment_capture")).toBe(false);
  });

  it("calculates cached snapshot freshness", () => {
    const now = new Date("2026-06-10T10:00:00.000Z");
    expect(isCachedSnapshotFresh({ cachedAt: "2026-06-10T09:45:00.000Z", maxAgeMinutes: 30, now })).toBe(true);
    expect(isCachedSnapshotFresh({ cachedAt: "2026-06-10T09:00:00.000Z", maxAgeMinutes: 30, now })).toBe(false);
    expect(isCachedSnapshotFresh({ cachedAt: "not-a-date", maxAgeMinutes: 30, now })).toBe(false);
  });

  it("creates concise network status messages", () => {
    expect(getNetworkStatusMessage(false, 0)).toBe("Offline. New actions will be saved on this device.");
    expect(getNetworkStatusMessage(true, 1)).toBe("1 offline action is ready to sync.");
    expect(getNetworkStatusMessage(true, 3)).toBe("3 offline actions are ready to sync.");
  });
});
