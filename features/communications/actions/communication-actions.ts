"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { communicationEmail } from "@/emails/communications";
import { sendEmail } from "@/services/email/resend";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { hasRequiredRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import type { CommunicationCategory, NotificationTemplateRow, OutboundChannel, SegmentRecipient } from "@/types/communications";
import {
  buildCategoryPreferences,
  extractTemplateVariables,
  normalizeVariables,
  parseJsonObject,
  renderTemplate,
  shouldDeliverChannel,
  slugifyCommunicationName
} from "../lib/business-rules";
import {
  AnnouncementSchema,
  AutomationRuleSchema,
  CampaignDispatchSchema,
  CampaignSchema,
  CommunicationSegmentSchema,
  DirectNotificationSchema,
  NotificationPreferenceSchema,
  NotificationStateSchema,
  NotificationTemplateSchema
} from "../schemas/communications";
import {
  getCampaignWithTemplate,
  getOrCreateNotificationPreferences,
  resolveSegmentRecipients
} from "../services/communication-service";

type AppSupabase = SupabaseClient<Database>;
type CampaignRecipientInsert = Database["public"]["Tables"]["campaign_recipients"]["Insert"];
type CampaignRecipientStatus = NonNullable<CampaignRecipientInsert["status"]>;
type CommunicationHistoryInsert = Database["public"]["Tables"]["communication_history"]["Insert"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

const staffRoles = ["super_admin", "gym_admin", "reception_staff"] as const;
const communicationManagerRoles = ["super_admin", "gym_admin"] as const;
const communicatorRoles = ["super_admin", "gym_admin", "reception_staff", "trainer"] as const;

export async function saveNotificationTemplateAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const parsed = NotificationTemplateSchema.safeParse({
    templateId: formData.get("templateId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    category: formData.get("category"),
    channel: formData.get("channel"),
    subject: formData.get("subject") ?? "",
    bodyText: formData.get("bodyText"),
    bodyHtml: formData.get("bodyHtml") ?? "",
    variables: formData.get("variables") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const variables = normalizeVariables(parsed.data.variables || "");
  const derivedVariables = extractTemplateVariables(`${parsed.data.subject ?? ""} ${parsed.data.bodyText} ${parsed.data.bodyHtml ?? ""}`);
  const supabase = await createSupabaseServerClient();
  const gymId = context.profile?.gym_id ?? null;
  const slug = parsed.data.slug ? slugifyCommunicationName(parsed.data.slug) : slugifyCommunicationName(parsed.data.name);
  const payload = {
    gym_id: gymId,
    name: parsed.data.name,
    slug,
    category: parsed.data.category,
    channel: parsed.data.channel,
    subject: parsed.data.subject || null,
    body_text: parsed.data.bodyText,
    body_html: parsed.data.bodyHtml || null,
    variables: (variables.length > 0 ? variables : derivedVariables) as Json,
    status: parsed.data.status,
    is_system: false,
    created_by: context.userId
  };

  const result = parsed.data.templateId
    ? await supabase.from("notification_templates").update(payload).eq("id", parsed.data.templateId).select("*").maybeSingle()
    : await supabase.from("notification_templates").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Template save failed." };
  }

  await writeCommunicationAudit(context, parsed.data.templateId ? "communication_template.updated" : "communication_template.created", "notification_template", result.data.id, {
    name: parsed.data.name,
    channel: parsed.data.channel
  });
  revalidateCommunicationPaths();
  return { status: "success", message: parsed.data.templateId ? "Template updated." : "Template created." };
}

export async function saveNotificationPreferencesAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/notifications");
  const parsed = NotificationPreferenceSchema.safeParse({
    emailEnabled: checkbox(formData, "emailEnabled"),
    whatsappEnabled: checkbox(formData, "whatsappEnabled"),
    smsEnabled: checkbox(formData, "smsEnabled"),
    pushEnabled: checkbox(formData, "pushEnabled"),
    marketingOptIn: checkbox(formData, "marketingOptIn"),
    transactionalOptIn: checkbox(formData, "transactionalOptIn"),
    whatsappOptIn: checkbox(formData, "whatsappOptIn"),
    smsOptIn: checkbox(formData, "smsOptIn"),
    quietHoursStart: formData.get("quietHoursStart") ?? "",
    quietHoursEnd: formData.get("quietHoursEnd") ?? "",
    membership: checkbox(formData, "membership"),
    payments: checkbox(formData, "payments"),
    attendance: checkbox(formData, "attendance"),
    classes: checkbox(formData, "classes"),
    workouts: checkbox(formData, "workouts"),
    nutrition: checkbox(formData, "nutrition"),
    promotions: checkbox(formData, "promotions"),
    system: checkbox(formData, "system")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getContextRecipientProfile(supabase, context);
  const existing = await getOrCreateNotificationPreferences({
    userId: context.userId ?? "",
    gymId: context.profile?.gym_id ?? profile.gymId,
    memberId: profile.memberId,
    trainerId: profile.trainerId
  });
  const payload = {
    email_enabled: parsed.data.emailEnabled,
    whatsapp_enabled: parsed.data.whatsappEnabled,
    sms_enabled: parsed.data.smsEnabled,
    push_enabled: parsed.data.pushEnabled,
    category_preferences: buildCategoryPreferences({
      membership: parsed.data.membership,
      payments: parsed.data.payments,
      attendance: parsed.data.attendance,
      classes: parsed.data.classes,
      workouts: parsed.data.workouts,
      nutrition: parsed.data.nutrition,
      promotions: parsed.data.promotions,
      system: parsed.data.system
    }) as Json,
    quiet_hours_start: parsed.data.quietHoursStart || null,
    quiet_hours_end: parsed.data.quietHoursEnd || null,
    marketing_opt_in: parsed.data.marketingOptIn,
    transactional_opt_in: parsed.data.transactionalOptIn,
    whatsapp_opt_in: parsed.data.whatsappOptIn,
    sms_opt_in: parsed.data.smsOptIn,
    opted_out_at: parsed.data.transactionalOptIn || parsed.data.marketingOptIn ? null : new Date().toISOString(),
    updated_by: context.userId
  };

  const { error } = await supabase.from("notification_preferences").update(payload).eq("id", existing.id);
  if (error) {
    return { status: "error", message: error.message };
  }

  await writeCommunicationAudit(context, "notification_preferences.updated", "notification_preferences", existing.id, { channels: payload });
  revalidateCommunicationPaths();
  return { status: "success", message: "Notification preferences updated." };
}

export async function updateNotificationStateAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/notifications");
  const parsed = NotificationStateSchema.safeParse({
    notificationId: formData.get("notificationId"),
    nextStatus: formData.get("nextStatus") ?? "read",
    pinned: checkbox(formData, "pinned")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notifications").update({
    status: parsed.data.nextStatus,
    read_at: parsed.data.nextStatus === "read" ? new Date().toISOString() : null,
    pinned: parsed.data.pinned ?? false
  }).eq("id", parsed.data.notificationId);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidateCommunicationPaths();
  return { status: "success", message: parsed.data.nextStatus === "archived" ? "Notification archived." : "Notification marked as read." };
}

export async function saveAnnouncementAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const parsed = AnnouncementSchema.safeParse({
    announcementId: formData.get("announcementId") ?? "",
    title: formData.get("title"),
    body: formData.get("body"),
    category: formData.get("category") ?? "general",
    targetSegment: formData.get("targetSegment") ?? "all_members",
    priority: formData.get("priority") ?? "normal",
    status: formData.get("status") ?? "draft",
    pinned: checkbox(formData, "pinned"),
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: context.profile?.gym_id ?? null,
    title: parsed.data.title,
    body: parsed.data.body,
    category: parsed.data.category,
    target_segment: parsed.data.targetSegment,
    priority: parsed.data.priority,
    status: parsed.data.status,
    pinned: parsed.data.pinned,
    starts_at: parsed.data.startsAt || null,
    ends_at: parsed.data.endsAt || null,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    created_by: context.userId
  };
  const result = parsed.data.announcementId
    ? await supabase.from("announcements").update(payload).eq("id", parsed.data.announcementId).select("*").maybeSingle()
    : await supabase.from("announcements").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Announcement save failed." };
  }

  await writeCommunicationAudit(context, parsed.data.announcementId ? "announcement.updated" : "announcement.created", "announcement", result.data.id, {
    title: parsed.data.title,
    status: parsed.data.status,
    targetSegment: parsed.data.targetSegment
  });
  revalidateCommunicationPaths();
  return { status: "success", message: parsed.data.announcementId ? "Announcement updated." : "Announcement created." };
}

export async function saveCommunicationSegmentAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const parsed = CommunicationSegmentSchema.safeParse({
    segmentId: formData.get("segmentId") ?? "",
    name: formData.get("name"),
    segmentKey: formData.get("segmentKey"),
    description: formData.get("description") ?? "",
    definition: formData.get("definition") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const definition = parseJsonObject(parsed.data.definition || "");
  if (!definition.ok) {
    return { status: "error", message: definition.message, fieldErrors: { definition: [definition.message] } };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: context.profile?.gym_id ?? null,
    name: parsed.data.name,
    segment_key: slugifyCommunicationName(parsed.data.segmentKey),
    description: parsed.data.description || null,
    definition: definition.value,
    status: parsed.data.status,
    is_system: false,
    created_by: context.userId
  };
  const result = parsed.data.segmentId
    ? await supabase.from("communication_segments").update(payload).eq("id", parsed.data.segmentId).select("*").maybeSingle()
    : await supabase.from("communication_segments").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Segment save failed." };
  }

  await writeCommunicationAudit(context, parsed.data.segmentId ? "communication_segment.updated" : "communication_segment.created", "communication_segment", result.data.id, {
    segmentKey: result.data.segment_key
  });
  revalidateCommunicationPaths();
  return { status: "success", message: parsed.data.segmentId ? "Segment updated." : "Segment created." };
}

export async function saveCampaignAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const parsed = CampaignSchema.safeParse({
    campaignId: formData.get("campaignId") ?? "",
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    campaignType: formData.get("campaignType") ?? "email",
    category: formData.get("category") ?? "promotions",
    templateId: formData.get("templateId") ?? "",
    segmentId: formData.get("segmentId") ?? "",
    segmentKey: formData.get("segmentKey") ?? "all_members",
    status: formData.get("status") ?? "draft",
    scheduledFor: formData.get("scheduledFor") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: context.profile?.gym_id ?? null,
    name: parsed.data.name,
    description: parsed.data.description || null,
    campaign_type: parsed.data.campaignType,
    category: parsed.data.category,
    template_id: parsed.data.templateId || null,
    segment_id: parsed.data.segmentId || null,
    segment_key: parsed.data.segmentKey,
    status: parsed.data.status,
    scheduled_for: parsed.data.scheduledFor || null,
    metadata: { source: "manual_campaign" } as Json,
    created_by: context.userId
  };
  const result = parsed.data.campaignId
    ? await supabase.from("campaigns").update(payload).eq("id", parsed.data.campaignId).select("*").maybeSingle()
    : await supabase.from("campaigns").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Campaign save failed." };
  }

  await writeCommunicationAudit(context, parsed.data.campaignId ? "campaign.updated" : "campaign.created", "campaign", result.data.id, {
    campaignType: parsed.data.campaignType,
    segmentKey: parsed.data.segmentKey
  });
  revalidateCommunicationPaths();
  return { status: "success", message: parsed.data.campaignId ? "Campaign updated." : "Campaign created." };
}

export async function dispatchCampaignAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const parsed = CampaignDispatchSchema.safeParse({
    campaignId: formData.get("campaignId"),
    mode: formData.get("mode") ?? "queue"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const { campaign, template } = await getCampaignWithTemplate(parsed.data.campaignId);
  if (!template) {
    return { status: "error", message: "Select a template before dispatching this campaign." };
  }

  const recipients = await resolveSegmentRecipients(campaign.gym_id, campaign.segment_key);
  if (recipients.length === 0) {
    return { status: "error", message: "No recipients matched this segment." };
  }

  const supabase = await createSupabaseServerClient();
  const channels = getCampaignChannels(campaign.campaign_type);
  const now = new Date().toISOString();
  await supabase.from("campaigns").update({ status: "running", started_at: now }).eq("id", campaign.id);

  let queued = 0;
  let failed = 0;
  let optedOut = 0;
  for (const recipient of recipients) {
    for (const channel of channels) {
      const result = await dispatchToRecipient(supabase, context, {
        channel,
        campaignId: campaign.id,
        campaignCategory: campaign.category,
        sourceType: "campaign",
        sourceId: campaign.id,
        template,
        recipient,
        mode: parsed.data.mode,
        transactional: campaign.category !== "promotions"
      });
      if (result === "queued" || result === "sent") {
        queued += 1;
      } else if (result === "opted_out") {
        optedOut += 1;
      } else {
        failed += 1;
      }
    }
  }

  await supabase.from("campaigns").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    metadata: { queued, failed, optedOut, dispatchMode: parsed.data.mode } as Json
  }).eq("id", campaign.id);
  await writeCommunicationAudit(context, "campaign.dispatched", "campaign", campaign.id, {
    queued,
    failed,
    optedOut,
    dispatchMode: parsed.data.mode
  });
  revalidateCommunicationPaths();
  return { status: "success", message: `Campaign dispatched. ${queued} queued/sent, ${optedOut} opted out, ${failed} failed.` };
}

