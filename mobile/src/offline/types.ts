export type OfflineActionType =
  | "attendance_check_in" | "attendance_check_out"
  | "workout_log" | "nutrition_log" | "profile_update"
  | "class_booking_request"
  | "lead_creation" | "lead_update" | "lead_note" | "follow_up_complete"
  | "task_complete" | "trial_update"
  | "member_registration" | "billing_request" | "notification_read";

export const QUEUEABLE_ACTIONS: readonly OfflineActionType[] = [
  "attendance_check_in", "attendance_check_out",
  "workout_log", "nutrition_log", "profile_update", "class_booking_request",
  "lead_creation", "lead_update", "lead_note", "follow_up_complete",
  "task_complete", "trial_update",
  "member_registration", "billing_request", "notification_read",
];

export type SyncMode = "full" | "partial" | "batch" | "recovery";

export type ConflictStrategy = "last_write_wins" | "timestamp_merge" | "server_wins" | "client_wins";

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  conflictStrategy?: ConflictStrategy;
  originalUpdatedAt?: string;
  priority: "high" | "normal" | "low";
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  errors: Array<{ id: string; error: string; conflict?: boolean }>;
  mode: SyncMode;
}

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  cachedAt: string;
  expiresAt: string | null;
  staleWhileRevalidate: boolean;
  version?: number;
}

export interface ConflictRecord {
  id: string;
  actionId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolvedData: Record<string, unknown> | null;
  strategy: ConflictStrategy;
  status: "pending" | "resolved" | "discarded";
  createdAt: string;
  resolvedAt: string | null;
}

export interface OfflineConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxQueueSize: number;
  syncOnReconnect: boolean;
  cacheDefaultTTLMs: number;
  backgroundSyncIntervalMin: number;
  batchSize: number;
  lowBandwidthMode: boolean;
}

export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  maxRetries: 3,
  retryDelayMs: 5000,
  maxQueueSize: 500,
  syncOnReconnect: true,
  cacheDefaultTTLMs: 24 * 60 * 60 * 1000,
  backgroundSyncIntervalMin: 15,
  batchSize: 25,
  lowBandwidthMode: false,
};

export function isQueueableAction(type: string): type is OfflineActionType {
  return QUEUEABLE_ACTIONS.includes(type as OfflineActionType);
}

export function getActionPriority(type: OfflineActionType): "high" | "normal" | "low" {
  switch (type) {
    case "attendance_check_in": case "attendance_check_out":
    case "member_registration": case "billing_request":
      return "high";
    case "lead_creation": case "lead_update": case "follow_up_complete":
    case "trial_update": case "task_complete": case "notification_read":
      return "normal";
    default:
      return "low";
  }
}

export function getActionEndpoint(type: OfflineActionType, context: Record<string, string>): string {
  const endpoints: Record<string, string> = {
    attendance_check_in: `/attendance/check-in`,
    attendance_check_out: `/attendance/check-out`,
    workout_log: `/workouts/log`,
    nutrition_log: `/nutrition/log`,
    profile_update: `/profile/update`,
    class_booking_request: `/classes/book`,
    lead_creation: `/crm/leads`,
    lead_update: `/crm/leads/${context.leadId ?? ":id"}`,
    lead_note: `/crm/leads/${context.leadId ?? ":id"}/notes`,
    follow_up_complete: `/crm/followups/${context.followUpId ?? ":id"}/complete`,
    task_complete: `/crm/tasks/${context.taskId ?? ":id"}/complete`,
    trial_update: `/crm/trials/${context.trialId ?? ":id"}`,
    member_registration: `/members/register`,
    billing_request: `/billing/payments`,
    notification_read: `/notifications/${context.notificationId ?? ":id"}/read`,
  };
  return endpoints[type] ?? "/sync/unknown";
}
