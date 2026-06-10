import type { Database } from "./database";
import type { MemberRow } from "./membership";
import type { TrainerRow } from "./training";

export const communicationChannels = ["in_app", "email", "whatsapp", "sms", "push", "internal"] as const;
export const outboundChannels = ["in_app", "email", "whatsapp", "sms", "push"] as const;
export const communicationCategories = ["membership", "payments", "attendance", "classes", "workouts", "nutrition", "promotions", "system"] as const;
export const notificationPriorities = ["low", "normal", "high", "urgent"] as const;
export const notificationStatuses = ["unread", "read", "archived"] as const;
export const templateStatuses = ["draft", "active", "archived"] as const;
export const campaignStatuses = ["draft", "scheduled", "running", "completed", "cancelled"] as const;
export const campaignTypes = ["email", "whatsapp", "sms", "multi_channel"] as const;
export const recipientStatuses = ["queued", "sent", "delivered", "opened", "clicked", "failed", "opted_out", "cancelled"] as const;
export const announcementCategories = ["general", "gym_notice", "holiday", "maintenance", "special_event", "promotion", "system"] as const;
export const announcementStatuses = ["draft", "scheduled", "published", "archived"] as const;
export const automationTriggerKeys = ["no_attendance_7_days", "no_attendance_15_days", "membership_expiry_30_days", "membership_expiry_15_days", "membership_expiry_7_days", "membership_expiry_1_day", "class_reminder", "trainer_session_reminder", "goal_completed", "workout_streak_broken"] as const;

export type CommunicationChannel = (typeof communicationChannels)[number];
export type OutboundChannel = (typeof outboundChannels)[number];
export type CommunicationCategory = (typeof communicationCategories)[number];
export type NotificationPriority = (typeof notificationPriorities)[number];
export type AutomationTriggerKey = (typeof automationTriggerKeys)[number];

export type NotificationTemplateRow = Database["public"]["Tables"]["notification_templates"]["Row"];
export type NotificationPreferenceRow = Database["public"]["Tables"]["notification_preferences"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type CommunicationSegmentRow = Database["public"]["Tables"]["communication_segments"]["Row"];
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignRecipientRow = Database["public"]["Tables"]["campaign_recipients"]["Row"];
export type EmailLogRow = Database["public"]["Tables"]["email_logs"]["Row"];
export type WhatsappLogRow = Database["public"]["Tables"]["whatsapp_logs"]["Row"];
export type SmsLogRow = Database["public"]["Tables"]["sms_logs"]["Row"];
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
export type CommunicationAutomationRuleRow = Database["public"]["Tables"]["communication_automation_rules"]["Row"];
export type CommunicationHistoryRow = Database["public"]["Tables"]["communication_history"]["Row"];
export type CommunicationDailySummaryRow = Database["public"]["Views"]["communication_channel_daily_summary"]["Row"];
export type CampaignPerformanceSummaryRow = Database["public"]["Views"]["campaign_performance_summary"]["Row"];
export type NotificationUnreadSummaryRow = Database["public"]["Views"]["notification_unread_summary"]["Row"];

export type RenderedTemplate = {
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
};

export type SegmentRecipient = {
  member: MemberRow;
  trainer: Pick<TrainerRow, "id" | "display_name"> | null;
  email: string | null;
  phone: string | null;
  userId: string | null;
};

export type NotificationCenterData = {
  notifications: NotificationRow[];
  announcements: AnnouncementRow[];
  preferences: NotificationPreferenceRow | null;
  history: CommunicationHistoryRow[];
  metrics: {
    unread: number;
    pinned: number;
    priority: number;
    totalHistory: number;
  };
};

export type CommunicationDashboardData = {
  templates: NotificationTemplateRow[];
  segments: CommunicationSegmentRow[];
  campaigns: CampaignRow[];
  campaignPerformance: CampaignPerformanceSummaryRow[];
  announcements: AnnouncementRow[];
  automationRules: CommunicationAutomationRuleRow[];
  channelSummary: CommunicationDailySummaryRow[];
  recentHistory: CommunicationHistoryRow[];
  metrics: {
    emailsToday: number;
    whatsappToday: number;
    smsToday: number;
    unreadNotifications: number;
    activeCampaigns: number;
    activeAutomations: number;
  };
};
