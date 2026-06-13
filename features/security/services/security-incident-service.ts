import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export async function listIncidents(options: {
  status?: string;
  severity?: string;
  assignedTo?: string;
  category?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  let q = db.from("security_events").select("*", { count: "exact" });
  if (options.status) q = q.in("status", options.status.split(","));
  if (options.severity) q = q.in("severity", options.severity.split(","));
  if (options.assignedTo) q = q.eq("assigned_to", options.assignedTo);
  if (options.category) q = q.eq("incident_category", options.category);
  if (options.organizationId) q = q.eq("organization_id", options.organizationId);

  const { data, count } = await q.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
  return { incidents: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getIncidentDetail(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [eventResult, investigationsResult] = await Promise.all([
    db.from("security_events").select("*, assignedAgent:profiles!assigned_to(id, full_name), escalatedAgent:profiles!escalated_to(id, full_name)").eq("id", eventId).single(),
    db.from("incident_investigations").select("*, actor:profiles!actor_id(id, full_name)").eq("event_id", eventId).order("created_at", { ascending: true }),
  ]);

  return { event: eventResult.data ?? null, investigations: investigationsResult.data ?? [] };
}

export async function updateIncidentStatus(eventId: string, status: string, note?: string, actorId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const payload: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") payload.resolved_at = new Date().toISOString();

  await db.from("security_events").update(payload).eq("id", eventId);

  if (actorId) {
    await db.from("incident_investigations").insert({
      event_id: eventId,
      action: `status_changed`,
      actor_id: actorId,
      note: note ?? `Status changed to ${status}`,
    });
  }
}

export async function assignIncident(eventId: string, assignedTo: string, assignedBy: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("security_events").update({ assigned_to: assignedTo }).eq("id", eventId);
  await db.from("incident_investigations").insert({
    event_id: eventId, action: "assigned", actor_id: assignedBy,
    note: `Assigned to ${assignedTo}`,
  });
}

export async function addInvestigationNote(eventId: string, note: string, actorId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("incident_investigations").insert({
    event_id: eventId, action: "note_added", actor_id: actorId, note,
  });
}
