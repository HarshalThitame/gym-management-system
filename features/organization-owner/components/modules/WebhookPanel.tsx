"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import type { WebhookConfig, WebhookDeliveryLog } from "@/features/organization-owner/actions/webhook-actions";
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookLogs,
  retryWebhookDelivery,
  testWebhook,
} from "@/features/organization-owner/actions/webhook-actions";

type WebhookPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const EVENT_OPTIONS = [
  { key: "member.created", label: "Member Created" },
  { key: "member.updated", label: "Member Updated" },
  { key: "member.deleted", label: "Member Deleted" },
  { key: "payment.received", label: "Payment Received" },
  { key: "payment.failed", label: "Payment Failed" },
  { key: "check_in", label: "Check-in" },
  { key: "check_out", label: "Check-out" },
  { key: "class.booked", label: "Class Booked" },
  { key: "class.cancelled", label: "Class Cancelled" },
  { key: "lead.created", label: "Lead Created" },
  { key: "lead.updated", label: "Lead Updated" },
  { key: "lead.converted", label: "Lead Converted" },
  { key: "membership.renewed", label: "Membership Renewed" },
  { key: "membership.expired", label: "Membership Expired" },
] as const;

export function WebhookPanel({ dashboard, hasFeature }: WebhookPanelProps) {
  const orgId = dashboard.organization.id;
  const [activeTab, setActiveTab] = useState<"config" | "logs">("config");
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logFilters, setLogFilters] = useState<{ status?: string }>({ status: "all" });
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; result?: { success: boolean; statusCode: number; responseBody: string; durationMs: number } }>>({});

  const fetchWebhooks = useCallback(async () => {
    try {
      const result = await getWebhooks(orgId);
      setWebhooks(result);
    } catch {
      setWebhooks([]);
    }
  }, [orgId]);

  const fetchLogs = useCallback(async () => {
    try {
      const filters: Parameters<typeof getWebhookLogs>[2] = { page: logPage, pageSize: 20 };
      if (logFilters.status) filters.status = logFilters.status;
      const result = await getWebhookLogs(orgId, selectedWebhookId ?? undefined, filters);
      setLogs(result.logs);
      setLogTotal(result.total);
    } catch {
      setLogs([]);
      setLogTotal(0);
    }
  }, [orgId, selectedWebhookId, logFilters, logPage]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchWebhooks(), fetchLogs()]);
      setLoading(false);
    };
    load();
  }, [fetchWebhooks, fetchLogs]);

  if (!hasFeature) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
        <ExternalLink className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">Webhooks</p>
        <p className="mt-1 text-xs text-muted-foreground">This feature requires the Enterprise plan. Upgrade to enable outbound webhook integration.</p>
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

  const openCreateDrawer = () => {
    setEditingWebhook(null);
    setFormName("");
    setFormUrl("");
    setFormEvents([]);
    setGeneratedSecret("");
    setDrawerOpen(true);
  };

  const openEditDrawer = (wh: WebhookConfig) => {
    setEditingWebhook(wh);
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormEvents(wh.events ?? []);
    setGeneratedSecret("");
    setDrawerOpen(true);
  };

  const handleSaveWebhook = async () => {
    if (!formName.trim()) { showToast("Name is required.", "error"); return; }
    if (!formUrl.trim() || !formUrl.startsWith("https://")) { showToast("Valid HTTPS URL is required.", "error"); return; }

    try {
      if (editingWebhook) {
        await updateWebhook(orgId, editingWebhook.id, {
          name: formName,
          url: formUrl,
          events: formEvents,
          ...(generatedSecret ? { secret: generatedSecret } : {}),
        });
        showToast("Webhook updated.", "success");
      } else {
        const created = await createWebhook(orgId, {
          name: formName,
          url: formUrl,
          events: formEvents,
        });
        setGeneratedSecret(created.secret ?? "");
        showToast("Webhook created. Copy your secret now — it won&apos;t be shown again.", "success");
      }
      setDrawerOpen(false);
      await fetchWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save webhook.", "error");
    }
  };

  const handleDelete = async (webhookId: string) => {
    try {
      await deleteWebhook(orgId, webhookId);
      showToast("Webhook deleted.", "success");
      await fetchWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete.", "error");
    }
  };

  const handleToggleActive = async (wh: WebhookConfig) => {
    try {
      await updateWebhook(orgId, wh.id, { is_active: !wh.is_active });
      showToast(`Webhook ${wh.is_active ? "paused" : "activated"}.`, "success");
      await fetchWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to toggle.", "error");
    }
  };

  const handleTest = async (webhookId: string) => {
    setTestResults((prev) => ({ ...prev, [webhookId]: { loading: true } }));
    try {
      const result = await testWebhook(orgId, webhookId);
      setTestResults((prev) => ({ ...prev, [webhookId]: { loading: false, result } }));
      showToast(result.success ? "Test successful!" : `Test failed: HTTP ${result.statusCode}`, result.success ? "success" : "error");
      await fetchLogs();
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [webhookId]: { loading: false } }));
      showToast(err instanceof Error ? err.message : "Test failed.", "error");
    }
  };

  const handleRetry = async (logId: string) => {
    try {
      await retryWebhookDelivery(orgId, logId);
      showToast("Retried successfully.", "success");
      await fetchLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Retry failed.", "error");
    }
  };

  const toggleEvent = (eventKey: string) => {
    setFormEvents((prev) =>
      prev.includes(eventKey) ? prev.filter((e) => e !== eventKey) : [...prev, eventKey],
    );
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret).then(
      () => showToast("Secret copied.", "success"),
      () => showToast("Failed to copy.", "error"),
    );
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "success": return "success" as const;
      case "failed": return "error" as const;
      case "retrying": return "warning" as const;
      default: return "neutral" as const;
    }
  };

  const totalPages = Math.max(1, Math.ceil(logTotal / 20));
  const successRate = logTotal > 0 ? Math.round((logs.filter((l) => l.status === "success").length / logs.length) * 100) : 0;
  const avgDuration = logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.duration_ms ?? 0), 0) / logs.length) : 0;

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["config", "logs"] as const).map((tab) => (
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
            {tab === "config" ? "Webhook Config" : "Delivery Logs"}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} configured</p>
            <Button onClick={openCreateDrawer}>
              <Plus className="mr-2 size-4" /> Add Webhook
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
              <ExternalLink className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No webhooks configured</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a webhook to receive real-time event notifications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <Card key={wh.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold truncate">{wh.name}</h4>
                          <Badge variant={wh.is_active ? "success" : "neutral"}>
                            {wh.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-mono truncate">{wh.url}</p>
                        {wh.last_triggered_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Last triggered: {new Date(wh.last_triggered_at).toLocaleString("en-IN")}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(wh.events ?? []).slice(0, 4).map((ev) => (
                            <Badge key={ev} variant="info" className="text-[10px]">{ev}</Badge>
                          ))}
                          {(wh.events ?? []).length > 4 && (
                            <Badge variant="neutral" className="text-[10px]">+{wh.events.length - 4} more</Badge>
                          )}
                        </div>
                        {wh.secret && (
                          <div className="mt-2 flex items-center gap-1">
                            <p className="text-[10px] text-muted-foreground font-mono">Secret: whsec_{"*".repeat(8)}</p>
                            <button onClick={() => wh.secret && copySecret(wh.secret)} className="text-muted-foreground hover:text-foreground" type="button">
                              <Copy className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTest(wh.id)}
                          disabled={testResults[wh.id]?.loading}
                        >
                          <Send className="size-3.5" />
                          {testResults[wh.id]?.loading ? "..." : "Test"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleToggleActive(wh)}>
                          {wh.is_active ? "Pause" : "Activate"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openEditDrawer(wh)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(wh.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {testResults[wh.id]?.result && (
                      <div className={`mt-3 rounded-md p-3 text-xs ${testResults[wh.id]?.result?.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                        <p className="font-bold">{testResults[wh.id]?.result?.success ? "Test Passed" : "Test Failed"}</p>
                        <p className="text-muted-foreground">
                          Status: {testResults[wh.id]?.result?.statusCode} | Duration: {testResults[wh.id]?.result?.durationMs}ms
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Drawer Modal */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40" onClick={() => setDrawerOpen(false)}>
              <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <h3 className="text-lg font-black">{editingWebhook ? "Edit Webhook" : "Add Webhook"}</h3>
                  <button onClick={() => setDrawerOpen(false)} className="rounded-md p-1 hover:bg-surface" type="button">
                    <XCircle className="size-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-4 px-6 py-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">Name</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="My Webhook"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">URL (HTTPS only)</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-2">Events</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {EVENT_OPTIONS.map((opt) => (
                        <label key={opt.key} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-xs cursor-pointer hover:bg-surface-muted">
                          <input
                            type="checkbox"
                            checked={formEvents.includes(opt.key)}
                            onChange={() => toggleEvent(opt.key)}
                            className="rounded"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {generatedSecret && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-bold text-amber-800">Webhook Secret (save now — shown only once)</p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 rounded bg-amber-100 px-2 py-1 text-xs font-mono text-amber-900 break-all">{generatedSecret}</code>
                        <button onClick={() => copySecret(generatedSecret)} className="rounded p-1 hover:bg-amber-100" type="button">
                          <Copy className="size-3.5 text-amber-700" />
                        </button>
                      </div>
                    </div>
                  )}
                  {editingWebhook?.secret && !generatedSecret && (
                    <p className="text-xs text-muted-foreground">Secret is stored securely. Rotate by entering a new one.</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                  <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveWebhook}>{editingWebhook ? "Save Changes" : "Create Webhook"}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Total Deliveries</p>
              <p className="text-xl font-black">{logTotal}</p>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-xl font-black">{successRate}%</p>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Avg Response</p>
              <p className="text-xl font-black">{avgDuration}ms</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
              value={selectedWebhookId ?? ""}
              onChange={(e) => { setSelectedWebhookId(e.target.value || null); setLogPage(1); }}
            >
              <option value="">All Webhooks</option>
              {webhooks.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
            {(["all", "success", "failed", "pending", "retrying"] as const).map((s) => (
              <button
                key={s}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  logFilters.status === s
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { setLogFilters({ status: s }); setLogPage(1); }}
                type="button"
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
              <Clock className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No delivery logs</p>
              <p className="mt-1 text-xs text-muted-foreground">Delivery logs will appear once webhooks are triggered.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Timestamp</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Webhook</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Event</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Response</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Duration</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const wh = webhooks.find((w) => w.id === log.webhook_id);
                      return (
                        <tr key={log.id} className="border-t border-border hover:bg-surface">
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                            {new Date(log.created_at).toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-medium">{wh?.name ?? "Unknown"}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="info" className="text-[10px]">{log.event_type}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={statusBadgeVariant(log.status)}>{log.status}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono">
                            {log.response_status ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {log.status === "failed" && (
                              <Button variant="secondary" size="sm" onClick={() => handleRetry(log.id)}>
                                <RefreshCw className="size-3" /> Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Page {logPage} of {totalPages}</p>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={logPage <= 1}
                    onClick={() => setLogPage(logPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={logPage >= totalPages}
                    onClick={() => setLogPage(logPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
