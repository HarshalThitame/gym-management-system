"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, Download, ChevronDown, ChevronUp, Clock, Calendar } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { Button } from "@/components/ui/button";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import {
  getStaffAttendance,
  getTodayAttendanceStatus,
  clockIn,
  clockOut,
  getMonthlyAttendanceSummary,
  type AttendanceRecord,
} from "@/features/organization-owner/actions/staff-attendance-actions";

type StaffAttendancePanelProps = {
  dashboard: OrganizationOwnerDashboard;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "In progress";
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0 && minutes === 0) return "< 1 min";
  return `${hours}h ${minutes}m`;
}

export function StaffAttendancePanel({ dashboard }: StaffAttendancePanelProps) {
  const orgId = dashboard.organization.id;
  const staffList = (dashboard.branchUsers as Record<string, unknown>[])
    .filter((bu) => bu.status === "active")
    .map((bu) => {
      const profile = bu.profiles as { full_name?: string } | null;
      return { id: bu.user_id as string, name: profile?.full_name ?? "Unknown", branchId: bu.branch_id as string | null };
    });

  const [todayStatus, setTodayStatus] = useState<{ staffId: string; staffName: string; clockedIn: boolean; recordId: string | null }[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ staffId: string; staffName: string; presentDays: number; absentDays: number; avgHours: number; totalRecords: number }[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

  const [filters, setFilters] = useState({ staffId: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const refreshToday = useCallback(async () => {
    try {
      const status = await getTodayAttendanceStatus(orgId);
      setTodayStatus(status);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load today's status", "error");
    }
  }, [orgId]);

  const refreshLog = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: { staffId?: string; dateFrom?: string; dateTo?: string; page: number; pageSize: number } = { page, pageSize };
      if (filters.staffId) filterParams.staffId = filters.staffId;
      if (filters.dateFrom) filterParams.dateFrom = filters.dateFrom;
      if (filters.dateTo) filterParams.dateTo = filters.dateTo;
      const result = await getStaffAttendance(orgId, filterParams);
      setRecords(result.records);
      setTotal(result.total);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load attendance log", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, filters, page]);

  const refreshSummary = useCallback(async () => {
    try {
      const data = await getMonthlyAttendanceSummary(orgId, summaryMonth, summaryYear);
      setSummary(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load summary", "error");
    }
  }, [orgId, summaryMonth, summaryYear]);

  useEffect(() => { refreshToday(); }, [refreshToday]);
  useEffect(() => { refreshLog(); }, [refreshLog]);
  useEffect(() => { if (showSummary) refreshSummary(); }, [showSummary, refreshSummary]);

  const handleClockIn = useCallback(async (staffId: string, staffName: string, branchId: string | null) => {
    try {
      await clockIn(orgId, staffId, branchId ?? undefined);
      showToast(`${staffName} clocked in`, "success");
      refreshToday();
      refreshLog();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Clock in failed", "error");
    }
  }, [orgId, refreshToday, refreshLog]);

  const handleClockOut = useCallback(async (recordId: string, staffName: string) => {
    try {
      await clockOut(orgId, recordId);
      showToast(`${staffName} clocked out`, "success");
      refreshToday();
      refreshLog();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Clock out failed", "error");
    }
  }, [orgId, refreshToday, refreshLog]);

  const handleExportCSV = useCallback(() => {
    exportToCSV(
      records.map((r) => ({
        staff: r.staff_name ?? "Unknown",
        date: r.date,
        clock_in: formatTime(r.clock_in),
        clock_out: formatTime(r.clock_out),
        duration: formatDuration(r.clock_in, r.clock_out),
        status: r.clock_out ? "Present" : "In Progress",
      })),
      "staff-attendance"
    );
  }, [records]);

  const inCount = todayStatus.filter((s) => s.clockedIn).length;
  const outCount = todayStatus.length - inCount;

  const logItems = records.map((r) => ({
    id: r.id as string,
    title: r.staff_name ?? "Unknown",
    subtitle: new Date(r.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    meta: `Clock in: ${formatTime(r.clock_in)} · Clock out: ${formatTime(r.clock_out)} · Duration: ${formatDuration(r.clock_in, r.clock_out)}`,
    badge: r.clock_out ? "Present" : "In Progress",
    badgeVariant: (r.clock_out ? "success" : "warning") as "success" | "warning",
    sections: [
      { label: "Date", value: r.date },
      { label: "Clock In", value: formatTime(r.clock_in) },
      { label: "Clock Out", value: formatTime(r.clock_out) },
      { label: "Duration", value: formatDuration(r.clock_in, r.clock_out) },
      { label: "Status", value: r.clock_out ? "Present" : "In Progress" },
    ],
    actions: !r.clock_out
      ? [{ label: "Clock Out", onClick: () => handleClockOut(r.id as string, r.staff_name ?? "Unknown"), variant: "primary" as const, icon: <LogOut className="size-3.5" /> }]
      : [],
  }));

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* ═══ TODAY SECTION ═══ */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-black">Today&rsquo;s Attendance</h3>
          <p className="text-sm text-muted-foreground">
            <HydrationSafeDate date={new Date()} format="datetime" />
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Staff currently clocked in" icon={<LogIn className="size-5" />} label="Clocked In" value={String(inCount)} status="good" />
          <StatCard detail="Staff not clocked in" icon={<LogOut className="size-5" />} label="Not Clocked In" value={String(outCount)} />
          <StatCard detail="Active staff members" icon={<Clock className="size-5" />} label="Total Staff" value={String(todayStatus.length)} />
          <StatCard
            detail={inCount > 0 ? `${Math.round((inCount / Math.max(1, todayStatus.length)) * 100)}% attendance` : "No one clocked in yet"}
            icon={<Calendar className="size-5" />}
            label="Attendance Rate"
            value={todayStatus.length > 0 ? `${Math.round((inCount / todayStatus.length) * 100)}%` : "0%"}
          />
        </CardContent>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {todayStatus.map((s) => (
              <div
                key={s.staffId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`size-2.5 shrink-0 rounded-full ${s.clockedIn ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="text-sm font-bold truncate">{s.staffName}</span>
                </div>
                {s.clockedIn && s.recordId ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-all"
                    onClick={() => handleClockOut(s.recordId!, s.staffName)}
                    type="button"
                  >
                    <LogOut className="size-3" /> Out
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:-translate-y-0.5 transition-all"
                    onClick={() => handleClockIn(s.staffId, s.staffName, staffList.find((st) => st.id === s.staffId)?.branchId ?? null)}
                    type="button"
                  >
                    <LogIn className="size-3" /> In
                  </button>
                )}
              </div>
            ))}
            {todayStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">No active staff members found.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ═══ FILTERS ═══ */}
      <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="text-xs font-bold text-muted-foreground">Staff</label>
            <select
              className={`${selectClass} mt-1`}
              value={filters.staffId}
              onChange={(e) => { setFilters((prev) => ({ ...prev, staffId: e.target.value })); setPage(1); }}
            >
              <option value="">All staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">From</label>
            <input
              className={`${selectClass} mt-1`}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => { setFilters((prev) => ({ ...prev, dateFrom: e.target.value })); setPage(1); }}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">To</label>
            <input
              className={`${selectClass} mt-1`}
              type="date"
              value={filters.dateTo}
              onChange={(e) => { setFilters((prev) => ({ ...prev, dateTo: e.target.value })); setPage(1); }}
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setFilters({ staffId: "", dateFrom: "", dateTo: "" }); setPage(1); }}>
            Reset
          </Button>
        </div>
      </div>

      {/* ═══ DATA LIST ═══ */}
      <DataList
        items={logItems}
        loading={loading}
        headerTitle="Attendance Log"
        totalItems={total}
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onExportCSV={handleExportCSV}
        emptyTitle="No attendance records"
        emptyDescription="Attendance records will appear here when staff clock in and out."
      />

      {/* ═══ MONTHLY SUMMARY (COLLAPSIBLE) ═══ */}
      <Card>
        <button
          className="flex w-full items-center justify-between p-5 md:p-6 text-left"
          onClick={() => setShowSummary(!showSummary)}
          type="button"
        >
          <h3 className="text-lg font-black">Monthly Summary</h3>
          {showSummary ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </button>
        {showSummary ? (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                className={`${selectClass} w-auto`}
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleDateString("en-IN", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClass} w-auto`}
                value={summaryYear}
                onChange={(e) => setSummaryYear(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <Button size="sm" variant="secondary" onClick={refreshSummary}>Refresh</Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Present</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Absent</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Avg Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.staffId} className="border-t border-border hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold">{s.staffName}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">{s.presentDays}</td>
                      <td className="px-4 py-3 text-red-500 font-semibold">{s.absentDays}</td>
                      <td className="px-4 py-3">{s.avgHours}h</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.totalRecords}</td>
                    </tr>
                  ))}
                  {summary.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>No data for this month.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
