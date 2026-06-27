"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Search, RefreshCw, ArrowUpDown, MessageSquare, Clock, Download, UserCheck, AlertTriangle, X } from "lucide-react";
import type { TicketWithRelations } from "@/types/enterprise";
import { SupportSavedViews } from "./support-saved-views";
import { Pagination } from "@/components/ui/pagination";
import { SupportSlaTimerBadge } from "./support-sla-timer-badge";
import type { SavedView } from "../services/support-saved-views-service";
import type { AgentWithWorkload } from "../services/support-assignment-service";
import { assignTicketAction, bulkUpdateTicketsAction } from "../actions/support-actions";
import { computeSlaRemainingMinutes } from "../lib/sla-utils";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_review: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200",
  waiting_on_customer: "bg-purple-50 text-purple-700 border-purple-200",
  waiting_on_third_party: "bg-orange-50 text-orange-700 border-orange-200",
  resolved: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-gray-50 text-gray-500 border-gray-200",
  reopened: "bg-red-50 text-red-700 border-red-200",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-gray-50 text-gray-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
  emergency: "bg-red-100 text-red-900",
};

type SortField = "ticket_number" | "subject" | "customer_name" | "priority" | "status" | "created_at" | "sla_urgency";
type SortDir = "asc" | "desc";

function getSlaMinutes(ticket: TicketWithRelations): number {
  return ticket.slaPolicy?.resolution_minutes ?? ticket.slaPolicy?.first_response_minutes ?? 240;
}

function getSlaBorderColor(ticket: TicketWithRelations): string {
  if (!ticket.sla_policy_id) return "border-l-transparent";
  const sla = computeSlaRemainingMinutes(ticket.created_at, getSlaMinutes(ticket), ticket.sla_breached);
  if (sla.status === "breached") return "border-l-red-500";
  if (sla.status === "warning") return "border-l-amber-500";
  return "border-l-green-500";
}

function getSlaUrgencySortKey(ticket: TicketWithRelations): number {
  if (!ticket.sla_policy_id) return 999999;
  const sla = computeSlaRemainingMinutes(ticket.created_at, getSlaMinutes(ticket), ticket.sla_breached);
  if (sla.status === "breached") return -1;
  return sla.remainingMinutes;
}

