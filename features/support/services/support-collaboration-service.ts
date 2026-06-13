import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";

type ActiveViewer = {
  userId: string;
  userName: string;
  lastSeenAt: string;
};

const ticketViewers = new Map<string, Map<string, ActiveViewer>>();

export function registerViewer(ticketId: string, userId: string, userName: string) {
  if (!ticketViewers.has(ticketId)) {
    ticketViewers.set(ticketId, new Map());
  }
  const viewers = ticketViewers.get(ticketId)!;
  viewers.set(userId, { userId, userName, lastSeenAt: new Date().toISOString() });
}

export function unregisterViewer(ticketId: string, userId: string) {
  const viewers = ticketViewers.get(ticketId);
  if (viewers) {
    viewers.delete(userId);
    if (viewers.size === 0) ticketViewers.delete(ticketId);
  }
}

export function getActiveViewers(ticketId: string): ActiveViewer[] {
  const viewers = ticketViewers.get(ticketId);
  if (!viewers) return [];

  const now = Date.now();
  const active: ActiveViewer[] = [];
  for (const v of viewers.values()) {
    if (now - new Date(v.lastSeenAt).getTime() < 30000) {
      active.push(v);
    }
  }
  return active;
}

export function heartbeatViewer(ticketId: string, userId: string, userName: string) {
  registerViewer(ticketId, userId, userName);
}

export async function getUnifiedTimeline(ticketId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const [messages, notes, timeline, emails] = await Promise.all([
    sdb.from("support_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    sdb.from("support_ticket_notes").select("*, author:profiles!created_by(id, full_name)").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    sdb.from("support_ticket_timeline").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    sdb.from("support_ticket_messages").select("*").eq("ticket_id", ticketId).eq("channel", "email").order("created_at", { ascending: true }),
  ]);

  type TimelineEntry = {
    id: string;
    type: "message" | "note" | "email" | "whatsapp" | "sms" | "system";
    channel?: string;
    sender: string;
    body: string;
    isInternal?: boolean;
    createdAt: string;
    metadata?: Record<string, unknown>;
  };

  const entries: TimelineEntry[] = [];

  for (const msg of (messages.data ?? []) as Array<Record<string, unknown>>) {
    const channel = msg.channel as string;
    entries.push({
      id: msg.id as string,
      type: ["email", "whatsapp", "sms"].includes(channel) ? (channel as "email" | "whatsapp" | "sms") : "message",
      channel,
      sender: msg.sender_name as string,
      body: msg.body as string,
      createdAt: msg.created_at as string,
    });
  }

  for (const note of (notes.data ?? []) as Array<Record<string, unknown>>) {
    entries.push({
      id: note.id as string,
      type: "note",
      sender: (note.author as Record<string, unknown>)?.full_name as string ?? "Agent",
      body: note.body as string,
      isInternal: note.is_internal as boolean,
      createdAt: note.created_at as string,
    });
  }

  for (const event of (timeline.data ?? []) as Array<Record<string, unknown>>) {
    entries.push({
      id: event.id as string,
      type: "system",
      sender: event.actor_name as string ?? "System",
      body: `${event.event_type as string}: ${event.previous_value as string ?? ""} → ${event.new_value as string ?? ""}`,
      createdAt: event.created_at as string,
      metadata: event.metadata as Record<string, unknown>,
    });
  }

  entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return entries;
}
