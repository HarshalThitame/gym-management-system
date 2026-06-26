"use client";

import { useState } from "react";
import { Search, Download, Filter, ChevronDown } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

export function SecurityAuditLog({ logs, total }: { logs: Array<Record<string, unknown>>; total: number }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 25;

  const filtered = logs.filter((log) => {
    if (search && !JSON.stringify(log).toLowerCase().includes(search.toLowerCase())) return false;
    if (actionFilter && !(log.action as string)?.startsWith(actionFilter)) return false;
    return true;
  });

  const actionGroups = [...new Set(logs.map((l) => (l.action as string)?.split(".")[0] ?? "other"))];
  const totalPages = Math.ceil(filtered.length / perPage);
  const pagedLogs = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search audit logs..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[130px]">
          <option value="">All Actions</option>
          {actionGroups.map((g) => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
        </select>
        <a
          href={`/api/super-admin/security/audit/export?format=csv`}
          className="h-9 px-3 rounded-lg border border-border text-xs hover:bg-muted transition-colors flex items-center gap-1.5"
          target="_blank"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </a>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="w-[180px]">Timestamp</div>
          <div className="w-[100px]">User</div>
          <div className="w-[150px]">Action</div>
          <div className="w-[120px]">Entity</div>
          <div className="flex-1">Description</div>
          <div className="w-[120px]">IP Address</div>
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {pagedLogs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No audit logs found</div>
          ) : pagedLogs.map((log) => (
            <div key={log.id as string} className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-xs">
              <span className="text-muted-foreground md:w-[180px] shrink-0">{new Date(log.created_at as string).toLocaleString()}</span>
              <span className="md:w-[100px] shrink-0 font-medium truncate">{(log.actor as Record<string, unknown>)?.full_name as string ?? (log.actor_id as string ?? "").slice(0, 8)}</span>
              <span className="md:w-[150px] shrink-0 font-mono text-[10px] truncate">{log.action as string}</span>
              <span className="md:w-[120px] shrink-0 text-muted-foreground truncate">{log.entity_type as string}</span>
              <span className="flex-1 text-muted-foreground truncate">{JSON.stringify(log.metadata as Record<string, unknown>).slice(0, 80)}</span>
              <span className="md:w-[120px] shrink-0 text-muted-foreground font-mono text-[10px]">{log.ip_address as string ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={perPage}
          totalItems={filtered.length}
        />
      )}

      <div className="text-xs text-muted-foreground">{filtered.length} of {total} logs</div>
    </div>
  );
}
