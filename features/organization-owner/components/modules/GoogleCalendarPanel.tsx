"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, ExternalLink, Plug, RefreshCw, Trash2, Wrench } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import type { CalendarIntegration, CalendarSyncLog } from "@/features/organization-owner/actions/calendar-actions";
import {
  getCalendarIntegration,
  saveCalendarConfig,
  disconnectCalendar,
  syncAllUpcomingClasses,
  getSyncLogs,
  getGoogleAuthUrl,
} from "@/features/organization-owner/actions/calendar-actions";
import { GenericConfirmDialog } from "@/features/organization-owner/components/modules/GenericConfirmDialog";

type GoogleCalendarPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

export function GoogleCalendarPanel({ dashboard, hasFeature }: GoogleCalendarPanelProps) {
  const orgId = dashboard.organization.id;
  const [activeTab, setActiveTab] = useState<"connection" | "logs">("connection");
  const [integration, setIntegration] = useState<CalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<CalendarSyncLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchIntegration = useCallback(async () => {
    try {
      const result = await getCalendarIntegration(orgId);
      setIntegration(result);
    } catch {
      setIntegration(null);
    }
  }, [orgId]);

  const fetchLogs = useCallback(async () => {
    try {
      const filters: Parameters<typeof getSyncLogs>[1] = { page: logPage, pageSize: 20 };
      if (logStatusFilter !== "all") filters.status = logStatusFilter;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      const result = await getSyncLogs(orgId, filters);
      setLogs(result.logs);
      setLogTotal(result.total);
    } catch {
      setLogs([]);
      setLogTotal(0);
    }
  }, [orgId, logStatusFilter, dateFrom, dateTo, logPage]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchIntegration(), fetchLogs()]);
      setLoading(false);
    };
    load();
  }, [fetchIntegration, fetchLogs]);

  if (!hasFeature) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
        <Calendar className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">Google Calendar Sync</p>
        <p className="mt-1 text-xs text-muted-foreground">This feature requires the Enterprise plan. Upgrade to enable calendar integration.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 flex-wrap" role="tablist">
        {(["connection", "logs"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            type="button"
          >
            {tab === "connection" ? "Connection" : "Sync Logs"}
          </button>
        ))}
      </div>

      {/* Connection Tab */}
      {activeTab === "connection" && (
        <ConnectionTab
          orgId={orgId}
          integration={integration}
          onRefresh={fetchIntegration}
          syncing={syncing}
          setSyncing={setSyncing}
        />
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <LogsTab
          logs={logs}
          total={logTotal}
          page={logPage}
          statusFilter={logStatusFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onPageChange={setLogPage}
          onStatusFilterChange={(s) => { setLogStatusFilter(s); setLogPage(1); }}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      )}

    </div>
  );
}

