import "server-only";

import { getRedisClient } from "@/lib/cache/redis";

export type AttendanceEvent =
  | { type: "check_in"; session_id: string; member_id: string; gym_id: string; organization_id: string; branch_id?: string }
  | { type: "check_out"; session_id: string; member_id: string; gym_id: string; organization_id: string; branch_id?: string }
  | { type: "auto_checkout"; session_id: string; member_id: string; gym_id: string; organization_id: string; reason?: string }
  | { type: "occupancy_update"; gym_id: string; organization_id: string; inside_count: number; capacity_percent?: number }
  | { type: "alert"; gym_id: string; organization_id: string; severity: "low" | "medium" | "high"; message: string; member_id?: string };

const EVENT_CHANNEL = "attendance:events";

export async function publishAttendanceEvent(event: AttendanceEvent): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  const payload = {
    ...event,
    timestamp: Date.now(),
  };

  try {
    await client.publish(EVENT_CHANNEL, JSON.stringify(payload));
  } catch (err) {
    console.error("[EventBus] Failed to publish event:", err);
  }
}

export async function subscribeToEvents(
  onEvent: (event: AttendanceEvent) => void
): Promise<() => void> {
  const client = getRedisClient();
  if (!client) {
    console.warn("[EventBus] Redis unavailable; events not subscribed");
    return () => {};
  }

  const subscriber = client.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(EVENT_CHANNEL, (message) => {
    try {
      const event = JSON.parse(message) as AttendanceEvent;
      onEvent(event);
    } catch {
      console.error("[EventBus] Failed to parse event message");
    }
  });

  return () => {
    subscriber.unsubscribe(EVENT_CHANNEL).catch(() => {});
    subscriber.quit().catch(() => {});
  };
}
