"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess, hasFeatureAccess } from "@/features/entitlement";
import type { Json } from "@/types/database";
import { createHmac } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WebhookConfig = {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookDeliveryLog = {
  id: string;
  webhook_id: string;
  organization_id: string;
  event_type: string;
  payload: Json | null;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  status: "pending" | "success" | "failed" | "retrying";
  error_message: string | null;
  attempt_count: number;
  created_at: string;
};

type WebhookCreateInput = {
  name: string;
  url: string;
  secret?: string;
  events: string[];
};

type WebhookUpdateInput = {
  name?: string;
  url?: string;
  secret?: string;
  events?: string[];
  is_active?: boolean;
};

type WebhookLogFilters = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateWebhookSecret(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "whsec_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function signPayload(secret: string, payload: Record<string, unknown>): string {
  const body = JSON.stringify(payload);
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Webhook config CRUD ────────────────────────────────────────────────────

export async function getWebhooks(
  organizationId: string,
): Promise<WebhookConfig[]> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.list",
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("webhook_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as WebhookConfig[];
}

export async function getWebhook(
  organizationId: string,
  webhookId: string,
): Promise<WebhookConfig> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.get",
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("webhook_configs")
    .select("*")
    .eq("id", webhookId)
    .eq("organization_id", organizationId)
    .single();

  if (error) throw new Error(error.message);
  return data as WebhookConfig;
}

export async function createWebhook(
  organizationId: string,
  input: WebhookCreateInput,
): Promise<WebhookConfig> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.create",
  });

  if (!input.name?.trim()) throw new Error("Webhook name is required.");
  if (!isValidHttpsUrl(input.url)) throw new Error("URL must be a valid HTTPS URL.");

  const supabase = await createSupabaseServerClient();
  const secret = input.secret || generateWebhookSecret();

  const { data, error } = await supabase
    .from("webhook_configs")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      url: input.url.trim(),
      secret,
      events: input.events,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as WebhookConfig;
}

export async function updateWebhook(
  organizationId: string,
  webhookId: string,
  input: WebhookUpdateInput,
): Promise<WebhookConfig> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.update",
  });

  if (input.url && !isValidHttpsUrl(input.url)) {
    throw new Error("URL must be a valid HTTPS URL.");
  }

  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.url !== undefined) update.url = input.url.trim();
  if (input.secret !== undefined) update.secret = input.secret;
  if (input.events !== undefined) update.events = input.events;
  if (input.is_active !== undefined) update.is_active = input.is_active;

  const { data, error } = await supabase
    .from("webhook_configs")
    .update(update)
    .eq("id", webhookId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as WebhookConfig;
}

export async function deleteWebhook(
  organizationId: string,
  webhookId: string,
): Promise<void> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.delete",
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("webhook_configs")
    .delete()
    .eq("id", webhookId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

// ─── Delivery logs ──────────────────────────────────────────────────────────

export async function getWebhookLogs(
  organizationId: string,
  webhookId?: string,
  filters?: WebhookLogFilters,
): Promise<{ logs: WebhookDeliveryLog[]; total: number }> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.logs",
  });

  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters?.pageSize ?? 20));

  let query = supabase
    .from("webhook_delivery_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (webhookId) {
    query = query.eq("webhook_id", webhookId);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { logs: (data ?? []) as WebhookDeliveryLog[], total: count ?? 0 };
}

export async function retryWebhookDelivery(
  organizationId: string,
  logId: string,
): Promise<WebhookDeliveryLog> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.retry",
  });

  const supabase = await createSupabaseServerClient();

  const { data: log } = await supabase
    .from("webhook_delivery_logs")
    .select("*, webhook_configs(url, secret)")
    .eq("id", logId)
    .eq("organization_id", organizationId)
    .single();

  if (!log) throw new Error("Delivery log not found.");

  const deliveryLog = log as unknown as WebhookDeliveryLog & {
    webhook_configs: { url: string; secret: string | null } | null;
  };

  const webhookUrl = deliveryLog.webhook_configs?.url;
  const webhookSecret = deliveryLog.webhook_configs?.secret;

  if (!webhookUrl) throw new Error("Webhook URL not found.");

  const start = Date.now();
  const payload = (deliveryLog.payload as Record<string, unknown>) ?? {};

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhookSecret) {
      headers["X-Webhook-Signature"] = signPayload(webhookSecret, payload);
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await res.text().catch(() => "");

    await supabase
      .from("webhook_delivery_logs")
      .update({
        status: res.ok ? "success" : "failed",
        response_status: res.status,
        response_body: responseBody.slice(0, 2000),
        duration_ms: Date.now() - start,
        attempt_count: deliveryLog.attempt_count + 1,
        error_message: res.ok ? null : `HTTP ${res.status}`,
      })
      .eq("id", logId);

    await supabase
      .from("webhook_configs")
      .update({ last_triggered_at: new Date().toISOString() })
      .eq("id", deliveryLog.webhook_id);

    return {
      ...deliveryLog,
      status: res.ok ? "success" : "failed",
      response_status: res.status,
      duration_ms: Date.now() - start,
      attempt_count: deliveryLog.attempt_count + 1,
    } as WebhookDeliveryLog;
  } catch (err) {
    await supabase
      .from("webhook_delivery_logs")
      .update({
        status: "failed",
        duration_ms: Date.now() - start,
        attempt_count: deliveryLog.attempt_count + 1,
        error_message: err instanceof Error ? err.message : "Delivery failed",
      })
      .eq("id", logId);

    throw err;
  }
}

