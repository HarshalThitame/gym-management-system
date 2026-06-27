import { describe, expect, it } from "vitest";
import type { CampaignPerformanceSummaryRow, NotificationPreferenceRow, NotificationTemplateRow } from "@/types/communications";
import {
  buildCategoryPreferences,
  calculateCampaignRates,
  extractTemplateVariables,
  normalizeVariables,
  parseJsonObject,
  renderTemplate,
  shouldDeliverChannel,
  slugifyCommunicationName
} from "@/features/communications/lib/business-rules";

describe("communication business rules", () => {
  it("normalizes communication names into stable slugs", () => {
    expect(slugifyCommunicationName(" Renewal Reminder: 7 Days! ")).toBe("renewal-reminder-7-days");
  });

  it("extracts and renders template variables", () => {
    const variables = extractTemplateVariables("Hi {{ member_name }}, renew {{plan_name}} before {{ member_name }}.");
    expect(variables).toEqual(["member_name", "plan_name"]);

    const rendered = renderTemplate(template(), {
      member_name: "Aarav",
      plan_name: "Annual Elite",
      expiry_date: "2026-07-01"
    });
    expect(rendered.subject).toBe("Annual Elite renewal");
    expect(rendered.bodyText).toBe("Hi Aarav, your plan expires on 2026-07-01.");
  });

  it("respects marketing opt-out and channel preferences", () => {
    const preferences = preference({
      marketing_opt_in: false,
      whatsapp_enabled: true,
      whatsapp_opt_in: true
    });

    expect(shouldDeliverChannel(preferences, "email", "promotions", false)).toBe(false);
    expect(shouldDeliverChannel(preferences, "whatsapp", "membership", true)).toBe(true);
    expect(shouldDeliverChannel({ ...preferences, whatsapp_opt_in: false }, "whatsapp", "membership", true)).toBe(false);
  });

  it("keeps category preferences explicit and defaults missing categories to enabled", () => {
    const categories = buildCategoryPreferences({
      membership: true,
      payments: true,
      attendance: true,
      classes: true,
      workouts: true,
      nutrition: true,
      promotions: false,
      system: true
    });
    const preferences = preference({ category_preferences: categories });

    expect(shouldDeliverChannel(preferences, "email", "promotions", true)).toBe(false);
    expect(shouldDeliverChannel(preferences, "email", "system", true)).toBe(true);
  });

  it("calculates campaign delivery, open, click, and failure rates", () => {
    expect(calculateCampaignRates(campaignSummary())).toEqual({
      deliveryRate: 80,
      openRate: 50,
      clickRate: 50,
      failureRate: 10
    });
  });

  it("parses template variable input and JSON definitions", () => {
    expect(normalizeVariables("member_name, expiry_date")).toEqual(["member_name", "expiry_date"]);
    expect(normalizeVariables("[\"member_name\",\"plan_name\"]")).toEqual(["member_name", "plan_name"]);
    expect(parseJsonObject("{\"membership_status\":\"active\"}")).toEqual({ ok: true, value: { membership_status: "active" } });
    expect(parseJsonObject("{bad")).toEqual({ ok: false, message: "Enter valid JSON." });
  });
});

function template(): NotificationTemplateRow {
  return {
    id: "template-1",
    gym_id: null,
    branch_id: null,
    name: "Renewal",
    slug: "renewal",
    category: "membership",
    channel: "email",
    subject: "{{plan_name}} renewal",
    body_html: null,
    body_text: "Hi {{member_name}}, your plan expires on {{expiry_date}}.",
    variables: ["member_name", "plan_name", "expiry_date"],
    status: "active",
    version: 1,
    is_system: false,
    created_by: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z"
  };
}

function preference(overrides: Partial<NotificationPreferenceRow> = {}): NotificationPreferenceRow {
  return {
    id: "preference-1",
    gym_id: null,
    branch_id: null,
    user_id: "user-1",
    member_id: "member-1",
    trainer_id: null,
    email_enabled: true,
    whatsapp_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    category_preferences: {
      membership: true,
      payments: true,
      attendance: true,
      classes: true,
      workouts: true,
      nutrition: true,
      promotions: true,
      system: true
    },
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: "Asia/Kolkata",
    marketing_opt_in: true,
    transactional_opt_in: true,
    whatsapp_opt_in: true,
    sms_opt_in: false,
    opted_out_at: null,
    updated_by: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

function campaignSummary(): CampaignPerformanceSummaryRow {
  return {
    gym_id: null,
    campaign_id: "campaign-1",
    name: "Renewals",
    campaign_type: "email",
    status: "completed",
    recipients: 100,
    sent: 90,
    delivered: 80,
    opened: 40,
    clicked: 20,
    failed: 10
  };
}