export async function saveAutomationRuleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const parsed = AutomationRuleSchema.safeParse({
    automationRuleId: formData.get("automationRuleId") ?? "",
    name: formData.get("name"),
    triggerKey: formData.get("triggerKey"),
    channel: formData.get("channel") ?? "in_app",
    templateId: formData.get("templateId") ?? "",
    segmentKey: formData.get("segmentKey") ?? "all_members",
    delayHours: formData.get("delayHours") ?? "0",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: context.profile?.gym_id ?? null,
    name: parsed.data.name,
    trigger_key: parsed.data.triggerKey,
    channel: parsed.data.channel,
    template_id: parsed.data.templateId || null,
    segment_key: parsed.data.segmentKey,
    delay_hours: parsed.data.delayHours,
    status: parsed.data.status,
    metadata: { source: "automation_rule" } as Json,
    created_by: context.userId
  };
  const result = parsed.data.automationRuleId
    ? await supabase.from("communication_automation_rules").update(payload).eq("id", parsed.data.automationRuleId).select("*").maybeSingle()
    : await supabase.from("communication_automation_rules").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Automation rule save failed." };
  }

  await writeCommunicationAudit(context, parsed.data.automationRuleId ? "automation_rule.updated" : "automation_rule.created", "communication_automation_rule", result.data.id, {
    triggerKey: parsed.data.triggerKey,
    channel: parsed.data.channel
  });
  revalidateCommunicationPaths();
  return { status: "success", message: parsed.data.automationRuleId ? "Automation updated." : "Automation created." };
}

