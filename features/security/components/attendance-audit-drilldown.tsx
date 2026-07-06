"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";

type AttendanceAuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string | null;
  branchId: string | null;
  createdAt: string;
  module: string | null;
  workflow: string | null;
  reasonCode: string | null;
  decision: string | null;
  source: string | null;
  severity: string;
  metadata: Record<string, unknown>;
};

type AttendanceAuditResult = {
  entries: AttendanceAuditEntry[];
  total: number;
  totalPages: number;
  summary: {
    totalAttendanceEvents: number;
    byWorkflow: Array<{ workflow: string; count: number }>;
    byReasonCode: Array<{ reasonCode: string; count: number }>;
    byDecision: Array<{ decision: string; count: number }>;
  };
};

type Filters = {
  search: string;
  branchId: string;
  actorId: string;
  workflow: string;
  reasonCode: string;
  decision: string;
  entityId: string;
  entityType: string;
  dateFrom: string;
};

const selectClass = "h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

export function AttendanceAuditDrilldown() {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    branchId: "",
    actorId: "",
    workflow: "",
    reasonCode: "",
    decision: "",
    entityId: "",
    entityType: "",
    dateFrom: "",
  });
  const [data, setData] = useState<AttendanceAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) params.set(key, value.trim());
    }
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/super-admin/security/audit/attendance?${queryString}`, { signal: controller.signal });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as AttendanceAuditResult;
        setData(json);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load attendance audit.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryString]);

  const summaries = data?.summary ?? {
    totalAttendanceEvents: 0,
    byWorkflow: [],
    byReasonCode: [],
    byDecision: [],
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance Audit</p>
          <h3 className="mt-1 text-xl font-black">Decision Drilldown</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Trace attendance decisions across check-in, QR, device, geofence, and entitlement denial events. Filters apply directly to the immutable audit log.
          </p>
        </div>
        {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <ShieldCheck className="size-5 text-emerald-600" />}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance events" value={summaries.totalAttendanceEvents} />
        <StatCard label="Top workflows" value={summaries.byWorkflow[0]?.workflow ?? "—"} />
        <StatCard label="Top reason" value={summaries.byReasonCode[0]?.reasonCode ?? "—"} />
        <StatCard label="Top decision" value={summaries.byDecision[0]?.decision ?? "—"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <input className={selectClass} placeholder="Search actions, reasons, metadata..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
        <input className={selectClass} placeholder="Branch ID" value={filters.branchId} onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))} />
        <input className={selectClass} placeholder="Actor ID" value={filters.actorId} onChange={(e) => setFilters((prev) => ({ ...prev, actorId: e.target.value }))} />
        <input className={selectClass} placeholder="Workflow" value={filters.workflow} onChange={(e) => setFilters((prev) => ({ ...prev, workflow: e.target.value }))} />
        <input className={selectClass} placeholder="Reason code" value={filters.reasonCode} onChange={(e) => setFilters((prev) => ({ ...prev, reasonCode: e.target.value }))} />
        <input className={selectClass} placeholder="Decision" value={filters.decision} onChange={(e) => setFilters((prev) => ({ ...prev, decision: e.target.value }))} />
        <input className={selectClass} placeholder="Entity ID" value={filters.entityId} onChange={(e) => setFilters((prev) => ({ ...prev, entityId: e.target.value }))} />
        <select className={selectClass} value={filters.entityType} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))}>
          <option value="">All entity types</option>
          <option value="member">Member</option>
          <option value="membership">Membership</option>
          <option value="attendance_session">Attendance session</option>
          <option value="device">Device</option>
          <option value="roles">Role</option>
          <option value="organization">Organization</option>
        </select>
        <input className={selectClass} type="date" value={filters.dateFrom} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
          <AlertCircle className="mr-2 inline size-4 align-[-2px]" />
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-muted text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Branch</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td className="px-4 py-12 text-center text-sm text-muted-foreground" colSpan={7}>Loading attendance audit...</td></tr>
              ) : data?.entries.length ? data.entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{entry.actorName ?? entry.actorId ?? "System"}</p>
                    <p className="text-xs text-muted-foreground">{entry.actorEmail ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3 text-xs">{entry.workflow ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{entry.reasonCode ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{entry.decision ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{entry.branchId ?? "—"}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-12 text-center text-sm text-muted-foreground" colSpan={7}>No attendance audit entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted-foreground">Page {page} of {data.totalPages} · {data.total} entries</p>
          <div className="flex gap-2">
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} type="button">Previous</button>
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold disabled:opacity-30" disabled={page >= data.totalPages} onClick={() => setPage((prev) => prev + 1)} type="button">Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