function ConnectionTab({
  orgId,
  integration,
  onRefresh,
  syncing,
  setSyncing,
}: {
  orgId: string;
  integration: CalendarIntegration | null;
  onRefresh: () => Promise<void>;
  syncing: boolean;
  setSyncing: (v: boolean) => void;
}) {
  const [calendarId, setCalendarId] = useState(integration?.calendar_id ?? "");
  const [syncClasses, setSyncClasses] = useState(integration?.sync_classes ?? true);
  const [syncPt, setSyncPt] = useState(integration?.sync_pt_sessions ?? false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    setCalendarId(integration?.calendar_id ?? "");
    setSyncClasses(integration?.sync_classes ?? true);
    setSyncPt(integration?.sync_pt_sessions ?? false);
  }, [integration]);

  const handleSaveConfig = async () => {
    try {
      await saveCalendarConfig(orgId, {
        calendarId,
        syncEnabled: true,
        syncClasses,
        syncPtSessions: syncPt,
      });
      showToast("Calendar config saved.", "success");
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save.", "error");
    }
  };

  const handleConnect = async () => {
    try {
      const result = await getGoogleAuthUrl(orgId);
      if (result.status === "error" || !result.authUrl) {
        showToast(result.message, "error");
        return;
      }

      showToast(result.message, "success");
      window.open(result.authUrl, "_blank");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to connect.", "error");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectCalendar(orgId);
      showToast("Calendar disconnected.", "success");
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to disconnect.", "error");
    }
    setShowDisconnectConfirm(false);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await syncAllUpcomingClasses(orgId);
      showToast(
        `Synced ${result.synced} sessions. ${result.failed > 0 ? `${result.failed} failed.` : ""}`,
        result.failed > 0 ? "error" : "success",
      );
    } catch {
      showToast("Sync failed.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = integration?.sync_enabled ?? false;

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black">Google Calendar Connection</h3>
            <p className="text-sm text-muted-foreground">Sync class schedules to your organization&apos;s Google Calendar</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-center">
                <Plug className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">Not connected</p>
                <p className="mt-1 text-xs text-muted-foreground">Connect your organization Google Calendar to auto-sync class schedules. Trainer personal calendars are not part of this phase.</p>
                <Button className="mt-4" onClick={handleConnect}>
                  <ExternalLink className="mr-2 size-4" /> Connect Google Calendar
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-3">
                  <CheckCircle2 className="size-5 text-green-600" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Connected</p>
                    {integration?.calendar_id && (
                      <p className="text-xs text-green-700 font-mono">Calendar: {integration.calendar_id}</p>
                    )}
                    {integration?.last_synced_at && (
                      <p className="text-xs text-green-700">
                        Last synced: {new Date(integration.last_synced_at).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">Calendar ID</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={calendarId}
                      onChange={(e) => setCalendarId(e.target.value)}
                      placeholder="primary (optional)"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <div>
                      <p className="text-sm font-bold">Sync Classes</p>
                      <p className="text-xs text-muted-foreground">Auto-create calendar events for scheduled classes</p>
                    </div>
                    <button
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                        syncClasses ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"
                      }`}
                      onClick={() => { setSyncClasses(!syncClasses); }}
                      type="button"
                    >
                      {syncClasses ? "On" : "Off"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <div>
                      <p className="text-sm font-bold">Sync PT Sessions</p>
                      <p className="text-xs text-muted-foreground">Create calendar events for PT sessions</p>
                    </div>
                    <button
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                        syncPt ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"
                      }`}
                      onClick={() => { setSyncPt(!syncPt); }}
                      type="button"
                    >
                      {syncPt ? "On" : "Off"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveConfig} variant="primary">
                    Save Config
                  </Button>
                  <Button onClick={handleSyncAll} variant="secondary" disabled={syncing}>
                    <RefreshCw className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync All Now"}
                  </Button>
                  <Button onClick={() => setShowDisconnectConfirm(true)} variant="ghost" className="text-red-600 hover:text-red-700">
                    <Trash2 className="mr-2 size-4" /> Disconnect
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <GenericConfirmDialog
        open={showDisconnectConfirm}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
        title="Disconnect Google Calendar?"
        itemName="Google Calendar"
        warning="Sync will stop."
        danger={false}
        confirmLabel="Disconnect"
      />
    </>
  );
}

function LogsTab({
  logs,
  total,
  page,
  statusFilter,
  dateFrom,
  dateTo,
  onPageChange,
  onStatusFilterChange,
  onDateFromChange,
  onDateToChange,
}: {
  logs: CalendarSyncLog[];
  total: number;
  page: number;
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
  onPageChange: (p: number) => void;
  onStatusFilterChange: (s: string) => void;
  onDateFromChange: (d: string) => void;
  onDateToChange: (d: string) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-black">{total}</p>
        </div>
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-xs text-green-700">Synced</p>
          <p className="text-xl font-black text-green-800">{successCount}</p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">Failed</p>
          <p className="text-xl font-black text-red-800">{failedCount}</p>
        </div>
      </div>

      {/* Filters: status + date range */}
      <div className="flex flex-wrap gap-2 items-center">
        {(["all", "success", "failed", "pending"] as const).map((s) => (
          <button
            key={s}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === s
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onStatusFilterChange(s)}
            type="button"
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">Date:</span>
        <input
          type="date"
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
        {(dateFrom || dateTo) && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => { onDateFromChange(""); onDateToChange(""); }}
            type="button"
          >
            Clear dates
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
          <Wrench className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">No sync logs</p>
          <p className="mt-1 text-xs text-muted-foreground">Sync logs will appear after syncing class sessions.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Event Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Class Session</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-surface">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={log.event_type === "sync_error" ? "error" : "neutral"}>
                        {log.event_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">
                      {log.class_session_id ? log.class_session_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          log.status === "success" ? "success" : log.status === "failed" ? "error" : "warning"
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
