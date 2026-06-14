"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import type { AuditTrailEntry, AuditTrailFilters, AuditTrailResult } from "@/features/organization-owner/services/audit-trail-service";
import { getAuditTrailAction } from "@/features/organization-owner/actions/audit-trail-actions";

type AuditTrailViewerProps = {
  organizationId: string;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "<em>null</em>";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function DiffView({ diff }: { diff: Record<string, { before: unknown; after: unknown }> }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(diff);
  if (keys.length === 0) return <span className="text-xs text-muted-foreground">No changes</span>;

  return (
    <div>
      <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setOpen(!open)} type="button">
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {keys.length} field{keys.length > 1 ? "s" : ""} changed
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {keys.map((key) => (
            <div key={key} className="rounded-md border border-border bg-background p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{key}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded bg-red-50 p-2">
                  <p className="text-[10px] font-bold text-red-700">Before</p>
                  <pre className="mt-1 overflow-x-auto text-xs text-red-800">{formatValue(diff[key]?.before)}</pre>
                </div>
                <div className="rounded bg-green-50 p-2">
                  <p className="text-[10px] font-bold text-green-700">After</p>
                  <pre className="mt-1 overflow-x-auto text-xs text-green-800">{formatValue(diff[key]?.after)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const selectClass = "h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function AuditTrailViewer({ organizationId }: AuditTrailViewerProps) {
  const [data, setData] = useState<AuditTrailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditTrailFilters>({ page: 1, pageSize: 20 } as AuditTrailFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditTrailAction(filters);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = useCallback(async () => {
    if (!data) return;
    const csv = ["Action,Entity Type,Severity,Created At"];
    data.entries.forEach((e) => csv.push(`"${e.action}","${e.entityType}","${e.severity}","${e.createdAt}"`));
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Search actions..." value={filters.query ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value, page: 1 }))} />
        </div>
        <select className={selectClass} value={filters.severity ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value || undefined, page: 1 }))}>
          <option value="">All severity</option>
          <option value="info">Info</option>
          <option value="notice">Notice</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select className={selectClass} value={filters.entityType ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value || undefined, page: 1 }))}>
          <option value="">All entities</option>
          <option value="organization">Organization</option>
          <option value="gym">Gym</option>
          <option value="branch">Branch</option>
          <option value="member">Member</option>
          <option value="membership_plan">Plan</option>
          <option value="trainer">Trainer</option>
          <option value="profile">Staff</option>
        </select>
        <input className={selectClass} type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined, page: 1 }))} />
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:border-border-strong" onClick={handleExport} type="button"><Download className="size-3.5" /> CSV</button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading audit trail...</div>
      ) : !data || data.entries.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No audit entries found.</div>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-surface transition-all hover:border-border-strong">
              <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} type="button">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black">{entry.action.replace(/_/g, " ")}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      entry.severity === "critical" ? "bg-red-100 text-red-700" :
                      entry.severity === "warning" ? "bg-amber-100 text-amber-700" :
                      entry.severity === "notice" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{entry.severity}</span>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{entry.entityType}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("en-IN")}</p>
                </div>
                {expandedId === entry.id ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              </button>
              {expandedId === entry.id && entry.diff ? (
                <div className="border-t border-border px-4 py-3">
                  <DiffView diff={entry.diff} />
                  {Object.keys(entry.metadata).length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Metadata</p>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(entry.metadata, null, 2)}</pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted-foreground">Page {filters.page} of {data.totalPages} ({data.total} entries)</p>
          <div className="flex gap-2">
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold disabled:opacity-30" disabled={filters.page <= 1} onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))} type="button">Previous</button>
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold disabled:opacity-30" disabled={filters.page >= data.totalPages} onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))} type="button">Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
