import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { ScopedOrganizationOwnerContext } from "@/features/organization-owner/services/organization-owner-service";

type ActivityEventInsert = Database["public"]["Tables"]["activity_events"]["Insert"];

export type AuditLogEntry = {
  id: string;
  action: string;
  actorName: string | null;
  entityType: string;
  entityId: string | null;
  severity: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AuditExportOptions = {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  entityType?: string | undefined;
  severity?: string | undefined;
  format: "csv" | "pdf";
};

export async function logOrgActivity(
  context: ScopedOrganizationOwnerContext,
  eventType: string,
  entityType: string,
  entityId: string | null,
  severity: "info" | "notice" | "warning" | "critical" = "info",
  metadata?: Record<string, unknown>
) {
  const supabase = await createSupabaseServerClient();

  const insert: ActivityEventInsert = {
    organization_id: context.organizationId,
    actor_id: context.userId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    severity,
    metadata: (metadata ?? {}) as Json
  };

  await supabase.from("activity_events").insert(insert);

  await writeAuditLog({
    actorId: context.userId,
    action: `organization_owner.${eventType}`,
    entityType,
    entityId,
    metadata: (metadata ?? {}) as Json
  });
}

export async function getOrgAuditLogs(
  organizationId: string,
  options: { limit?: number; offset?: number; entityType?: string; severity?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("activity_events")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (options.entityType) {
    query = query.eq("entity_type", options.entityType);
  }
  if (options.severity) {
    query = query.eq("severity", options.severity as "info" | "notice" | "warning" | "critical");
  }
  if (options.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }
  if (options.dateTo) {
    query = query.lte("created_at", options.dateTo);
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return {
    entries: (data ?? []).map((event) => ({
      id: event.id,
      action: event.event_type,
      actorName: event.actor_id,
      entityType: event.entity_type,
      entityId: event.entity_id,
      severity: event.severity ?? "info",
      createdAt: event.created_at,
      metadata: (event.metadata ?? {}) as Record<string, unknown>
    })),
    total: count ?? 0
  };
}

export async function exportAuditLogs(organizationId: string, options: AuditExportOptions): Promise<string> {
  const { entries } = await getOrgAuditLogs(organizationId, {
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    entityType: options.entityType,
    severity: options.severity,
    limit: 10000
  } as never);

  if (options.format === "csv") {
    const header = "Action,Actor,Entity Type,Entity ID,Severity,Created At,Metadata\n";
    const rows = entries.map((e) =>
      `"${e.action}","${e.actorName ?? ""}","${e.entityType}","${e.entityId ?? ""}","${e.severity}","${e.createdAt}","${JSON.stringify(e.metadata).replace(/"/g, '""')}"`
    ).join("\n");

    return header + rows;
  }

  return JSON.stringify(entries, null, 2);
}
