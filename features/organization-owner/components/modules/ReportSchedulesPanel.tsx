"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Mail, Plus, Send, Trash2 } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrgOwnerDrawer, DrawerField } from "@/features/organization-owner/components/org-owner-drawer";
import { showToast } from "@/components/ui/toast";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import type {
  ReportSchedule,
  CreateReportScheduleInput,
} from "@/features/organization-owner/actions/report-schedule-actions";
import {
  getReportSchedules,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  sendScheduledReport,
} from "@/features/organization-owner/actions/report-schedule-actions";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type ReportSchedulesPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const REPORT_TYPES = [
  "revenue_summary",
  "member_report",
  "attendance_report",
  "class_report",
  "trainer_performance",
  "dashboard_summary",
] as const;

const FREQUENCIES = ["daily", "weekly", "monthly"] as const;

const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const freqBadgeClass: Record<string, string> = {
  daily: "border-blue-200 bg-blue-50 text-blue-700",
  weekly: "border-purple-200 bg-purple-50 text-purple-700",
  monthly: "border-amber-200 bg-amber-50 text-amber-700",
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ReportSchedulesPanel({ dashboard, hasFeature }: ReportSchedulesPanelProps) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<ReportSchedule["report_type"]>("revenue_summary");
  const [formFrequency, setFormFrequency] = useState<ReportSchedule["frequency"]>("weekly");
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formRecipients, setFormRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const loadSchedules = useCallback(async () => {
    if (!hasFeature) {
      setLoading(false);
      return;
    }
    try {
      const data = await getReportSchedules(dashboard.organization.id);
      setSchedules(data);
    } catch {
      showToast("Failed to load schedules", "error");
    } finally {
      setLoading(false);
    }
  }, [dashboard.organization.id, hasFeature]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const handleAddRecipient = () => {
    const email = recipientInput.trim();
    if (email && email.includes("@") && !formRecipients.includes(email)) {
      setFormRecipients([...formRecipients, email]);
      setRecipientInput("");
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setFormRecipients(formRecipients.filter((r) => r !== email));
  };

  const resetForm = () => {
    setFormName("");
    setFormType("revenue_summary");
    setFormFrequency("weekly");
    setFormDayOfWeek(1);
    setFormDayOfMonth(1);
    setFormRecipients([]);
    setRecipientInput("");
    setFormIsActive(true);
  };

  const openAdd = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim() || formRecipients.length === 0) {
      showToast("Name and at least one recipient required", "error");
      return;
    }

    const input: CreateReportScheduleInput = {
      name: formName.trim(),
      reportType: formType,
      frequency: formFrequency,
      recipients: formRecipients,
      isActive: formIsActive,
    };

    if (formFrequency === "weekly") input.dayOfWeek = formDayOfWeek;
    if (formFrequency === "monthly") input.dayOfMonth = formDayOfMonth;

    try {
      const created = await createReportSchedule(dashboard.organization.id, input);
      setSchedules([created, ...schedules]);
      resetForm();
      setDrawerOpen(false);
      setSuccessAction({ action: "created", title: "Schedule Created!", itemName: formName.trim() });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create schedule", "error");
    }
  };

  const handleSendNow = async (scheduleId: string) => {
    setSending(scheduleId);
    try {
      const result = await sendScheduledReport(dashboard.organization.id, scheduleId);
      if (result.sent) {
        showToast("Report sent to recipients", "success");
      } else {
        showToast("No recipients received the report", "error");
      }
      await loadSchedules();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to send", "error");
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await deleteReportSchedule(dashboard.organization.id, scheduleId);
      setSchedules(schedules.filter((s) => s.id !== scheduleId));
      setSuccessAction({ action: "deleted", title: "Schedule Deleted!", itemName: schedules.find((s) => s.id === scheduleId)?.name ?? "Schedule" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const toggleActive = async (schedule: ReportSchedule) => {
    try {
      const updated = await updateReportSchedule(dashboard.organization.id, schedule.id, {
        isActive: !schedule.is_active,
      });
      setSchedules(schedules.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update", "error");
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading schedules...</p>;
  }

  if (!hasFeature) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarClock className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold text-muted-foreground">Scheduled Reports</p>
          <p className="mt-1 text-xs text-muted-foreground">Upgrade to an Enterprise plan to access scheduled report delivery.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Scheduled Reports</p>
          <p className="mt-1 text-xs text-muted-foreground">Automatically generate and email reports on a schedule.</p>
        </div>
        <Button onClick={openAdd} size="sm" variant="secondary">
          <Plus className="size-3.5" /> Add Schedule
        </Button>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarClock className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold text-muted-foreground">No report schedules</p>
            <p className="mt-1 text-xs text-muted-foreground">Create a schedule to automatically email reports to your team.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{schedule.name}</p>
                      <Badge className="border-border bg-surface-muted text-xs">{formatEnterpriseLabel(schedule.report_type)}</Badge>
                      <Badge className={freqBadgeClass[schedule.frequency] ?? "border-border bg-surface-muted"}>{formatEnterpriseLabel(schedule.frequency)}</Badge>
                      {schedule.is_active ? (
                        <span className="text-xs font-semibold text-green-600">Active</span>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">Paused</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3" /> {schedule.recipients?.length ?? 0} recipient(s)
                      </span>
                      {schedule.next_scheduled_at ? (
                        <span>Next: {new Date(schedule.next_scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      ) : null}
                      {schedule.last_sent_at ? (
                        <span>Last: {new Date(schedule.last_sent_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-semibold hover:border-border-strong disabled:opacity-50"
                      onClick={() => handleSendNow(schedule.id)}
                      disabled={sending === schedule.id}
                      type="button"
                    >
                      <Send className="size-3" /> {sending === schedule.id ? "Sending..." : "Send Now"}
                    </button>
                    <button
                      className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-semibold hover:border-border-strong"
                      onClick={() => toggleActive(schedule)}
                      type="button"
                    >
                      {schedule.is_active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-red-600"
                      onClick={() => handleDelete(schedule.id)}
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Schedule Drawer */}
      <OrgOwnerDrawer
        open={drawerOpen}
        onClose={() => { resetForm(); setDrawerOpen(false); }}
        title="Add Report Schedule"
        description="Schedule automatic report generation and email delivery."
      >
        <div className="space-y-4">
          <DrawerField label="Report Name" required>
            <input
              className={selectClass}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Weekly Revenue Summary"
            />
          </DrawerField>
          <DrawerField label="Report Type">
            <select
              className={selectClass}
              value={formType}
              onChange={(e) => setFormType(e.target.value as ReportSchedule["report_type"])}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>{formatEnterpriseLabel(t)}</option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Frequency">
            <select
              className={selectClass}
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value as ReportSchedule["frequency"])}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>{formatEnterpriseLabel(f)}</option>
              ))}
            </select>
          </DrawerField>
          {formFrequency === "weekly" ? (
            <DrawerField label="Day of Week">
              <select
                className={selectClass}
                value={formDayOfWeek}
                onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </DrawerField>
          ) : null}
          {formFrequency === "monthly" ? (
            <DrawerField label="Day of Month">
              <select
                className={selectClass}
                value={formDayOfMonth}
                onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </DrawerField>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-bold">Recipients</label>
            <div className="flex gap-2">
              <input
                className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRecipient(); } }}
                placeholder="email@example.com"
                type="email"
              />
              <Button onClick={handleAddRecipient} size="sm" variant="secondary">Add</Button>
            </div>
            {formRecipients.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {formRecipients.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold">
                    {email}
                    <button onClick={() => handleRemoveRecipient(email)} className="ml-1 rounded-full p-0.5 hover:bg-surface-muted" type="button">
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold">Active</label>
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="size-4 rounded border-border"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} size="sm">Create Schedule</Button>
            <Button onClick={() => { resetForm(); setDrawerOpen(false); }} size="sm" variant="secondary">Cancel</Button>
          </div>
        </div>
      </OrgOwnerDrawer>
      <GenericSuccessDialog
        action={successAction?.action ?? "created"}
        itemName={successAction?.itemName ?? ""}
        onClose={() => setSuccessAction(null)}
        open={successAction !== null}
        title={successAction?.title ?? ""}
      />
    </div>
  );
}
