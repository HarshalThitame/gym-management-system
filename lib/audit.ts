import { headers } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AuditLogInput = {
  actorId: string | null;
  gymId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Json;
};

export async function writeAuditLog(input: AuditLogInput) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = requestHeaders.get("user-agent");

  await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    gym_id: input.gymId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip_address: forwardedFor,
    user_agent: userAgent
  });
}