export function SupportInbox({
  tickets,
  total,
  page,
  pageSize,
  onRefresh,
  savedViews,
  activeViewId,
  onSelectView,
  onSaveView,
  onDeleteView,
  agents,
  currentUserId,
}: {
  tickets: TicketWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  onRefresh: () => void;
  savedViews: SavedView[];
  activeViewId: string | undefined;
  onSelectView: (view: SavedView) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (viewId: string) => void;
  agents: AgentWithWorkload[] | undefined;
  currentUserId: string | undefined;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") ?? "");
  const [slaBreachedFilter, setSlaBreachedFilter] = useState(searchParams.get("sla_breached") === "true");
  const [myTicketsOnly, setMyTicketsOnly] = useState(searchParams.get("my_tickets") === "true");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...tickets];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      const statuses = statusFilter.split(",");
      result = result.filter((t) => statuses.includes(t.status));
    }
    if (priorityFilter) {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (slaBreachedFilter) {
      result = result.filter((t) => t.sla_breached);
    }
    if (myTicketsOnly && currentUserId) {
      result = result.filter((t) => t.assigned_to === currentUserId);
    }
    result.sort((a, b) => {
      if (sortField === "sla_urgency") {
        return sortDir === "asc"
          ? getSlaUrgencySortKey(a) - getSlaUrgencySortKey(b)
          : getSlaUrgencySortKey(b) - getSlaUrgencySortKey(a);
      }
      const aVal = String(a[sortField as keyof TicketWithRelations] ?? "");
      const bVal = String(b[sortField as keyof TicketWithRelations] ?? "");
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [tickets, search, statusFilter, priorityFilter, slaBreachedFilter, myTicketsOnly, currentUserId, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }, [selected, filtered]);

  const handleRowClick = useCallback((id: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".checkbox-cell, .assignee-cell, .stop-propagation")) return;
    router.push(`/super-admin/support/${id}`);
  }, [router]);

  const updateUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) p.set(k, v);
      else p.delete(k);
    });
    router.push(`/super-admin/support?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const [isPending, startTransition] = useTransition();

  const handleBulkAction = useCallback((action: string, value: string) => {
    const formData = new FormData();
    formData.set("ticketIds", JSON.stringify(Array.from(selected)));
    if (action === "assign") formData.set("assignedTo", value);
    if (action === "status") formData.set("status", value);
    if (action === "priority") formData.set("priority", value);
    startTransition(() => {
      const fd = formData;
      bulkUpdateTicketsAction({ status: "idle", message: "" }, fd);
    });
    setSelected(new Set());
  }, [selected]);

  const handleAssignTicket = useCallback((ticketId: string, agentId: string) => {
    const formData = new FormData();
    formData.set("ticketId", ticketId);
    formData.set("assignedTo", agentId);
    formData.set("assignmentType", "manual");
    startTransition(() => {
      assignTicketAction({ status: "idle", message: "" }, formData);
    });
    setAssigningTicketId(null);
  }, [startTransition]);

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${className ?? ""}`}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "opacity-30"}`} />
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {savedViews && onSelectView && onSaveView && onDeleteView && (
          <SupportSavedViews
            views={savedViews}
            activeViewId={activeViewId}
            onSelect={onSelectView}
            onSave={onSaveView}
            onDelete={onDeleteView}
          />
        )}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ticket #, subject, or customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); updateUrl({ q: e.target.value }); }}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); updateUrl({ status: e.target.value }); }}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[130px] focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Statuses</option>
          <option value="open, in_review, in_progress">Active</option>
          <option value="open">Open</option>
          <option value="in_review">In Review</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_on_customer">Waiting on Customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="reopened">Reopened</option>
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); updateUrl({ priority: e.target.value }); }}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[110px] focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Priorities</option>
          <option value="emergency">Emergency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={() => { setSlaBreachedFilter(!slaBreachedFilter); updateUrl({ sla_breached: !slaBreachedFilter ? "true" : "" }); }}
          className={`h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
            slaBreachedFilter ? "bg-red-50 border-red-200 text-red-700" : "border-border bg-background hover:bg-muted"
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          SLA Breached
        </button>
        {currentUserId && (
          <button
            onClick={() => { setMyTicketsOnly(!myTicketsOnly); updateUrl({ my_tickets: !myTicketsOnly ? "true" : "" }); }}
            className={`h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              myTicketsOnly ? "bg-primary/10 border-primary/30 text-primary" : "border-border bg-background hover:bg-muted"
            }`}
          >
            <UserCheck className="h-3 w-3" />
            My Tickets
          </button>
        )}
        <button onClick={onRefresh} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <a
          href={`/api/super-admin/support/export?format=csv`}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted transition-colors"
          target="_blank"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </a>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg sticky top-0 z-10">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium">{selected.size} selected</span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              <select
                onChange={(e) => { if (e.target.value) { handleBulkAction("status", e.target.value); e.target.value = ""; } }}
                className="h-7 rounded-md border border-border bg-background px-2 text-[10px] font-medium focus:outline-none"
              >
                <option value="">Change Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                onChange={(e) => { if (e.target.value) { handleBulkAction("priority", e.target.value); e.target.value = ""; } }}
                className="h-7 rounded-md border border-border bg-background px-2 text-[10px] font-medium focus:outline-none"
              >
                <option value="">Change Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              {agents && agents.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) { handleBulkAction("assign", e.target.value); e.target.value = ""; } }}
                  className="h-7 rounded-md border border-border bg-background px-2 text-[10px] font-medium focus:outline-none"
                >
                  <option value="">Assign to...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.activeTicketCount} tickets)</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <button onClick={() => setSelected(new Set())} className="p-1 hover:text-foreground text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border">
          <div className="w-8 flex items-center">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="checkbox-cell rounded border-border h-3.5 w-3.5 cursor-pointer"
            />
          </div>
          <div className="w-[100px]"><SortHeader field="ticket_number" label="Ticket" /></div>
          <div className="flex-1 min-w-0"><SortHeader field="subject" label="Subject" /></div>
          <div className="w-[140px]"><SortHeader field="customer_name" label="Customer" /></div>
          <div className="w-[90px]"><SortHeader field="priority" label="Priority" /></div>
          <div className="w-[100px]"><SortHeader field="status" label="Status" /></div>
          <div className="w-[120px]"><SortHeader field="created_at" label="Created" /></div>
          <div className="w-[100px]"><SortHeader field="sla_urgency" label="SLA" /></div>
          <div className="w-[120px]"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assignee</span></div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter || priorityFilter || slaBreachedFilter || myTicketsOnly
                  ? "No tickets match your filters"
                  : "No tickets yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || statusFilter || priorityFilter || slaBreachedFilter || myTicketsOnly
                  ? "Try adjusting your search or filters"
                  : "Create your first support ticket"}
              </p>
            </div>
          ) : (
            filtered.map((ticket, idx) => {
              const created = new Date(ticket.created_at);
              const isSelected = selected.has(ticket.id);
              const slaMinutes = ticket.sla_policy_id ? getSlaMinutes(ticket) : undefined;
              const borderColor = getSlaBorderColor(ticket);
              const assignedAgent = agents?.find((a) => a.id === ticket.assigned_to);

              return (
                <div
                  key={ticket.id}
                  onClick={(e) => handleRowClick(ticket.id, e)}
                  className={`flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 px-3 md:px-4 py-3 cursor-pointer transition-all hover:bg-muted/30 border-l-2 ${borderColor} reveal-up ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(ticket.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="checkbox-cell rounded border-border h-3.5 w-3.5 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-mono text-muted-foreground md:hidden">{ticket.ticket_number}</span>
                  </div>

                  <span className="hidden md:block text-xs font-mono text-muted-foreground w-[100px] shrink-0">{ticket.ticket_number}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      {ticket.is_escalated && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">ESC L{ticket.escalation_level}</span>
                      )}
                      {ticket.reopened_count > 0 && (
                        <span className="text-[9px] text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded shrink-0">{ticket.reopened_count}x reopened</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate md:hidden">{ticket.customer_name}</span>
                      <span className="hidden md:inline text-xs text-muted-foreground">{ticket.category?.name ?? "Uncategorized"}</span>
                      <span className="text-[10px] text-muted-foreground md:hidden">{created.toLocaleDateString()}</span>
                    </div>
                  </div>

                  <span className="hidden md:block text-xs text-muted-foreground w-[140px] shrink-0 truncate">{ticket.customer_name}</span>

                  <div className="flex items-center gap-2 md:gap-0 w-full md:w-auto">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${PRIORITY_BADGE[ticket.priority] ?? "bg-gray-50 text-gray-600"} w-[90px] shrink-0 justify-center`}>
                      {ticket.priority}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_BADGE[ticket.status] ?? "bg-gray-50 text-gray-600"} w-[100px] shrink-0 justify-center`}>
                      {ticket.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <span className="hidden md:block text-xs text-muted-foreground w-[120px] shrink-0">
                    {created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>

                  <div className="w-[100px] shrink-0 hidden md:block">
                    {slaMinutes !== undefined && (
                      <SupportSlaTimerBadge
                        createdAt={ticket.created_at}
                        slaMinutes={slaMinutes}
                        slaBreached={ticket.sla_breached}
                      />
                    )}
                  </div>

                  <div className="w-[120px] shrink-0 hidden md:flex items-center gap-1 assignee-cell">
                    {agents && agents.length > 0 ? (
                      <div className="relative stop-propagation">
                        <button
                          onClick={(e) => { e.stopPropagation(); setAssigningTicketId(assigningTicketId === ticket.id ? null : ticket.id); }}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                            assignedAgent
                              ? "bg-muted/50 border-border hover:bg-muted"
                              : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50"
                          }`}
                        >
                          {assignedAgent ? (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span className="truncate max-w-[80px]">{assignedAgent.name}</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span>Unassigned</span>
                            </>
                          )}
                        </button>
                        {assigningTicketId === ticket.id && (
                          <div className="absolute top-full left-0 mt-1 z-20 w-52 rounded-lg border border-border bg-card shadow-xl p-1.5" onClick={(e) => e.stopPropagation()}>
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              <button
                                onClick={() => handleAssignTicket(ticket.id, "")}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-muted ${!ticket.assigned_to ? "bg-muted/50" : ""}`}
                              >
                                <span className="text-muted-foreground">—</span>
                                <span>Unassign</span>
                              </button>
                              {agents.map((agent) => (
                                <button
                                  key={agent.id}
                                  onClick={() => handleAssignTicket(ticket.id, agent.id)}
                                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-muted ${
                                    ticket.assigned_to === agent.id ? "bg-primary/5" : ""
                                  }`}
                                >
                                  <span className="font-medium truncate">{agent.name}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{agent.activeTicketCount}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {assignedAgent?.name ?? <span className="italic">Unassigned</span>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {total > pageSize && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          onPageChange={(p) => { const params = new URLSearchParams(searchParams.toString()); params.set("page", String(p)); router.push(`/super-admin/support?${params.toString()}`); }}
          pageSize={pageSize}
          totalItems={total}
        />
      )}
    </div>
  );
}
