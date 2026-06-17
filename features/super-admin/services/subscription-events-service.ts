import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { Json } from "@/types/database";

export type SubscriptionEventType =
  | "created" | "plan_changed" | "status_changed" | "trial_started"
  | "trial_converted" | "trial_expired" | "trial_extended"
  | "renewed" | "renewal_failed" | "renewal_reminder_sent"
  | "cancelled" | "cancellation_scheduled" | "cancellation_reverted"
  | "suspended" | "subscription_suspended" | "reactivated"
  | "upgraded" | "downgraded" | "downgrade_scheduled" | "downgrade_applied" | "downgrade_cancelled"
  | "payment_failed" | "payment_recovered"
  | "addon_added" | "addon_removed" | "addon_quantity_changed"
  | "limit_warning" | "limit_exceeded"
  | "price_override_set" | "billing_period_changed"
  | "dunning_started" | "dunning_attempt" | "dunning_succeeded"
  | "trial_reminder_sent";

export type SubscriptionEventInput = {
  organizationId: string;
  subscriptionId?: string | null;
  eventType: SubscriptionEventType;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, Json>;
};

type EventInsert = {
  organization_id: string;
  subscription_id: string | null;
  event_type: string;
  previous_state: Json | null;
  new_state: Json | null;
  actor_id: string | null;
  reason: string | null;
  metadata: Json;
};

type EventsQuery = {
  select(columns: string): EventsSelectQuery;
  insert(row: EventInsert): Promise<{ error: { message: string } | null }>;
  eq(column: string, value: string): EventsQuery;
  order(column: string, options: { ascending: boolean }): EventsQuery;
  range(from: number, to: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
};

type EventsSelectQuery = EventsQuery & {
  insert(row: EventInsert): Promise<{ error: { message: string } | null }>;
};

type EventsClient = {
  from(table: "subscription_events"): EventsQuery;
};

export async function recordSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const payload: EventInsert = {
    organization_id: input.organizationId,
    subscription_id: input.subscriptionId ?? null,
    event_type: input.eventType,
    previous_state: (input.previousState ?? null) as Json | null,
    new_state: (input.newState ?? null) as Json | null,
    actor_id: input.actorId ?? null,
    reason: input.reason ?? null,
    metadata: (input.metadata ?? {}) as Json,
  };

  const client = supabase as never as EventsClient;
  const { error: insertError } = await client.from("subscription_events").insert(payload);
  if (insertError) {
    console.error("[subscription-events] Failed to record event", { eventType: input.eventType, message: insertError.message });
  }

  await writeAuditLog({
    actorId: input.actorId ?? "system",
    action: `subscription.${input.eventType}`,
    entityType: "organization_subscription",
    entityId: input.subscriptionId ?? input.organizationId,
    metadata: { eventType: input.eventType, reason: input.reason, ...(input.metadata ?? {}) } as Json,
  });
}

export async function getSubscriptionEvents(
  organizationId: string,
  options?: { limit?: number; offset?: number }
): Promise<Array<Record<string, unknown>>> {
  const supabase = await createSupabaseServerClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await (supabase as never as EventsClient)
    .from("subscription_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return data ?? [];
}
