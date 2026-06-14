import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];

export type AuditTrailEntry = {
  id: string;
  action: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  severity: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  diff?: Record<string, { before: unknown; after: unknown }> | null;
};

export type AuditTrailFilters = {
  page: number;
  pageSize: number;
  entityType?: string | undefined;
  severity?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  query?: string | undefined;
};

export type AuditTrailResult = {
  entries: AuditTrailEntry[];
  total: number;
  totalPages: number;
};

export async function getAuditTrail(organizationId: string, filters: AuditTrailFilters): Promise<AuditTrailResult> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("activity_events").select("*", { count: "exact" }).eq("organization_id", organizationId);

  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.severity) query = query.eq("severity", filters.severity as "info" | "notice" | "warning" | "critical");
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  const from = (filters.page - 1) * filters.pageSize;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (error) throw new Error(error.message);

  return {
    entries: (data ?? []).map((e) => {
      const metadata = (e.metadata ?? {}) as Record<string, unknown>;
      const diff = metadata._diff as Record<string, { before: unknown; after: unknown }> | undefined;
      const { _diff, ...cleanMetadata } = metadata;
      return {
        id: e.id,
        action: e.event_type,
        actorId: e.actor_id,
        entityType: e.entity_type,
        entityId: e.entity_id,
        severity: e.severity ?? "info",
        createdAt: e.created_at,
        metadata: cleanMetadata,
        diff: diff ?? null
      };
    }),
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / filters.pageSize)
  };
}

export function computeDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of allKeys) {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}
