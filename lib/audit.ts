import "server-only";

import { headers } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AuditLogInput = {
  actorId: string | null;
  gymId?: string | null;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Json;
};

function inferAuditContext(action: string, entityType: string, metadata: Json) {
  const enriched = typeof metadata === "object" && metadata !== null && !Array.isArray(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
  const lowerAction = action.toLowerCase();
  const lowerEntity = entityType.toLowerCase();

  if (enriched.module === undefined) {
    if (lowerAction.startsWith("attendance.") || lowerEntity.includes("attendance") || lowerEntity.includes("qr_token")) {
      enriched.module = "attendance";
    } else if (lowerAction.startsWith("entitlement.") || lowerAction.startsWith("subscription.") || lowerAction.startsWith("organization_subscription.")) {
      enriched.module = "entitlement";
    } else if (lowerAction.startsWith("role.") || lowerAction.startsWith("user_role.") || lowerEntity.includes("role")) {
      enriched.module = "security";
    } else if (lowerAction.startsWith("security.")) {
      enriched.module = "security";
    }
  }

  if (enriched.workflow === undefined) {
    if (lowerAction.startsWith("attendance.")) {
      const suffix = action.split(".").slice(1).join(".");
      const workflowMap: Record<string, string> = {
        checked_in: "check_in",
        checked_out: "check_out",
        check_in: "check_in",
        check_out: "check_out",
        qr_generated: "check_in",
        qr_regenerated: "check_in",
        streak_milestone_claim: "membership",
        alert_sent: "alert",
        device_updated: "device",
        device_created: "device",
        device_deleted: "device",
        device_decommissioned: "device",
        device_quarantined: "device",
        device_health_acknowledged: "device",
        device_health_resolved: "device",
        device_mapping_created: "device",
        device_mapping_updated: "device",
        device_mapping_deactivated: "device",
        device_enrollment_claim_issued: "device",
        device_enrollment_claim_reissued: "device",
      };
      enriched.workflow = workflowMap[suffix] ?? "check_in";
    } else if (lowerAction.startsWith("entitlement.")) {
      enriched.workflow = action.includes("reconciliation") ? "reconciliation" : "access";
    } else if (lowerAction.startsWith("role.")) {
      enriched.workflow = "rbac";
    } else if (lowerAction.startsWith("subscription.")) {
      enriched.workflow = "entitlement";
    }
  }

  if (enriched.reasonCode === undefined && typeof enriched.reason_code === "string") {
    enriched.reasonCode = enriched.reason_code;
  }

  if (enriched.reasonCode === undefined && typeof enriched.geofenceReasonCode === "string") {
    enriched.reasonCode = enriched.geofenceReasonCode;
  }

  if (enriched.decision === undefined && typeof enriched.geofenceDecision === "string") {
    enriched.decision = enriched.geofenceDecision;
  }

  return enriched as Json;
}

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
    branch_id: input.branchId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: inferAuditContext(input.action, input.entityType, input.metadata ?? {}),
    ip_address: forwardedFor,
    user_agent: userAgent
  });
}
