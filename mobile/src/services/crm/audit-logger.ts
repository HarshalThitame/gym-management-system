import { getSupabaseClient } from "@/api/supabase";

export type SensitiveAction = 
  | "lead.view" | "lead.create" | "lead.update" | "lead.convert" | "lead.delete" | "lead.restore"
  | "payment.view" | "invoice.view" | "invoice.download"
  | "member.create" | "member.update" | "member.delete"
  | "attendance.override" | "attendance.correction"
  | "sync.conflict" | "sync.resolve"
  | "login.success" | "login.failed" | "logout"
  | "permission.denied" | "role.change" | "subscription.change";

export async function logAuditEvent(params: {
  action: SensitiveAction;
  actorId: string | null;
  organizationId: string | null;
  gymId?: string | null;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("activity_events").insert({
      organization_id: params.organizationId,
      gym_id: params.gymId ?? null,
      actor_id: params.actorId,
      event_type: `audit.${params.action}`,
      entity_type: params.resourceType,
      entity_id: params.resourceId,
      severity: params.action.includes("denied") || params.action.includes("failed") ? "warning" : "info",
      metadata: params.metadata ?? {},
    });
  } catch {}
}

export const auditLogger = {
  async leadView(actorId: string, orgId: string, leadId: string): Promise<void> {
    return logAuditEvent({ action: "lead.view", actorId, organizationId: orgId, resourceType: "lead", resourceId: leadId });
  },
  async leadConvert(actorId: string, orgId: string, leadId: string, memberId: string): Promise<void> {
    return logAuditEvent({ action: "lead.convert", actorId, organizationId: orgId, resourceType: "lead", resourceId: leadId, metadata: { member_id: memberId } });
  },
  async invoiceDownload(actorId: string, orgId: string, invoiceId: string): Promise<void> {
    return logAuditEvent({ action: "invoice.download", actorId, organizationId: orgId, resourceType: "invoice", resourceId: invoiceId });
  },
  async attendanceOverride(actorId: string, gymId: string, orgId: string, sessionId: string): Promise<void> {
    return logAuditEvent({ action: "attendance.override", actorId, organizationId: orgId, gymId, resourceType: "attendance_session", resourceId: sessionId });
  },
  async permissionDenied(actorId: string, orgId: string, resourceType: string, resourceId: string | null, details?: string): Promise<void> {
    return logAuditEvent({ action: "permission.denied", actorId, organizationId: orgId, resourceType, resourceId, metadata: { details } });
  },
  async loginFailed(email: string): Promise<void> {
    return logAuditEvent({ action: "login.failed", actorId: null, organizationId: null, resourceType: "auth", resourceId: email });
  },
  async syncConflict(actorId: string, orgId: string, actionType: string, details: string): Promise<void> {
    return logAuditEvent({ action: "sync.conflict", actorId, organizationId: orgId, resourceType: "sync", resourceId: null, metadata: { action_type: actionType, details } });
  },
};
