import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export type AuditSearchOptions = {
  userId?: string;
  organizationId?: string;
  action?: string;
  entityType?: string;
  severity?: string;
  ipAddress?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function searchAuditLogs(options: AuditSearchOptions = {}) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 50, 200);
  const offset = (page - 1) * pageSize;

  let q = db.from("audit_logs").select("*, actor:profiles!actor_id(id, full_name, email)", { count: "exact" });
  if (options.userId) q = q.eq("actor_id", options.userId);
  if (options.organizationId) q = q.eq("organization_id", options.organizationId);
  if (options.action) q = q.ilike("action", `%${options.action}%`);
  if (options.entityType) q = q.eq("entity_type", options.entityType);
  if (options.ipAddress) q = q.eq("ip_address", options.ipAddress);
  if (options.dateFrom) q = q.gte("created_at", options.dateFrom);
  if (options.dateTo) q = q.lte("created_at", options.dateTo);

  const { data, count } = await q.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
  return { logs: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getAuditLogById(logId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data } = await db.from("audit_logs").select("*, actor:profiles!actor_id(id, full_name, email)").eq("id", logId).single();
  return data ?? null;
}

export async function getAuditStats() {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [totalResult, todayResult, actionResult] = await Promise.all([
    db.from("audit_logs").select("*", { count: "exact", head: true }),
    db.from("audit_logs").select("*", { count: "exact", head: true }).gte("created_at", new Date().toISOString().slice(0, 10)),
    db.from("audit_logs").select("action", { count: "exact" }).limit(5000),
  ]);

  const actionCounts: Record<string, number> = {};
  for (const log of (actionResult.data ?? []) as Array<Record<string, unknown>>) {
    const action = (log.action as string).split(".")[0] ?? "other";
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
  }

  return {
    total: totalResult.count ?? 0,
    today: todayResult.count ?? 0,
    byAction: Object.entries(actionCounts).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count),
  };
}

export async function getLoginHistory(userId?: string, page = 1, pageSize = 20) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const offset = (page - 1) * pageSize;

  let q = db.from("login_history").select("*", { count: "exact" });
  if (userId) q = q.eq("user_id", userId);

  const { data, count } = await q.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
  return { logs: data ?? [], total: count ?? 0, page, pageSize };
}