// ─── Test ───────────────────────────────────────────────────────────────────

export async function testWebhook(
  organizationId: string,
  webhookId: string,
): Promise<{
  success: boolean;
  statusCode: number;
  responseBody: string;
  durationMs: number;
}> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "webhooks",
    actionName: "webhooks.test",
  });

  const supabase = await createSupabaseServerClient();

  const { data: config } = await supabase
    .from("webhook_configs")
    .select("*")
    .eq("id", webhookId)
    .eq("organization_id", organizationId)
    .single();

  if (!config) throw new Error("Webhook not found.");

  const wh = config as WebhookConfig;
  const testPayload = {
    test: true,
    event: "test",
    organization_id: organizationId,
    timestamp: new Date().toISOString(),
  };

  const start = Date.now();
  let responseBody = "";
  let statusCode = 0;
  let success = false;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (wh.secret) {
      headers["X-Webhook-Signature"] = signPayload(wh.secret, testPayload);
    }

    const res = await fetch(wh.url, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    statusCode = res.status;
    responseBody = await res.text().catch(() => "");
    success = res.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Request failed";
    statusCode = 0;
    success = false;
  }

  const durationMs = Date.now() - start;

  await supabase.from("webhook_delivery_logs").insert({
    webhook_id: webhookId,
    organization_id: organizationId,
    event_type: "test",
    payload: testPayload as unknown as Json,
    response_status: statusCode || null,
    response_body: responseBody.slice(0, 2000),
    duration_ms: durationMs,
    status: success ? "success" : "failed",
    error_message: success ? null : `HTTP ${statusCode || "N/A"}`,
  });

  await supabase
    .from("webhook_configs")
    .update({ last_triggered_at: new Date().toISOString() })
    .eq("id", webhookId);

  return { success, statusCode, responseBody, durationMs };
}

// ─── Internal: trigger outbound webhooks ────────────────────────────────────

export async function triggerWebhooks(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ delivered: number; failed: number }> {
  const hasAccess = await hasFeatureAccess(organizationId, "webhooks");
  if (!hasAccess) return { delivered: 0, failed: 0 };

  const supabase = await createSupabaseServerClient();

  // Server-side filtering: only fetch webhooks matching this event type
  const { data: webhooks } = await supabase
    .from("webhook_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .contains("events", [eventType]);

  const matching = (webhooks ?? []) as WebhookConfig[];

  if (matching.length === 0) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    matching.map(async (wh) => {
      const start = Date.now();
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (wh.secret) {
          headers["X-Webhook-Signature"] = signPayload(wh.secret, payload);
        }

        const res = await fetch(wh.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        await supabase.from("webhook_delivery_logs").insert({
          webhook_id: wh.id,
          organization_id: organizationId,
          event_type: eventType,
          payload: payload as unknown as Json,
          response_status: res.status,
          duration_ms: Date.now() - start,
          status: "success",
        });

        await supabase
          .from("webhook_configs")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", wh.id);

        return { success: true };
      } catch (err) {
        await supabase.from("webhook_delivery_logs").insert({
          webhook_id: wh.id,
          organization_id: organizationId,
          event_type: eventType,
          payload: payload as unknown as Json,
          duration_ms: Date.now() - start,
          status: "failed",
          error_message: err instanceof Error ? err.message : "Delivery failed",
        });

        return { success: false };
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      delivered++;
    } else {
      failed++;
    }
  }

  return { delivered, failed };
}
