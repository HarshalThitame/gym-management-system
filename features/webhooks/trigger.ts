import { triggerWebhooks } from "@/features/organization-owner/actions/webhook-actions";

export const WEBHOOK_EVENTS = {
  MEMBER_CREATED: "member.created",
  MEMBER_UPDATED: "member.updated",
  MEMBER_DELETED: "member.deleted",
  PAYMENT_RECEIVED: "payment.received",
  PAYMENT_FAILED: "payment.failed",
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
  CLASS_BOOKED: "class.booked",
  CLASS_CANCELLED: "class.cancelled",
  LEAD_CREATED: "lead.created",
  LEAD_UPDATED: "lead.updated",
  LEAD_CONVERTED: "lead.converted",
  MEMBERSHIP_RENEWED: "membership.renewed",
  MEMBERSHIP_EXPIRED: "membership.expired",
} as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

/**
 * Centralized webhook trigger. Import and call from source actions
 * after the primary operation succeeds. Always fire-and-forget.
 *
 * Usage:
 *   import { triggerWebhook } from "@/features/webhooks/trigger";
 *   triggerWebhook(orgId, "member.created", memberData).catch(() => {});
 */
export async function triggerWebhook(
  organizationId: string,
  eventType: WebhookEventType | string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await triggerWebhooks(organizationId, eventType, payload);
  } catch {
    // Silent — webhook delivery should never block source actions
  }
}