export async function runAutomationRuleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicationManagerRoles, "/admin/communications");
  const ruleId = String(formData.get("automationRuleId") ?? "");
  if (!ruleId) {
    return { status: "error", message: "Choose an automation rule." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: rule, error } = await supabase.from("communication_automation_rules").select("*").eq("id", ruleId).maybeSingle();
  if (error || !rule) {
    return { status: "error", message: error?.message ?? "Automation rule not found." };
  }
  if (rule.status !== "active") {
    return { status: "error", message: "Only active automation rules can be run." };
  }
  const { data: template, error: templateError } = rule.template_id
    ? await supabase.from("notification_templates").select("*").eq("id", rule.template_id).maybeSingle()
    : { data: null, error: null };
  if (templateError || !template) {
    return { status: "error", message: templateError?.message ?? "Attach an active template to this automation." };
  }

  const recipients = await resolveSegmentRecipients(rule.gym_id, rule.segment_key);
  const channels = rule.channel === "multi_channel" ? (["in_app", "email", "whatsapp"] as const) : ([rule.channel] as const);
  let queued = 0;
  let optedOut = 0;
  let failed = 0;

  for (const recipient of recipients) {
    for (const channel of channels) {
      const result = await dispatchToRecipient(supabase, context, {
        channel,
        campaignId: null,
        campaignCategory: template.category,
        sourceType: "automation",
        sourceId: rule.id,
        template,
        recipient,
        mode: "queue",
        transactional: template.category !== "promotions"
      });
      if (result === "queued" || result === "sent") {
        queued += 1;
      } else if (result === "opted_out") {
        optedOut += 1;
      } else {
        failed += 1;
      }
    }
  }

  await writeCommunicationAudit(context, "automation_rule.queued", "communication_automation_rule", rule.id, { queued, optedOut, failed });
  revalidateCommunicationPaths();
  return { status: "success", message: `Automation queued. ${queued} messages, ${optedOut} opted out, ${failed} failed.` };
}

