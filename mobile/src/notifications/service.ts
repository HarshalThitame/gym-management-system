import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiClient } from "@/api/client";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";
import { getSupabaseClient } from "@/api/supabase";
import { env } from "@/lib/env";
import type { DeviceRegistration, PushSubscriptionResult } from "./types";
import { NOTIFICATION_CHANNELS } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushNotificationService {
  private deviceToken: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!Device.isDevice) {
      console.warn("Push notifications require a physical device.");
      return;
    }

    await this.configureChannels();
    this.initialized = true;
  }

  async registerForPushNotifications(): Promise<PushSubscriptionResult> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return { ok: false, error: "Push notification permission was not granted." };
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      this.deviceToken = tokenData.data;

      const registration: DeviceRegistration = {
        platform: Platform.OS as "ios" | "android",
        deviceToken: this.deviceToken,
        appVersion: Constants.expoConfig?.version ?? "1.0.0",
        deviceModel: Device.modelName ?? "Unknown",
        osVersion: Platform.Version.toString(),
      };

      await this.registerDevice(registration);
      await secureStorage.set(STORAGE_KEYS.DEVICE_TOKEN as never, this.deviceToken);

      return { ok: true, token: this.deviceToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push registration failed.";
      return { ok: false, error: message };
    }
  }

  async unregister(): Promise<void> {
    if (!this.deviceToken) return;

    try {
      const supabase = getSupabaseClient();
      await supabase
        .from("mobile_devices")
        .update({ is_active: false })
        .eq("device_token", this.deviceToken);

      this.deviceToken = null;
      await secureStorage.delete(STORAGE_KEYS.DEVICE_TOKEN as never);
    } catch {
      // Best-effort cleanup
    }
  }

  async sendLocalNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger: null,
    });
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, string>
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger,
    });
    return id;
  }

  async cancelScheduledNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAllScheduled(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  addNotificationReceivedListener(
    handler: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(handler);
  }

  addNotificationResponseListener(
    handler: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }

  getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return Notifications.getLastNotificationResponseAsync();
  }

  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  private async configureChannels(): Promise<void> {
    if (Platform.OS === "android") {
      for (const channel of NOTIFICATION_CHANNELS) {
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          description: channel.description,
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 100, 100, 100],
          lightColor: "#FF6B35",
        });
      }
    }
  }

  private async registerDevice(registration: DeviceRegistration): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("mobile_devices").upsert(
        {
          platform: registration.platform,
          device_token: registration.deviceToken,
          app_version: registration.appVersion,
          device_model: registration.deviceModel,
          os_version: registration.osVersion,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id, device_token",
          ignoreDuplicates: false,
        }
      );

      if (error) {
        console.error("Device registration failed:", error.message);
      }
    } catch {
      // Best-effort
    }
  }
}

export const pushNotificationService = new PushNotificationService();
