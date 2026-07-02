"use server";

import {
  createWebhook,
  getUserWebhooks,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  testWebhookDelivery,
  type WebhookEvent,
} from "../services/webhook-service";

/**
 * Create a new webhook
 */
export async function createWebhookAction(
  name: string,
  url: string,
  events: WebhookEvent[]
) {
  return createWebhook(name, url, events);
}

/**
 * Get user's webhooks
 */
export async function getUserWebhooksAction() {
  return getUserWebhooks();
}

/**
 * Update a webhook
 */
export async function updateWebhookAction(
  webhookId: string,
  updates: { name?: string; url?: string; events?: WebhookEvent[]; is_active?: boolean }
) {
  return updateWebhook(webhookId, updates);
}

/**
 * Delete a webhook
 */
export async function deleteWebhookAction(webhookId: string) {
  return deleteWebhook(webhookId);
}

/**
 * Get webhook deliveries
 */
export async function getWebhookDeliveriesAction(webhookId: string, limit: number = 50) {
  return getWebhookDeliveries(webhookId, limit);
}

/**
 * Test webhook delivery
 */
export async function testWebhookDeliveryAction(webhookId: string) {
  return testWebhookDelivery(webhookId);
}
