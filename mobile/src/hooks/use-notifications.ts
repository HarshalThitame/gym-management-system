import { useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { pushNotificationService } from "@/notifications/service";
import { handleNotificationResponse } from "@/notifications/handlers";
import { useAuthStore } from "@/state/auth/auth-store";

interface NotificationState {
  hasPermission: boolean;
  deviceToken: string | null;
  lastNotification: Notifications.Notification | null;
  unreadCount: number;
}

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [state, setState] = useState<NotificationState>({
    hasPermission: false,
    deviceToken: null,
    lastNotification: null,
    unreadCount: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    pushNotificationService.initialize().then(() => {
      pushNotificationService.registerForPushNotifications().then((result) => {
        if (result.ok) {
          setState((prev) => ({
            ...prev,
            hasPermission: true,
            deviceToken: result.token ?? null,
          }));
        }
      });
    });

    const responseListener = pushNotificationService.addNotificationResponseListener(
      handleNotificationResponse
    );

    const receivedListener = pushNotificationService.addNotificationReceivedListener(
      (notification) => {
        setState((prev) => ({ ...prev, lastNotification: notification }));
      }
    );

    return () => {
      responseListener.remove();
      receivedListener.remove();
    };
  }, [isAuthenticated]);

  const sendLocal = useCallback(
    (title: string, body: string, data?: Record<string, string>) => {
      return pushNotificationService.sendLocalNotification(title, body, data);
    },
    []
  );

  const scheduleLocal = useCallback(
    (
      title: string,
      body: string,
      trigger: Notifications.NotificationTriggerInput,
      data?: Record<string, string>
    ) => {
      return pushNotificationService.scheduleLocalNotification(title, body, trigger, data);
    },
    []
  );

  return {
    hasPermission: state.hasPermission,
    deviceToken: state.deviceToken,
    sendLocalNotification: sendLocal,
    scheduleLocalNotification: scheduleLocal,
  };
}
