"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CheckCircle, XCircle, FileText, Download } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField } from "@/features/organization-owner/components/org-owner-drawer";
import { Button } from "@/components/ui/button";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import {
  getLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveStats,
  type LeaveRequest,
} from "@/features/organization-owner/actions/staff-leave-actions";

type StaffLeavePanelProps = {
  dashboard: OrganizationOwnerDashboard;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const leaveTypeLabels: Record<string, string> = { sick: "Sick", casual: "Casual", annual: "Annual", other: "Other" };

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function badgeForStatus(status: string): { variant: "warning" | "success" | "error"; label: string } {
  switch (status) {
    case "pending": return { variant: "warning", label: "Pending" };
    case "approved": return { variant: "success", label: "Approved" };
    case "rejected": return { variant: "error", label: "Rejected" };
    default: return { variant: "neutral" as never, label: status };
  }
}

export function StaffLeavePanel({ dashboard }: StaffLeavePanelProps) {
  const orgId = dashboard.organization.id;
  const staffList = (dashboard.branchUsers as Record<string, unknown>[])
    .filter((bu) => bu.status === "active")
    .map((bu) => {
      const profile = bu.profiles as { full_name?: string } | null;
      return { id: bu.user_id as string, name: profile?.full_name ?? "Unknown" };
    });

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, approvedThisMonth: 0, rejectedThisMonth: 0 });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({ staffId: "", leaveType: "sick", startDate: "", endDate: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [filters, setFilters] = useState({ staffId: "", status: "all" });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: { staffId?: string; status?: string; page: number; pageSize: number } = { page, pageSize };
      if (filters.staffId) filterParams.staffId = filters.staffId;
      if (filters.status && filters.status !== "all") filterParams.status = filters.status;
      const [result, statsResult] = await Promise.all([
        getLeaveRequests(orgId, filterParams),
        getLeaveStats(orgId),
      ]);
      setRequests(result.requests);
      setTotal(result.total);
      setStats(statsResult);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load leave requests", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, filters, page]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = useCallback(async () => {
    if (!formData.staffId || !formData.startDate || !formData.endDate) {
      setFormError("Please fill all required fields.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const createData: { staffId: string; leaveType: string; startDate: string; endDate: string; reason?: string } = {
        staffId: formData.staffId,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
      };
      if (formData.reason) createData.reason = formData.reason;
      await createLeaveRequest(orgId, createData);
      showToast("Leave request submitted", "success");
      setDrawerOpen(false);
      setFormData({ staffId: "", leaveType: "sick", startDate: "", endDate: "", reason: "" });
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }, [orgId, formData, refresh]);

  const handleApprove = useCallback(async (requestId: string) => {
    try {
      await approveLeaveRequest(orgId, requestId);
      showToast("Leave approved", "success");
      refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to approve", "error");
    }
  }, [orgId, refresh]);

  const handleReject = useCallback(async (requestId: string) => {
    try {
      await rejectLeaveRequest(orgId, requestId);
      showToast("Leave rejected", "success");
      refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to reject", "error");
    }
  }, [orgId, refresh]);

  const handleExportCSV = useCallback(() => {
    exportToCSV(
      requests.map((r) => ({
        staff: r.staff_name ?? "Unknown",
        type: leaveTypeLabels[r.leave_type] ?? r.leave_type,
        start_date: r.start_date,
        end_date: r.end_date,
        days: String(daysBetween(r.start_date, r.end_date)),
        status: r.status,
        reason: r.reason ?? "",
      })),
      "staff-leave-requests"
    );
  }, [requests]);

  const items = requests.map((r) => {
    const badge = badgeForStatus(r.status);
    const duration = daysBetween(r.start_date, r.end_date);
    return {
      id: r.id,
      title: r.staff_name ?? "Unknown",
      subtitle: `${leaveTypeLabels[r.leave_type] ?? r.leave_type} leave · ${duration} day${duration > 1 ? "s" : ""}`,
      meta: `${new Date(r.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} → ${new Date(r.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}${r.reason ? ` · Reason: ${r.reason.length > 60 ? r.reason.slice(0, 60) + "..." : r.reason}` : ""}`,
      badge: badge.label,
      badgeVariant: badge.variant as "success" | "warning" | "error",
      sections: [
        { label: "Type", value: leaveTypeLabels[r.leave_type] ?? r.leave_type },
        { label: "Start Date", value: r.start_date },
        { label: "End Date", value: r.end_date },
        { label: "Duration", value: `${duration} day${duration > 1 ? "s" : ""}` },
        { label: "Status", value: badge.label },
      ],
      actions: r.status === "pending"
        ? [
          { label: "Approve", onClick: () => handleApprove(r.id), variant: "primary" as const, icon: <CheckCircle className="size-3.5" /> },
          { label: "Reject", onClick: () => handleReject(r.id), variant: "destructive" as const, icon: <XCircle className="size-3.5" /> },
        ]
        : [],
    };
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* ═══ STATS ═══ */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Awaiting approval" icon={<FileText className="size-5" />} label="Pending" value={String(stats.pending)} status={stats.pending > 0 ? "watch" : "good"} />
        <StatCard detail="Approved this month" icon={<CheckCircle className="size-5" />} label="Approved" value={String(stats.approvedThisMonth)} status="good" />
        <StatCard detail="Rejected this month" icon={<XCircle className="size-5" />} label="Rejected" value={String(stats.rejectedThisMonth)} />
      </section>

      {/* ═══ FILTERS ═══ */}
      <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Status</label>
              <select
                className={`${selectClass} mt-1 md:w-40`}
                value={filters.status}
                onChange={(e) => { setFilters((prev) => ({ ...prev, status: e.target.value })); setPage(1); }}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Staff</label>
              <select
                className={`${selectClass} mt-1 md:w-48`}
                value={filters.staffId}
                onChange={(e) => { setFilters((prev) => ({ ...prev, staffId: e.target.value })); setPage(1); }}
              >
                <option value="">All staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setFilters({ staffId: "", status: "all" }); setPage(1); }}>
              Reset
            </Button>
          </div>
          <Button onClick={() => setDrawerOpen(true)} size="sm" variant="primary">
            <CalendarPlus className="size-4" /> New Leave Request
          </Button>
        </div>
      </div>

      {/* ═══ DATA LIST ═══ */}
      <DataList
        items={items}
        loading={loading}
        headerTitle="Leave Requests"
        totalItems={total}
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onExportCSV={handleExportCSV}
        emptyTitle="No leave requests"
        emptyDescription="Leave requests will appear here when submitted."
      />

      {/* ═══ CREATE LEAVE DRAWER ═══ */}
      <OrgOwnerDrawer
        description="Submit a new leave request for a staff member"
        onClose={() => { setDrawerOpen(false); setFormError(null); }}
        open={drawerOpen}
        title="New Leave Request"
        size="lg"
      >
        <div className="space-y-5">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
              {formError}
            </div>
          ) : null}

          <DrawerField label="Staff" required>
            <select
              className={selectClass}
              value={formData.staffId}
              onChange={(e) => setFormData((prev) => ({ ...prev, staffId: e.target.value }))}
            >
              <option value="">Select staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </DrawerField>

          <DrawerField label="Leave Type" required>
            <select
              className={selectClass}
              value={formData.leaveType}
              onChange={(e) => setFormData((prev) => ({ ...prev, leaveType: e.target.value }))}
            >
              <option value="sick">Sick</option>
              <option value="casual">Casual</option>
              <option value="annual">Annual</option>
              <option value="other">Other</option>
            </select>
          </DrawerField>

          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Start Date" required>
              <input
                className={selectClass}
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </DrawerField>
            <DrawerField label="End Date" required>
              <input
                className={selectClass}
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </DrawerField>
          </div>

          <DrawerField label="Reason">
            <textarea
              className={`${selectClass} min-h-[80px]`}
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Optional reason for leave..."
              rows={3}
            />
          </DrawerField>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button
              className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong"
              onClick={() => { setDrawerOpen(false); setFormError(null); }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
              onClick={handleCreate}
              disabled={submitting}
              type="button"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      </OrgOwnerDrawer>
    </div>
  );
}