export async function createDirectNotificationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(communicatorRoles, "/admin/communications");
  const parsed = DirectNotificationSchema.safeParse({
    memberId: formData.get("memberId") ?? "",
    trainerId: formData.get("trainerId") ?? "",
    userId: formData.get("userId") ?? "",
    templateId: formData.get("templateId") ?? "",
    channel: formData.get("channel") ?? "in_app",
    category: formData.get("category") ?? "system",
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority") ?? "normal",
    actionUrl: formData.get("actionUrl") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureDirectMessageAccess(supabase, context, parsed.data.memberId || null, parsed.data.trainerId || null);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }
  const channelReady = await ensureDirectChannelReady(parsed.data.channel, access.email, access.phone);
  if (!channelReady.ok) {
    return { status: "error", message: channelReady.message };
  }

  const notification = await createInAppNotification(supabase, context, {
    gymId: context.profile?.gym_id ?? access.gymId,
    userId: parsed.data.userId || access.userId,
    memberId: parsed.data.memberId || null,
    trainerId: parsed.data.trainerId || null,
    templateId: parsed.data.templateId || null,
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
    priority: parsed.data.priority,
    actionUrl: parsed.data.actionUrl || null,
    sourceType: "direct",
    sourceId: null,
    metadata: { channel: parsed.data.channel } as Json
  });
  await logDirectChannelMessage(supabase, context, {
    gymId: context.profile?.gym_id ?? access.gymId,
    notificationId: notification.id,
    templateId: parsed.data.templateId || null,
    userId: parsed.data.userId || access.userId,
    memberId: parsed.data.memberId || null,
    trainerId: parsed.data.trainerId || null,
    email: access.email,
    phone: access.phone,
    channel: parsed.data.channel,
    title: parsed.data.title,
    body: parsed.data.body
  });

  await insertCommunicationHistory(supabase, context, {
    gym_id: context.profile?.gym_id ?? access.gymId,
    recipient_user_id: parsed.data.userId || access.userId,
    member_id: parsed.data.memberId || null,
    trainer_id: parsed.data.trainerId || null,
    channel: parsed.data.channel,
    category: parsed.data.category,
    direction: "outbound",
    subject: parsed.data.title,
    body: parsed.data.body,
    status: "queued",
    source_type: "direct",
    source_id: notification.id,
    template_id: parsed.data.templateId || null,
    metadata: { priority: parsed.data.priority } as Json
  });

  await writeCommunicationAudit(context, "notification.created", "notification", notification.id, {
    channel: parsed.data.channel,
    category: parsed.data.category
  });
  revalidateCommunicationPaths();
  return { status: "success", message: "Notification queued." };
}

