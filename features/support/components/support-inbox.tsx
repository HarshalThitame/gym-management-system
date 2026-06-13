"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Search, RefreshCw, ArrowUpDown, MessageSquare, Clock } from "lucide-react";
import type { TicketWithRelations } from "@/types/enterprise";
import { SupportBulkActions } from "./support-bulk-actions";
import { SupportSavedViews } from "./support-saved-views";
import { SupportSlaTimerBadge } from "./support-sla-timer-badge";
import type { SavedView } from "../services/support-saved-views-service";

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

type SortField = "ticket_number" | "subject" | "customer_name" | "priority" | "status" | "created_at";
type SortDir = "asc" | "desc";

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
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    result.sort((a, b) => {
      const aVal = String(a[sortField as keyof TicketWithRelations] ?? "");
      const bVal = String(b[sortField as keyof TicketWithRelations] ?? "");
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [tickets, search, statusFilter, priorityFilter, sortField, sortDir]);

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
    if ((e.target as HTMLElement).closest(".checkbox-cell")) return;
    router.push(`/super-admin/support/${id}`);
  }, [router]);

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${className ?? ""}`}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "opacity-30"}`} />
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
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
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[110px] focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Priorities</option>
          <option value="emergency">Emergency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={onRefresh} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {selected.size > 0 && (
        <SupportBulkActions
          selectedCount={selected.size}
          onAssign={() => {}}
          onSetPriority={() => {}}
          onSetStatus={() => {}}
          onEscalate={() => {}}
          onClose={() => {}}
          onClear={() => setSelected(new Set())}
        />
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
          <div className="w-[100px]"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SLA</span></div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter || priorityFilter ? "No tickets match your filters" : "No tickets yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || statusFilter || priorityFilter ? "Try adjusting your search or filters" : "Create your first support ticket"}
              </p>
            </div>
          ) : (
            filtered.map((ticket, idx) => {
              const created = new Date(ticket.created_at);
              const isSelected = selected.has(ticket.id);
              const slaMinutes = ticket.sla_policy_id ? 240 : undefined;

              return (
                <div
                  key={ticket.id}
                  onClick={(e) => handleRowClick(ticket.id, e)}
                  className={`flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 px-3 md:px-4 py-3 cursor-pointer transition-all hover:bg-muted/30 ${
                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
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
                    {slaMinutes && (
                      <SupportSlaTimerBadge
                        createdAt={ticket.created_at}
                        slaMinutes={slaMinutes}
                        slaBreached={ticket.sla_breached}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1).slice(0, 7).map((p) => (
              <button key={p} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {p}
              </button>
            ))}
            {Math.ceil(total / pageSize) > 7 && <span className="px-1">...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
