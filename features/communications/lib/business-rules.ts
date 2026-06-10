import type { CampaignPerformanceSummaryRow, CommunicationCategory, NotificationPreferenceRow, NotificationTemplateRow, OutboundChannel, RenderedTemplate } from "@/types/communications";
import type { Json } from "@/types/database";

export function slugifyCommunicationName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function formatCommunicationLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function extractTemplateVariables(content: string) {
  const matches = Array.from(content.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g));
  return Array.from(new Set(matches.map((match) => match[1]).filter((value): value is string => Boolean(value))));
}

export function renderTemplate(template: Pick<NotificationTemplateRow, "subject" | "body_text" | "body_html">, variables: Record<string, string | number | null | undefined>): RenderedTemplate {
  return {
    subject: template.subject ? replaceVariables(template.subject, variables) : null,
    bodyText: replaceVariables(template.body_text, variables),
    bodyHtml: template.body_html ? replaceVariables(template.body_html, variables) : null
  };
}

export function shouldDeliverChannel(preferences: NotificationPreferenceRow | null, channel: OutboundChannel, category: CommunicationCategory, transactional = true) {
  if (!preferences) {
    return transactional || category !== "promotions";
  }

  if (preferences.opted_out_at) {
    return false;
  }

  if (!transactional && !preferences.marketing_opt_in) {
    return false;
  }

  if (transactional && !preferences.transactional_opt_in) {
    return false;
  }

  if (!isCategoryEnabled(preferences.category_preferences, category)) {
    return false;
  }

  if (channel === "email") {
    return preferences.email_enabled;
  }
  if (channel === "whatsapp") {
    return preferences.whatsapp_enabled && preferences.whatsapp_opt_in;
  }
  if (channel === "sms") {
    return preferences.sms_enabled && preferences.sms_opt_in;
  }
  if (channel === "push") {
    return preferences.push_enabled;
  }

  return true;
}

export function buildCategoryPreferences(input: Record<CommunicationCategory, boolean>) {
  return {
    membership: input.membership,
    payments: input.payments,
    attendance: input.attendance,
    classes: input.classes,
    workouts: input.workouts,
    nutrition: input.nutrition,
    promotions: input.promotions,
    system: input.system
  };
}

export function calculateCampaignRates(summary: Pick<CampaignPerformanceSummaryRow, "recipients" | "delivered" | "opened" | "clicked" | "failed">) {
  const recipients = summary.recipients ?? 0;
  const delivered = summary.delivered ?? 0;
  const opened = summary.opened ?? 0;
  const clicked = summary.clicked ?? 0;
  const failed = summary.failed ?? 0;

  return {
    deliveryRate: percent(delivered, recipients),
    openRate: percent(opened, delivered),
    clickRate: percent(clicked, opened || delivered),
    failureRate: percent(failed, recipients)
  };
}

export function automationTriggerDescription(triggerKey: string) {
  const descriptions: Record<string, string> = {
    no_attendance_7_days: "Member has not checked in for 7 days.",
    no_attendance_15_days: "Member has not checked in for 15 days.",
    membership_expiry_30_days: "Membership expires in 30 days.",
    membership_expiry_15_days: "Membership expires in 15 days.",
    membership_expiry_7_days: "Membership expires in 7 days.",
    membership_expiry_1_day: "Membership expires tomorrow.",
    class_reminder: "Upcoming class reminder.",
    trainer_session_reminder: "Upcoming personal training session reminder.",
    goal_completed: "Fitness goal has been completed.",
    workout_streak_broken: "Workout streak has been broken."
  };

  return descriptions[triggerKey] ?? formatCommunicationLabel(triggerKey);
}

export function normalizeVariables(value: string) {
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export function parseJsonObject(value: string): { ok: true; value: Json } | { ok: false; message: string } {
  if (!value.trim()) {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(value) as Json;
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Enter valid JSON." };
  }
}

function replaceVariables(content: string, variables: Record<string, string | number | null | undefined>) {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function isCategoryEnabled(preferences: Json, category: CommunicationCategory) {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return true;
  }

  const value = preferences[category];
  return typeof value === "boolean" ? value : true;
}

function percent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 10000) / 100;
}
