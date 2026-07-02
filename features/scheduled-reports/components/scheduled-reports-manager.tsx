"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Play, Pause, Trash2, Plus, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getScheduledReportsAction,
  createScheduledReportAction,
  deleteScheduledReportAction,
  runScheduledReportNowAction,
  toggleScheduledReportAction
} from "../actions/scheduled-reports-actions";
import type { ScheduledReport } from "../services/scheduled-reports-service";
import type { ExportFormat } from "@/features/advanced-export/services/export-service";

export function ScheduledReportsManager() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("members");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [recipients, setRecipients] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await getScheduledReportsAction();
      setReports(data);
    } catch (error) {
      console.error("Failed to load reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name || !recipients) return;

    setIsCreating(true);
    try {
      await createScheduledReportAction({
        name,
        reportType,
        scheduleType,
        scheduleConfig: { time: "09:00", day: 1 },
        format,
        recipients: recipients.split(",").map(r => r.trim())
      });

      // Reset form
      setName("");
      setRecipients("");
      setShowCreateForm(false);
      await loadReports();
    } catch (error) {
      console.error("Failed to create report:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled report?")) return;

    try {
      await deleteScheduledReportAction(reportId);
      await loadReports();
    } catch (error) {
      console.error("Failed to delete report:", error);
    }
  };

  const handleRunNow = async (reportId: string) => {
    try {
      await runScheduledReportNowAction(reportId);
      await loadReports();
    } catch (error) {
      console.error("Failed to run report:", error);
    }
  };

  const handleToggle = async (reportId: string, isActive: boolean) => {
    try {
      await toggleScheduledReportAction(reportId, !isActive);
      await loadReports();
    } catch (error) {
      console.error("Failed to toggle report:", error);
    }
  };

  const getScheduleLabel = (report: ScheduledReport) => {
    switch (report.schedule_type) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Custom";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Scheduled Reports
          </CardTitle>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="size-4" />
            <span className="ml-1">New</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Form */}
        {showCreateForm && (
          <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-3">
            <Input
              placeholder="Report name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="members">Members</option>
                <option value="crm_leads">Leads</option>
                <option value="equipment">Equipment</option>
                <option value="payments">Payments</option>
                <option value="attendance">Attendance</option>
              </select>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as any)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
              <Input
                placeholder="Email recipients (comma-separated)"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={isCreating || !name || !recipients}>
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                <span className="ml-1">Create</span>
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reports List */}
        {reports.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No scheduled reports yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {reports.map(report => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${report.is_active ? "bg-accent/10" : "bg-muted"}`}>
                    <Calendar className={`size-4 ${report.is_active ? "text-accent" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{report.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {report.report_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getScheduleLabel(report)} • {report.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {report.last_run_at && (
                    <span className="text-xs text-muted-foreground">
                      Last: {new Date(report.last_run_at).toLocaleDateString()}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRunNow(report.id)}
                  >
                    <Play className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(report.id, report.is_active)}
                  >
                    {report.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(report.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
