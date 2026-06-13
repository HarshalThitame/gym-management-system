"use client";

import { useState, useActionState, useCallback, useEffect, useRef } from "react";
import type { TicketWithRelations } from "@/types/enterprise";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { updateTicketAction } from "../actions/support-actions";
import { SupportMentionInput } from "./support-mention-input";
import { SupportAiInsights } from "./support-ai-insights";
import { SupportKbRecommendations } from "./support-kb-recommendations";
import { SendHorizontal, Paperclip, AlertTriangle, MessageSquare, User, Bot } from "lucide-react";

const STATUS_OPTIONS = [
  "open", "in_review", "in_progress", "waiting_on_customer",
  "waiting_on_third_party", "resolved", "closed",
] as const;

const PRIORITY_OPTIONS = ["low", "medium", "high", "critical", "emergency"] as const;

function MessageBubble({
  msg,
  isLast,
}: {
  msg: NonNullable<TicketWithRelations["messages"]>[number];
  isLast: boolean;
}) {
  const channelIcons: Record<string, string> = {
    email: "📧", whatsapp: "💬", sms: "📱", in_app: "🔵", push: "🔔", web_chat: "💭", phone: "📞",
  };
  const isOutbound = msg.direction === "outbound";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} ${isLast ? "" : "mb-3"}`}>
      <div className={`flex gap-2.5 max-w-[75%] ${isOutbound ? "flex-row-reverse" : ""}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ${
          isOutbound ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {isOutbound ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        <div>
          <div className={`rounded-2xl px-4 py-2.5 text-sm ${
            isOutbound
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-muted/70 text-foreground rounded-tl-md"
          }`}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
          </div>
          <div className={`flex items-center gap-2 mt-1 ${isOutbound ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground">{msg.sender_name}</span>
            <span className="text-[9px] text-muted-foreground/60">{channelIcons[msg.channel] ?? "💬"}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({ event }: { event: NonNullable<TicketWithRelations["timeline"]>[number] }) {
  const iconMap: Record<string, string> = {
    created: "🆕", status_changed: "🔄", assigned: "👤",
    escalated: "⬆️", note_added: "📝", resolved: "✅", reopened: "🔁",
    closed: "🔒", sla_breached: "⚠️",
  };
  return (
    <div className="flex items-start gap-3 py-1.5 group hover:bg-muted/20 rounded-md px-2 -mx-2 transition-colors">
      <span className="text-sm mt-0.5">{iconMap[event.event_type] ?? "•"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium capitalize">{event.event_type.replace(/_/g, " ")}</p>
          <span className="text-[10px] text-muted-foreground">· {new Date(event.created_at).toLocaleString()}</span>
        </div>
        {event.previous_value && event.new_value && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            <span className="line-through text-muted-foreground/50">{event.previous_value}</span>
            <span className="mx-1">→</span>
            <span className="font-medium">{event.new_value}</span>
          </p>
        )}
        <p className="text-[9px] text-muted-foreground/60">{event.actor_name ?? "System"}</p>
      </div>
    </div>
  );
}

const PriorityDot = ({ p }: { p: string }) => {
  const colors: Record<string, string> = { low: "bg-gray-400", medium: "bg-blue-500", high: "bg-orange-500", critical: "bg-red-500", emergency: "bg-red-600 animate-pulse" };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[p] ?? "bg-gray-400"}`} />;
};

export function SupportTicketDetail({
  ticket,
  users,
}: {
  ticket: TicketWithRelations;
  users?: { id: string; name: string }[];
}) {
  const [updateState, updateAction] = useActionState(updateTicketAction, initialAuthActionState);
  const [activeTab, setActiveTab] = useState<"conversation" | "details" | "timeline">("conversation");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState("");

  const messages = ticket.messages ?? [];
  const notes = ticket.notes ?? [];
  const timeline = ticket.timeline ?? [];
  const attachments = ticket.attachments ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleReply = useCallback(async () => {
    if (!replyText.trim()) return;
    try {
      await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, channel: "in_app", direction: "outbound", senderName: "You", body: replyText }),
      });
      setReplyText("");
    } catch {}
  }, [replyText, ticket.id]);

  const sendMessage = notes.filter((n) => !n.is_internal);
  const internalNotes = notes.filter((n) => n.is_internal);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-background to-muted/20">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <PriorityDot p={ticket.priority} />
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                {ticket.sla_breached && (
                  <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> SLA Breached
                  </span>
                )}
                {ticket.is_escalated && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    Escalated L{ticket.escalation_level}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold leading-tight">{ticket.subject}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{ticket.customer_name}</span>
                {ticket.customer_email && <span>· {ticket.customer_email}</span>}
                <span>· via {ticket.source}</span>
                <span>· {new Date(ticket.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <form action={updateAction} className="flex items-center gap-2 shrink-0">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select name="status" defaultValue={ticket.status}
                onChange={(e) => e.target.form?.requestSubmit()}
                className="h-8 rounded-lg border border-border text-xs px-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
              </select>
              <select name="priority" defaultValue={ticket.priority}
                onChange={(e) => e.target.form?.requestSubmit()}
                className="h-8 rounded-lg border border-border text-xs px-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                {PRIORITY_OPTIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </form>
          </div>
        </div>

        <div className="border-b border-border bg-background">
          <div className="flex">
            {(["conversation", "details", "timeline"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === tab ? "border-primary text-foreground bg-primary/[0.02]" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                }`}>
                {tab === "conversation" ? `Conversation (${messages.length})` : tab === "details" ? "Details" : `Timeline (${timeline.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {activeTab === "conversation" && (
            <div className="p-5 space-y-4">
              <SupportAiInsights
                subject={ticket.subject}
                description={ticket.description}
                organizationId={ticket.organization_id}
                ticketId={ticket.id}
              />

              {ticket.description && (
                <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Original Description</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Start the conversation below</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
                ))
              )}
              <div ref={messagesEndRef} />

              <div className="pt-3 border-t border-border">
                <SupportKbRecommendations text={replyText} organizationId={ticket.organization_id} />
                <div className="flex items-end gap-2 mt-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply... Press Enter to send, Shift+Enter for new line"
                      rows={2}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 pr-10 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); }
                      }}
                    />
                    <button className="absolute right-3 bottom-3 text-muted-foreground hover:text-foreground transition-colors">
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </div>
                  <button onClick={handleReply}
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0">
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Section title="Assignment">
                  <Row label="Agent" value={ticket.assignedAgent ? (ticket.assignedAgent as Record<string, string>).full_name : "Unassigned"} />
                  <Row label="Team" value={ticket.assigned_team ?? "—"} />
                </Section>
                <Section title="Category & Source">
                  <Row label="Category" value={ticket.category?.name ?? "—"} />
                  <Row label="Source" value={ticket.source} />
                  <Row label="Customer Type" value={ticket.customer_type} />
                </Section>
                {internalNotes.length > 0 && (
                  <Section title={`Internal Notes (${internalNotes.length})`}>
                    {internalNotes.map((note) => (
                      <div key={note.id} className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs">
                        <p className="whitespace-pre-wrap">{note.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {(note.author as Record<string, string>)?.full_name ?? "Unknown"} · {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </Section>
                )}
              </div>
              <div className="space-y-3">
                <Section title="SLA & Escalation">
                  <Row label="SLA Breached" value={ticket.sla_breached ? <span className="text-red-600 font-medium">Yes</span> : "No"} />
                  <Row label="Escalation Level" value={`${ticket.escalation_level}/5`} />
                  <Row label="Reopened" value={`${ticket.reopened_count} time${ticket.reopened_count !== 1 ? "s" : ""}`} />
                  {ticket.first_response_at && <Row label="First Response" value={new Date(ticket.first_response_at).toLocaleString()} />}
                  {ticket.resolved_at && <Row label="Resolved At" value={new Date(ticket.resolved_at).toLocaleString()} />}
                  {ticket.closed_at && <Row label="Closed At" value={new Date(ticket.closed_at).toLocaleString()} />}
                </Section>
                {attachments.length > 0 && (
                  <Section title={`Attachments (${attachments.length})`}>
                    {attachments.map((att) => (
                      <a key={att.id} href={att.public_url ?? "#"} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{att.file_name}</span>
                        <span className="text-muted-foreground shrink-0">({Math.round(att.file_size / 1024)} KB)</span>
                      </a>
                    ))}
                  </Section>
                )}
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="p-5">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No timeline events recorded.</p>
              ) : (
                <div className="relative pl-4 border-l-2 border-border/50 space-y-1">
                  {timeline.map((event) => <TimelineEvent key={event.id} event={event} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ticket.assignedAgent && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assigned Agent</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                {(ticket.assignedAgent as Record<string, string>).full_name?.charAt(0) ?? "?"}
              </div>
              <div>
                <p className="text-sm font-medium">{(ticket.assignedAgent as Record<string, string>).full_name}</p>
                <p className="text-xs text-muted-foreground">{ticket.source}</p>
              </div>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timeline</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
            {ticket.resolved_at && <span>· Resolved {new Date(ticket.resolved_at).toLocaleDateString()}</span>}
            {ticket.closed_at && <span>· Closed {new Date(ticket.closed_at).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}
