import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceAuditFilters = {
  page: number;
  pageSize: number;
  search?: string;
  actorId?: string;
  branchId?: string;
  entityType?: string;
  entityId?: string;
  workflow?: string;
  reasonCode?: string;
  decision?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type AttendanceAuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string | null;
  branchId: string | null;
  createdAt: string;
  module: string | null;
  workflow: string | null;
  reasonCode: string | null;
  decision: string | null;
  source: string | null;
  severity: string;
  metadata: Record<string, unknown>;
};

export type AttendanceAuditResult = {
  entries: AttendanceAuditEntry[];
  total: number;
  totalPages: number;
  summary: {
    totalAttendanceEvents: number;
    byWorkflow: Array<{ workflow: string; count: number }>;
    byReasonCode: Array<{ reasonCode: string; count: number }>;
    byDecision: Array<{ decision: string; count: number }>;
  };
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function countMap(values: Array<string | null>): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function sortByCount<T extends { count: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.count - a.count);
}

function extractMetadata(row: Record<string, unknown>) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const workflow = textValue(metadata.workflow) ?? textValue(metadata.geofenceDecision) ?? null;
  const reasonCode =
    textValue(metadata.reasonCode) ??
    textValue(metadata.reason_code) ??
    textValue(metadata.geofenceReasonCode) ??
    textValue(metadata.eligibility) ??
    null;
  const decision = textValue(metadata.decision) ?? textValue(metadata.geofenceDecision) ?? null;
  const source = textValue(metadata.source) ?? null;
  const auditModule = textValue(metadata.module) ?? null;

  return { metadata, workflow, reasonCode, decision, source, auditModule };
}

export async function searchAttendanceAuditDrilldown(filters: AttendanceAuditFilters): Promise<AttendanceAuditResult> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(Math.max(filters.pageSize, 1), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audit_logs")
    .select("*, actor:profiles!actor_id(id, full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false });

  query = query.contains("metadata", { module: "attendance" });
  if (filters.search) {
    const search = filters.search.trim();
    if (search) {
      query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%,metadata::text.ilike.%${search}%`);
    }
  }
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.workflow) query = query.contains("metadata", { workflow: filters.workflow });
  if (filters.reasonCode) query = query.contains("metadata", { reasonCode: filters.reasonCode });
  if (filters.decision) query = query.contains("metadata", { decision: filters.decision });

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const entries = (data ?? []).map((row) => {
    const normalized = row as unknown as Record<string, unknown>;
    const { metadata, workflow, reasonCode, decision, source, auditModule } = extractMetadata(normalized);
    const actor = normalized.actor as { id: string; full_name: string | null; email: string | null } | null | undefined;
    return {
      id: String(normalized.id ?? ""),
      action: String(normalized.action ?? ""),
      actorId: typeof normalized.actor_id === "string" ? normalized.actor_id : null,
      actorName: actor?.full_name ?? null,
      actorEmail: actor?.email ?? null,
      entityType: String(normalized.entity_type ?? ""),
      entityId: typeof normalized.entity_id === "string" ? normalized.entity_id : null,
      branchId: typeof normalized.branch_id === "string" ? normalized.branch_id : null,
      createdAt: String(normalized.created_at ?? ""),
      module: auditModule,
      workflow,
      reasonCode,
      decision,
      source,
      severity: String(normalized.severity ?? "info"),
      metadata,
    };
  });

  const byWorkflow = sortByCount(countMap(entries.map((entry) => entry.workflow))).map(({ key, count }) => ({ workflow: key, count }));
  const byReasonCode = sortByCount(countMap(entries.map((entry) => entry.reasonCode))).map(({ key, count }) => ({ reasonCode: key, count }));
  const byDecision = sortByCount(countMap(entries.map((entry) => entry.decision))).map(({ key, count }) => ({ decision: key, count }));

  return {
    entries,
    total: count ?? entries.length,
    totalPages: Math.max(1, Math.ceil((count ?? entries.length) / pageSize)),
    summary: {
      totalAttendanceEvents: count ?? entries.length,
      byWorkflow,
      byReasonCode,
      byDecision,
    },
  };
}
