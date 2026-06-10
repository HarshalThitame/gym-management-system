import { z } from "zod";
import { queueableOfflineActionTypes } from "@/features/pwa/lib/business-rules";

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)])
);

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(12).max(400),
    auth: z.string().min(8).max(200)
  })
});

export const OfflineActionSchema = z.object({
  id: z.string().trim().min(8).max(120),
  type: z.enum(queueableOfflineActionTypes),
  endpoint: z.string().trim().startsWith("/").max(300),
  method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
  payload: jsonValue,
  idempotencyKey: z.string().trim().min(8).max(160),
  createdAt: z.string().datetime()
});

export const OfflineSyncSchema = z.object({
  actions: z.array(OfflineActionSchema).min(1).max(50)
});

export const PwaMetricSchema = z.object({
  id: z.string().trim().min(8).max(120),
  eventType: z.enum(["install_prompt_shown", "install_accepted", "install_dismissed", "standalone_open", "push_opt_in", "offline_action_queued", "offline_sync_completed"]),
  route: z.string().trim().startsWith("/").max(300),
  metadata: jsonValue.default({}),
  createdAt: z.string().datetime()
});

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>;
export type OfflineSyncInput = z.infer<typeof OfflineSyncSchema>;
export type PwaMetricInput = z.infer<typeof PwaMetricSchema>;
