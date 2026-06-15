export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationCategory =
  | "attendance"
  | "renewal"
  | "payment"
  | "class"
  | "trainer"
  | "lead"
  | "membership"
  | "system"
  | "promotion";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  sound?: string;
  badge?: number;
  channelId?: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: NotificationCategory;
}

export interface PushSubscriptionResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export interface DeviceRegistration {
  platform: "ios" | "android";
  deviceToken: string;
  appVersion: string;
  deviceModel: string;
  osVersion: string;
}

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  { id: "attendance_reminder", name: "Attendance Reminders", description: "Daily check-in prompts", enabled: true, category: "attendance" },
  { id: "renewal_reminder", name: "Renewal Reminders", description: "Membership expiry alerts", enabled: true, category: "renewal" },
  { id: "payment_receipt", name: "Payment Receipts", description: "Payment confirmations", enabled: true, category: "payment" },
  { id: "class_booking", name: "Class Updates", description: "Booking confirmations and changes", enabled: true, category: "class" },
  { id: "trainer_message", name: "Trainer Messages", description: "Messages from your trainer", enabled: true, category: "trainer" },
  { id: "lead_followup", name: "Lead Follow-ups", description: "Lead status updates", enabled: true, category: "lead" },
  { id: "membership_alert", name: "Membership Alerts", description: "Plan and status changes", enabled: true, category: "membership" },
  { id: "system", name: "System Notifications", description: "App and account notices", enabled: true, category: "system" },
];

export function getNotificationChannel(category: NotificationCategory): NotificationChannel | undefined {
  return NOTIFICATION_CHANNELS.find((c) => c.category === category);
}
