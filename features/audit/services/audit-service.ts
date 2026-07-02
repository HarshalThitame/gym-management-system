import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

export type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

export type AuditLogFilters = {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  gymId?: string;
  branchId?: string;
  organizationId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export type AuditLogResult = {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AuditLogStats = {
  totalLogs: number;
  todayLogs: number;
  weekLogs: number;
  topActions: Array<{ action: string; count: number }>;
  topActors: Array<{ actorId: string; actorName: string | null; count: number }>;
  topEntities: Array<{ entityType: string; count: number }>;
};

export async function getAuditLogs(
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<AuditLogResult> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters.actorId) {
    query = query.eq("actor_id", filters.actorId);
  }
  if (filters.action) {
    query = query.eq("action", filters.action);
  }
  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }
  if (filters.gymId) {
    query = query.eq("gym_id", filters.gymId);
  }
  if (filters.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }
  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId);
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%,metadata::text.ilike.%${filters.search}%`);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    logs: data ?? [],
    total,
    page,
    pageSize,
    totalPages
  };
}

export async function getAuditLogStats(
  organizationId?: string,
  gymId?: string
): Promise<AuditLogStats> {
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  let baseQuery = supabase.from("audit_logs").select("*", { count: "exact", head: false });
  if (organizationId) baseQuery = baseQuery.eq("organization_id", organizationId);
  if (gymId) baseQuery = baseQuery.eq("gym_id", gymId);

  const [totalResult, todayResult, weekResult] = await Promise.all([
    baseQuery,
    supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .then((r) => r),
    supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString())
      .then((r) => r)
  ]);

  // Get top actions
  const { data: actionData } = await supabase
    .from("audit_logs")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(1000);

  const actionCounts = new Map<string, number>();
  (actionData ?? []).forEach((log) => {
    actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1);
  });
  const topActions = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get top actors
  const { data: actorData } = await supabase
    .from("audit_logs")
    .select("actor_id")
    .order("created_at", { ascending: false })
    .limit(1000);

  const actorCounts = new Map<string, number>();
  (actorData ?? []).forEach((log) => {
    if (log.actor_id) {
      actorCounts.set(log.actor_id, (actorCounts.get(log.actor_id) ?? 0) + 1);
    }
  });
  const topActorIds = Array.from(actorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  // Get actor names
  let topActors: Array<{ actorId: string; actorName: string | null; count: number }> = [];
  if (topActorIds.length > 0) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", topActorIds);

    const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name]));
    topActors = topActorIds.map((id) => ({
      actorId: id,
      actorName: userMap.get(id) ?? null,
      count: actorCounts.get(id) ?? 0
    }));
  }

  // Get top entity types
  const { data: entityData } = await supabase
    .from("audit_logs")
    .select("entity_type")
    .order("created_at", { ascending: false })
    .limit(1000);

  const entityCounts = new Map<string, number>();
  (entityData ?? []).forEach((log) => {
    entityCounts.set(log.entity_type, (entityCounts.get(log.entity_type) ?? 0) + 1);
  });
  const topEntities = Array.from(entityCounts.entries())
    .map(([entityType, count]) => ({ entityType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalLogs: totalResult.count ?? 0,
    todayLogs: todayResult.count ?? 0,
    weekLogs: weekResult.count ?? 0,
    topActions,
    topActors,
    topEntities
  };
}

export async function getAuditLogById(id: string): Promise<AuditLogRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEntityAuditLogs(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<AuditLogRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDistinctActions(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return [];

  const actions = new Set((data ?? []).map((log) => log.action));
  return Array.from(actions).sort();
}

export async function getDistinctEntityTypes(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("entity_type")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return [];

  const types = new Set((data ?? []).map((log) => log.entity_type));
  return Array.from(types).sort();
}

export async function exportAuditLogsCsv(filters: AuditLogFilters = {}): Promise<string> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const logs = data ?? [];
  const header = "ID,Timestamp,Actor ID,Action,Entity Type,Entity ID,IP Address,Metadata";
  const rows = logs.map((log) => {
    const metadata = typeof log.metadata === "object" ? JSON.stringify(log.metadata) : String(log.metadata ?? "");
    return [
      log.id,
      log.created_at,
      log.actor_id ?? "",
      log.action,
      log.entity_type,
      log.entity_id ?? "",
      log.ip_address ?? "",
      `"${metadata.replace(/"/g, '""')}"`
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