async function dispatchToRecipient(
  supabase: AppSupabase,
  context: AuthContext,
  input: {
    channel: OutboundChannel;
    campaignId: string | null;
    campaignCategory: CommunicationCategory;
    sourceType: string;
    sourceId: string | null;
    template: NotificationTemplateRow;
    recipient: SegmentRecipient;
    mode: "queue" | "send_now";
    transactional: boolean;
  }
): Promise<"queued" | "sent" | "failed" | "opted_out"> {
  const preferences = input.recipient.userId
    ? await getOrCreateNotificationPreferences({
      userId: input.recipient.userId,
      gymId: input.recipient.member.gym_id,
      memberId: input.recipient.member.id,
      trainerId: input.recipient.trainer?.id ?? null
    })
    : null;
  const allowed = shouldDeliverChannel(preferences, input.channel, input.campaignCategory, input.transactional);
  const rendered = renderTemplate(input.template, recipientVariables(input.recipient));
  const subject = rendered.subject ?? input.template.name;
  const bodyText = rendered.bodyText || input.template.body_text;

  if (!allowed) {
    if (input.campaignId) {
      await insertCampaignRecipient(supabase, {
        gym_id: input.recipient.member.gym_id,
        campaign_id: input.campaignId,
        member_id: input.recipient.member.id,
        trainer_id: input.recipient.trainer?.id ?? null,
        user_id: input.recipient.userId,
        channel: input.channel,
        email: input.recipient.email,
        phone: input.recipient.phone,
        status: "opted_out",
        error_message: "Recipient communication preferences disabled this channel."
      });
    }
    return "opted_out";
  }

  if (input.channel === "in_app" || input.channel === "push") {
    const notification = await createInAppNotification(supabase, context, {
      gymId: input.recipient.member.gym_id,
      userId: input.recipient.userId,
      memberId: input.recipient.member.id,
      trainerId: input.recipient.trainer?.id ?? null,
      templateId: input.template.id,
      category: input.campaignCategory,
      title: subject,
      body: bodyText,
      priority: input.campaignCategory === "system" ? "high" : "normal",
      actionUrl: null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: { channel: input.channel, campaignId: input.campaignId } as Json
    });
    await insertCommunicationHistory(supabase, context, {
      gym_id: input.recipient.member.gym_id,
      recipient_user_id: input.recipient.userId,
      member_id: input.recipient.member.id,
      trainer_id: input.recipient.trainer?.id ?? null,
      channel: input.channel,
      category: input.campaignCategory,
      subject,
      body: bodyText,
      status: "queued",
      source_type: input.sourceType,
      source_id: notification.id,
      template_id: input.template.id,
      campaign_id: input.campaignId
    });
    if (input.campaignId) {
      await insertCampaignRecipient(supabase, recipientInsert(input, "queued"));
    }
    return "queued";
  }

  if (input.channel === "email") {
    if (!input.recipient.email) {
      return insertFailedRecipient(supabase, context, input, "Recipient has no email address.");
    }

    const sendResult = input.mode === "send_now"
      ? await sendEmail({
        to: input.recipient.email,
        subject,
        html: communicationEmail({
          title: subject,
          bodyHtml: rendered.bodyHtml ?? paragraphize(bodyText),
          ctaLabel: "Open Member Portal",
          ctaUrl: "/member/notifications"
        })
      })
      : { sent: false, reason: "Queued for background delivery." };
    const status = sendResult.sent ? "sent" : "queued";
    const errorMessage = input.mode === "send_now" && !sendResult.sent ? sendResult.reason : null;

    await supabase.from("email_logs").insert({
      gym_id: input.recipient.member.gym_id,
      template_id: input.template.id,
      campaign_id: input.campaignId,
      recipient_user_id: input.recipient.userId,
      member_id: input.recipient.member.id,
      trainer_id: input.recipient.trainer?.id ?? null,
      to_email: input.recipient.email,
      subject,
      status,
      error_message: errorMessage,
      sent_at: sendResult.sent ? new Date().toISOString() : null,
      metadata: { sourceType: input.sourceType } as Json
    });
    await insertCommunicationHistory(supabase, context, {
      gym_id: input.recipient.member.gym_id,
      recipient_user_id: input.recipient.userId,
      member_id: input.recipient.member.id,
      trainer_id: input.recipient.trainer?.id ?? null,
      channel: "email",
      category: input.campaignCategory,
      subject,
      body: bodyText,
      status,
      source_type: input.sourceType,
      source_id: input.sourceId,
      template_id: input.template.id,
      campaign_id: input.campaignId,
      metadata: { errorMessage } as Json
    });
    if (input.campaignId) {
      await insertCampaignRecipient(supabase, recipientInsert(input, errorMessage ? "failed" : status));
    }
    return errorMessage ? "failed" : status;
  }

  if (!input.recipient.phone) {
    return insertFailedRecipient(supabase, context, input, "Recipient has no phone number.");
  }

  if (input.channel === "whatsapp") {
    await supabase.from("whatsapp_logs").insert({
      gym_id: input.recipient.member.gym_id,
      template_id: input.template.id,
      campaign_id: input.campaignId,
      recipient_user_id: input.recipient.userId,
      member_id: input.recipient.member.id,
      trainer_id: input.recipient.trainer?.id ?? null,
      to_phone: input.recipient.phone,
      template_name: input.template.slug,
      message: bodyText,
      status: "queued",
      metadata: { providerReady: true, sourceType: input.sourceType } as Json
    });
  }

  if (input.channel === "sms") {
    await supabase.from("sms_logs").insert({
      gym_id: input.recipient.member.gym_id,
      template_id: input.template.id,
      campaign_id: input.campaignId,
      recipient_user_id: input.recipient.userId,
      member_id: input.recipient.member.id,
      trainer_id: input.recipient.trainer?.id ?? null,
      to_phone: input.recipient.phone,
      message: bodyText.slice(0, 1000),
      status: "queued",
      metadata: { providerReady: true, sourceType: input.sourceType } as Json
    });
  }

  await insertCommunicationHistory(supabase, context, {
    gym_id: input.recipient.member.gym_id,
    recipient_user_id: input.recipient.userId,
    member_id: input.recipient.member.id,
    trainer_id: input.recipient.trainer?.id ?? null,
    channel: input.channel,
    category: input.campaignCategory,
    subject,
    body: bodyText,
    status: "queued",
    source_type: input.sourceType,
    source_id: input.sourceId,
    template_id: input.template.id,
    campaign_id: input.campaignId
  });
  if (input.campaignId) {
    await insertCampaignRecipient(supabase, recipientInsert(input, "queued"));
  }
  return "queued";
}

