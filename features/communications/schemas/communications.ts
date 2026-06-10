import { z } from "zod";
import { announcementCategories, announcementStatuses, automationTriggerKeys, campaignStatuses, campaignTypes, communicationCategories, outboundChannels, notificationPriorities, templateStatuses } from "@/types/communications";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const optionalDateTime = z.string().optional().or(z.literal(""));
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time.").optional().or(z.literal(""));

export const NotificationTemplateSchema = z.object({
  templateId: optionalUuid,
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(160).optional().or(z.literal("")),
  category: z.enum(communicationCategories),
  channel: z.enum(["in_app", "email", "whatsapp", "sms", "push"]),
  subject: z.string().trim().max(180).optional().or(z.literal("")),
  bodyText: z.string().trim().min(2).max(4000),
  bodyHtml: z.string().trim().max(12000).optional().or(z.literal("")),
  variables: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(templateStatuses)
});

export const NotificationPreferenceSchema = z.object({
  emailEnabled: z.coerce.boolean(),
  whatsappEnabled: z.coerce.boolean(),
  smsEnabled: z.coerce.boolean(),
  pushEnabled: z.coerce.boolean(),
  marketingOptIn: z.coerce.boolean(),
  transactionalOptIn: z.coerce.boolean(),
  whatsappOptIn: z.coerce.boolean(),
  smsOptIn: z.coerce.boolean(),
  quietHoursStart: timeString,
  quietHoursEnd: timeString,
  membership: z.coerce.boolean(),
  payments: z.coerce.boolean(),
  attendance: z.coerce.boolean(),
  classes: z.coerce.boolean(),
  workouts: z.coerce.boolean(),
  nutrition: z.coerce.boolean(),
  promotions: z.coerce.boolean(),
  system: z.coerce.boolean()
});

export const NotificationStateSchema = z.object({
  notificationId: z.string().uuid(),
  nextStatus: z.enum(["read", "archived"]),
  pinned: z.coerce.boolean().optional()
});

export const AnnouncementSchema = z.object({
  announcementId: optionalUuid,
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(3000),
  category: z.enum(announcementCategories),
  targetSegment: z.string().trim().min(2).max(120),
  priority: z.enum(notificationPriorities),
  status: z.enum(announcementStatuses),
  pinned: z.coerce.boolean(),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime
}).refine((value) => !value.endsAt || !value.startsAt || value.endsAt >= value.startsAt, {
  message: "End time must be after start time.",
  path: ["endsAt"]
});

export const CommunicationSegmentSchema = z.object({
  segmentId: optionalUuid,
  name: z.string().trim().min(2).max(120),
  segmentKey: z.string().trim().min(2).max(120),
  description: z.string().trim().max(700).optional().or(z.literal("")),
  definition: z.string().trim().max(3000).optional().or(z.literal("")),
  status: z.enum(["active", "archived"])
});

export const CampaignSchema = z.object({
  campaignId: optionalUuid,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  campaignType: z.enum(campaignTypes),
  category: z.enum(communicationCategories),
  templateId: optionalUuid,
  segmentId: optionalUuid,
  segmentKey: z.string().trim().min(2).max(120),
  status: z.enum(campaignStatuses),
  scheduledFor: optionalDateTime
});

export const CampaignDispatchSchema = z.object({
  campaignId: z.string().uuid(),
  mode: z.enum(["queue", "send_now"])
});

export const AutomationRuleSchema = z.object({
  automationRuleId: optionalUuid,
  name: z.string().trim().min(2).max(160),
  triggerKey: z.enum(automationTriggerKeys),
  channel: z.enum(["in_app", "email", "whatsapp", "sms", "multi_channel"]),
  templateId: optionalUuid,
  segmentKey: z.string().trim().min(2).max(120),
  delayHours: z.coerce.number().int().min(0).max(8760),
  status: z.enum(["active", "paused", "archived"])
});

export const DirectNotificationSchema = z.object({
  memberId: optionalUuid,
  trainerId: optionalUuid,
  userId: optionalUuid,
  templateId: optionalUuid,
  channel: z.enum(outboundChannels),
  category: z.enum(communicationCategories),
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(2000),
  priority: z.enum(notificationPriorities),
  actionUrl: z.string().trim().max(500).optional().or(z.literal(""))
}).refine((value) => Boolean(value.memberId || value.trainerId || value.userId), {
  message: "Choose a recipient.",
  path: ["memberId"]
});

export type NotificationTemplateInput = z.infer<typeof NotificationTemplateSchema>;
export type CampaignInput = z.infer<typeof CampaignSchema>;
export type AnnouncementInput = z.infer<typeof AnnouncementSchema>;
