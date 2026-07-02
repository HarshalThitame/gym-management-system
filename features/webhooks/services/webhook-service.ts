import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

export type Webhook = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, any>;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  attempts: number;
  created_at: string;
  delivered_at: string | null;
};

export type WebhookEvent =
  | "member.created"
  | "member.updated"
  | "member.deleted"
  | "lead.created"
  | "lead.updated"
  | "lead.converted"
  | "payment.created"
  | "payment.completed"
  | "payment.failed"
  | "attendance.check_in"
  | "attendance.check_out";

/**
 * Create a new webhook
 */
export async function createWebhook(
  name: string,
  url: string,
  events: WebhookEvent[]
): Promise<Webhook> {
  const supabase = createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw new Error("User has no organization");
  }

  // Generate webhook secret
  const { data: secret } = await adminClient.rpc("generate_webhook_secret");

  if (!secret) {
    throw new Error("Failed to generate webhook secret");
  }

  const { data, error } = await adminClient
    .from("webhooks")
    .insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      name,
      url,
      secret,
      events,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[Webhook] Failed to create webhook:", error);
    throw error;
  }

  return data;
}

/**
 * Get user's webhooks
 */
export async function getUserWebhooks(): Promise<Webhook[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Webhook] Failed to get webhooks:", error);
    return [];
  }

  return data || [];
}

/**
 * Update a webhook
 */
export async function updateWebhook(
  webhookId: string,
  updates: Partial<Pick<Webhook, "name" | "url" | "events" | "is_active">>
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("webhooks")
    .update(updates)
    .eq("id", webhookId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[Webhook] Failed to update webhook:", error);
    throw error;
  }
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", webhookId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[Webhook] Failed to delete webhook:", error);
    throw error;
  }
}

/**
 * Get webhook deliveries
 */
export async function getWebhookDeliveries(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Webhook] Failed to get deliveries:", error);
    return [];
  }

  return data || [];
}

/**
 * Trigger webhook event
 */
export async function triggerWebhookEvent(
  eventType: WebhookEvent,
  payload: Record<string, any>
): Promise<void> {
  const adminClient = createAdminClient();

  // Get all active webhooks subscribed to this event
  const { data: webhooks } = await adminClient
    .from("webhooks")
    .select("*")
    .eq("is_active", true)
    .contains("events", [eventType]);

  if (!webhooks || webhooks.length === 0) {
    return;
  }

  // Deliver to each webhook
  for (const webhook of webhooks) {
    await deliverWebhook(webhook, eventType, payload);
  }
}

/**
 * Deliver webhook to endpoint
 */
async function deliverWebhook(
  webhook: Webhook,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  const adminClient = createAdminClient();

  const body = JSON.stringify({
    id: crypto.randomUUID(),
    event: eventType,
    data: payload,
    created_at: new Date().toISOString(),
  });

  // Create HMAC signature
  const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

  let success = false;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let attempts = 0;

  // Retry up to 3 times
  for (let i = 0; i < 3; i++) {
    attempts++;
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": eventType,
          "User-Agent": "GymManagement-Webhook/1.0",
        },
        body,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      responseStatus = response.status;
      responseBody = await response.text();
      success = response.ok;

      if (success) break;
    } catch (error) {
      responseBody = error instanceof Error ? error.message : "Unknown error";
    }

    // Wait before retry (exponential backoff)
    if (i < 2) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  // Log delivery
  await adminClient.from("webhook_deliveries").insert({
    webhook_id: webhook.id,
    event_type: eventType,
    payload,
    response_status: responseStatus,
    response_body: responseBody,
    success,
    attempts,
    delivered_at: success ? new Date().toISOString() : null,
  });
}

/**
 * Test webhook delivery
 */
export async function testWebhookDelivery(webhookId: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const supabase = createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: webhook, error } = await adminClient
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .single();

  if (error || !webhook) {
    throw new Error("Webhook not found");
  }

  const testPayload = {
    test: true,
    message: "This is a test webhook delivery",
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify({
    id: crypto.randomUUID(),
    event: "test",
    data: testPayload,
    created_at: new Date().toISOString(),
  });

  const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "test",
        "User-Agent": "GymManagement-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.text();

    // Log test delivery
    await adminClient.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: "test",
      payload: testPayload,
      response_status: response.status,
      response_body: responseBody,
      success: response.ok,
      attempts: 1,
      delivered_at: response.ok ? new Date().toISOString() : null,
    });

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? undefined : responseBody,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await adminClient.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: "test",
      payload: testPayload,
      response_status: null,
      response_body: errorMessage,
      success: false,
      attempts: 1,
    });

    return { success: false, error: errorMessage };
  }
}