async function createInAppNotification(
  supabase: AppSupabase,
  context: AuthContext,
  input: {
    gymId: string | null;
    userId: string | null;
    memberId: string | null;
    trainerId: string | null;
    templateId: string | null;
    category: CommunicationCategory;
    title: string;
    body: string;
    priority: "low" | "normal" | "high" | "urgent";
    actionUrl: string | null;
    sourceType: string | null;
    sourceId: string | null;
    metadata?: Json;
  }
) {
  const payload: NotificationInsert = {
    gym_id: input.gymId,
    user_id: input.userId,
    member_id: input.memberId,
    trainer_id: input.trainerId,
    template_id: input.templateId,
    category: input.category,
    title: input.title,
    body: input.body,
    priority: input.priority,
    action_url: input.actionUrl,
    source_type: input.sourceType,
    source_id: input.sourceId,
    metadata: input.metadata ?? {},
    created_by: context.userId
  };
  const { data, error } = await supabase.from("notifications").insert(payload).select("*").maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? "Notification insert failed.");
  }
  return data;
}

async function insertCommunicationHistory(supabase: AppSupabase, context: AuthContext, input: Omit<CommunicationHistoryInsert, "created_by">) {
  const { error } = await supabase.from("communication_history").insert({
    ...input,
    created_by: context.userId
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function insertCampaignRecipient(supabase: AppSupabase, payload: CampaignRecipientInsert) {
  const { error } = await supabase.from("campaign_recipients").insert(payload);
  if (error?.code === "23505" && payload.member_id) {
    const { error: updateError } = await supabase
      .from("campaign_recipients")
      .update({
        status: payload.status ?? "queued",
        error_message: payload.error_message ?? null,
        sent_at: payload.sent_at ?? null,
        metadata: payload.metadata ?? {}
      })
      .eq("campaign_id", payload.campaign_id)
      .eq("member_id", payload.member_id)
      .eq("channel", payload.channel);
    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }
  if (error) {
    throw new Error(error.message);
  }
}

async function insertFailedRecipient(supabase: AppSupabase, context: AuthContext, input: Parameters<typeof dispatchToRecipient>[2], message: string): Promise<"failed"> {
  if (input.campaignId) {
    await insertCampaignRecipient(supabase, {
      ...recipientInsert(input, "failed"),
      error_message: message
    });
  }
  await insertCommunicationHistory(supabase, context, {
    gym_id: input.recipient.member.gym_id,
    recipient_user_id: input.recipient.userId,
    member_id: input.recipient.member.id,
    trainer_id: input.recipient.trainer?.id ?? null,
    channel: input.channel,
    category: input.campaignCategory,
    subject: input.template.name,
    body: message,
    status: "failed",
    source_type: input.sourceType,
    source_id: input.sourceId,
    template_id: input.template.id,
    campaign_id: input.campaignId
  });
  return "failed";
}

function recipientInsert(input: Parameters<typeof dispatchToRecipient>[2], status: CampaignRecipientStatus): CampaignRecipientInsert {
  return {
    gym_id: input.recipient.member.gym_id,
    campaign_id: input.campaignId ?? "",
    member_id: input.recipient.member.id,
    trainer_id: input.recipient.trainer?.id ?? null,
    user_id: input.recipient.userId,
    channel: input.channel,
    email: input.recipient.email,
    phone: input.recipient.phone,
    status,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    metadata: { sourceType: input.sourceType } as Json
  };
}

async function ensureDirectMessageAccess(
  supabase: AppSupabase,
  context: AuthContext,
  memberId: string | null,
  trainerId: string | null
): Promise<{ ok: true; userId: string | null; gymId: string | null; email: string | null; phone: string | null } | { ok: false; message: string }> {
  if (hasRequiredRole(context.roles, staffRoles)) {
    if (memberId) {
      const { data } = await supabase.from("members").select("user_id,gym_id,email,phone").eq("id", memberId).maybeSingle();
      return { ok: true, userId: data?.user_id ?? null, gymId: data?.gym_id ?? context.profile?.gym_id ?? null, email: data?.email ?? null, phone: data?.phone ?? null };
    }
    if (trainerId) {
      const { data } = await supabase.from("trainers").select("user_id,gym_id,email,phone").eq("id", trainerId).maybeSingle();
      return { ok: true, userId: data?.user_id ?? null, gymId: data?.gym_id ?? context.profile?.gym_id ?? null, email: data?.email ?? null, phone: data?.phone ?? null };
    }
    return { ok: true, userId: null, gymId: context.profile?.gym_id ?? null, email: null, phone: null };
  }

  if (!hasRequiredRole(context.roles, ["trainer"]) || !memberId) {
    return { ok: false, message: "Direct communication access denied." };
  }

  const { data: trainer } = await supabase.from("trainers").select("id,gym_id").eq("user_id", context.userId ?? "").maybeSingle();
  if (!trainer) {
    return { ok: false, message: "Trainer profile not connected." };
  }
  const { data: assignment } = await supabase
    .from("trainer_assignments")
    .select("id")
    .eq("trainer_id", trainer.id)
    .eq("member_id", memberId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) {
    return { ok: false, message: "Trainer can message assigned members only." };
  }
  const { data: member } = await supabase.from("members").select("user_id,gym_id,email,phone").eq("id", memberId).maybeSingle();
  return { ok: true, userId: member?.user_id ?? null, gymId: member?.gym_id ?? trainer.gym_id, email: member?.email ?? null, phone: member?.phone ?? null };
}

async function logDirectChannelMessage(
  supabase: AppSupabase,
  context: AuthContext,
  input: {
    gymId: string | null;
    notificationId: string;
    templateId: string | null;
    userId: string | null;
    memberId: string | null;
    trainerId: string | null;
    email: string | null;
    phone: string | null;
    channel: OutboundChannel;
    title: string;
    body: string;
  }
) {
  if (input.channel === "email" && input.email) {
    await supabase.from("email_logs").insert({
      gym_id: input.gymId,
      notification_id: input.notificationId,
      template_id: input.templateId,
      recipient_user_id: input.userId,
      member_id: input.memberId,
      trainer_id: input.trainerId,
      to_email: input.email,
      subject: input.title,
      status: "queued",
      metadata: { sourceType: "direct", actorId: context.userId } as Json
    });
  }

  if (input.channel === "whatsapp" && input.phone) {
    await supabase.from("whatsapp_logs").insert({
      gym_id: input.gymId,
      notification_id: input.notificationId,
      template_id: input.templateId,
      recipient_user_id: input.userId,
      member_id: input.memberId,
      trainer_id: input.trainerId,
      to_phone: input.phone,
      message: input.body,
      status: "queued",
      metadata: { sourceType: "direct", providerReady: true, actorId: context.userId } as Json
    });
  }

  if (input.channel === "sms" && input.phone) {
    await supabase.from("sms_logs").insert({
      gym_id: input.gymId,
      notification_id: input.notificationId,
      template_id: input.templateId,
      recipient_user_id: input.userId,
      member_id: input.memberId,
      trainer_id: input.trainerId,
      to_phone: input.phone,
      message: input.body.slice(0, 1000),
      status: "queued",
      metadata: { sourceType: "direct", providerReady: true, actorId: context.userId } as Json
    });
  }
}

async function ensureDirectChannelReady(channel: OutboundChannel, email: string | null, phone: string | null) {
  if (channel === "email" && !email) {
    return { ok: false as const, message: "Recipient has no email address." };
  }
  if ((channel === "whatsapp" || channel === "sms") && !phone) {
    return { ok: false as const, message: "Recipient has no phone number." };
  }
  return { ok: true as const };
}

async function getContextRecipientProfile(supabase: AppSupabase, context: AuthContext) {
  const [memberResult, trainerResult] = await Promise.all([
    supabase.from("members").select("id,gym_id").eq("user_id", context.userId ?? "").maybeSingle(),
    supabase.from("trainers").select("id,gym_id").eq("user_id", context.userId ?? "").maybeSingle()
  ]);
  return {
    memberId: memberResult.data?.id ?? null,
    trainerId: trainerResult.data?.id ?? null,
    gymId: memberResult.data?.gym_id ?? trainerResult.data?.gym_id ?? context.profile?.gym_id ?? null
  };
}

function getCampaignChannels(campaignType: "email" | "whatsapp" | "sms" | "multi_channel"): OutboundChannel[] {
  if (campaignType === "multi_channel") {
    return ["in_app", "email", "whatsapp"];
  }
  return [campaignType];
}

function recipientVariables(recipient: SegmentRecipient) {
  return {
    member_name: recipient.member.full_name,
    member_code: recipient.member.member_code,
    email: recipient.email,
    phone: recipient.phone,
    trainer_name: recipient.trainer?.display_name ?? "",
    portal_url: "/member"
  };
}

function paragraphize(bodyText: string) {
  return bodyText.split("\n").filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

async function writeCommunicationAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action,
    entityType,
    entityId,
    metadata
  });
}

function revalidateCommunicationPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/communications");
  revalidatePath("/member");
  revalidatePath("/member/notifications");
  revalidatePath("/trainer");
  revalidatePath("/trainer/communications");
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}
