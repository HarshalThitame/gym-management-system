"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Calendar, CheckCircle2, Clock, Download, Eye, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { reverseAttendanceAction } from "../actions/attendance-correction-actions";
import type { AttendanceLogRow } from "@/types/attendance";

type AttendanceHistoryProps = {
  logs: AttendanceLogRow[];
  total: number;
  memberNames?: Record<string, string>;
  gymNames?: Record<string, string>;
};

type SortField = "occurred_at" | "action" | "result";
type SortDir = "asc" | "desc";

export function AttendanceHistory({ logs, total, memberNames = {}, gymNames = {} }: AttendanceHistoryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("occurred_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedLog, setSelectedLog] = useState<AttendanceLogRow | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);

  const [reverseState, reverseAction] = useActionState(reverseAttendanceAction, initialAuthActionState);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...logs];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((l) =>
        (l.id ?? "").toLowerCase().includes(q) ||
        (l.member_id ?? "").toLowerCase().includes(q) ||
        (l.message ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((l) => l.result === statusFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (dateFrom) {
      result = result.filter((l) => l.occurred_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((l) => l.occurred_at <= `${dateTo}T23:59:59.999Z`);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "occurred_at") cmp = a.occurred_at.localeCompare(b.occurred_at);
      else if (sortField === "action") cmp = a.action.localeCompare(b.action);
      else if (sortField === "result") cmp = a.result.localeCompare(b.result);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [logs, search, statusFilter, sourceFilter, dateFrom, dateTo, sortField, sortDir]);

  const uniqueSources = useMemo(() => Array.from(new Set(logs.map((l) => l.source))), [logs]);
  const uniqueResults = useMemo(() => Array.from(new Set(logs.map((l) => l.result))), [logs]);

  return (
    <div className="space-y-4">
      {/* ═══ Filters ═══ */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <Input
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by member ID, log ID, or message..."
            value={search}
          />
        </div>
        <select
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm font-semibold"
          onChange={(e) => setStatusFilter(e.target.value)}
          value={statusFilter}
        >
          <option value="all">All Results</option>
          {uniqueResults.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm font-semibold"
          onChange={(e) => setSourceFilter(e.target.value)}
          value={sourceFilter}
        >
          <option value="all">All Sources</option>
          {uniqueSources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <input
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            onChange={(e) => setDateFrom(e.target.value)}
            type="date"
            value={dateFrom}
          />
          <span className="text-muted-foreground">—</span>
          <input
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            onChange={(e) => setDateTo(e.target.value)}
            type="date"
            value={dateTo}
          />
        </div>
        <Button
          onClick={() => exportToCSV(
            filtered.slice(0, 500).map((l) => ({
              id: l.id,
              action: l.action,
              result: l.result,
              source: l.source,
              member_id: l.member_id,
              message: l.message,
              occurred_at: l.occurred_at,
            })),
            "attendance-history"
          )}
          size="sm"
          variant="secondary"
        >
          <Download className="mr-1.5 size-3.5" /> Export CSV
        </Button>
      </div>

      <p className="text-xs font-semibold text-muted-foreground">
        Showing {filtered.length} of {total} records
      </p>

      {/* ═══ Table ═══ */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <Th onClick={() => toggleSort("occurred_at")} sorted={sortField === "occurred_at"} dir={sortDir}>Time</Th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Member</th>
              <Th onClick={() => toggleSort("action")} sorted={sortField === "action"} dir={sortDir}>Action</Th>
              <Th onClick={() => toggleSort("result")} sorted={sortField === "result"} dir={sortDir}>Result</Th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Message</th>
              <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.slice(0, 100).map((log) => (
              <tr className="transition hover:bg-surface-muted/50" key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3 text-muted-foreground" />
                    {new Date(log.occurred_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                  {memberNames[log.member_id] ?? log.member_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3 font-semibold capitalize">{log.action.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    log.result === "success" ? "bg-success/15 text-success" :
                    log.result === "denied" || log.result === "error" ? "bg-destructive/15 text-destructive" :
                    log.result === "reversed" ? "bg-warning/15 text-warning" :
                    "bg-surface-muted text-muted-foreground"
                  }`}>
                    {log.result === "success" ? <CheckCircle2 className="size-3" /> :
                     log.result === "denied" || log.result === "error" ? <XCircle className="size-3" /> :
                     <RotateCcw className="size-3" />}
                    {log.result}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{log.source ?? "—"}</td>
                <td className="max-w-[300px] truncate px-4 py-3 text-muted-foreground">{log.message ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                      onClick={() => { setSelectedLog(log); setShowCorrection(false); }}
                      title="View details"
                      type="button"
                    >
                      <Eye className="size-4" />
                    </button>
                    {(log.result === "success" || log.result === "warning") && (
                      <button
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => { setSelectedLog(log); setShowCorrection(true); }}
                        title="Reverse this record"
                        type="button"
                      >
                        <RotateCcw className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm font-semibold text-muted-foreground">
            No attendance records match the current filters.
          </div>
        )}
      </div>

      {/* ═══ Detail Drawer ═══ */}
      {selectedLog && !showCorrection && (
        <LogDetailDrawer log={selectedLog} memberName={memberNames[selectedLog.member_id]} onClose={() => setSelectedLog(null)} />
      )}

      {/* ═══ Correction Dialog ═══ */}
      {selectedLog && showCorrection && (
        <CorrectionDialog
          log={selectedLog}
          onClose={() => { setSelectedLog(null); setShowCorrection(false); }}
          reverseState={reverseState}
          reverseAction={reverseAction}
        />
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
  sorted,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  sorted: boolean;
  dir: SortDir;
}) {
  return (
    <th className="cursor-pointer px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground" onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`size-3 transition ${sorted ? "text-foreground" : "opacity-30"}`} />
      </span>
    </th>
  );
}

function LogDetailDrawer({ log, memberName, onClose }: { log: AttendanceLogRow; memberName?: string; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose} ref={drawerRef} tabIndex={-1}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Attendance details">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{log.action.replaceAll("_", " ")}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                log.result === "success" ? "bg-success/15 text-success" :
                log.result === "denied" || log.result === "error" ? "bg-destructive/15 text-destructive" :
                "bg-warning/15 text-warning"
              }`}>
                {log.result}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{new Date(log.occurred_at).toLocaleString("en-IN")}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close">
            <XCircle className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Event</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Action</p><p className="text-sm font-bold capitalize">{log.action.replaceAll("_", " ")}</p></div>
              <div><p className="text-xs text-muted-foreground">Result</p><p className="text-sm font-bold">{log.result}</p></div>
              <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-bold">{log.source ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Reason</p><p className="text-sm font-bold">{log.reason_code ?? "—"}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Message</p><p className="text-sm font-bold">{log.message ?? "—"}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">ID</p><p className="text-sm font-mono text-muted-foreground">{log.id}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Member</h3></CardHeader>
            <CardContent>
              <p className="text-sm font-bold">{memberName ?? log.member_id?.slice(0, 8) ?? "—"}</p>
              <p className="text-xs text-muted-foreground">ID: {log.member_id ?? "—"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CorrectionDialog({
  log,
  onClose,
  reverseState,
  reverseAction,
}: {
  log: AttendanceLogRow;
  onClose: () => void;
  reverseState: { status: string; message: string; fieldErrors?: Record<string, string[]> };
  reverseAction: (fd: FormData) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose} ref={dialogRef} tabIndex={-1}>
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Reverse attendance record">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Reverse Record</h2>
          <button className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close">
            <XCircle className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This will mark the attendance record <strong className="text-foreground">{log.id.slice(0, 8)}</strong> as reversed and log a correction.
        </p>
        <form action={reverseAction} className="mt-5 space-y-4">
          <input name="logId" type="hidden" value={log.id} />
          <div className="space-y-2">
            <label className="text-sm font-bold" htmlFor="reason">Reason for reversal *</label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              id="reason"
              name="reason"
              placeholder="Explain why this record is being reversed..."
              required
            />
          </div>
          <FormMessage state={reverseState} />
          <div className="flex gap-3">
            <Button className="flex-1" onClick={onClose} type="button" variant="secondary">Cancel</Button>
            <button className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50" type="submit">
              Reverse Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
