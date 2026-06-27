"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, ExternalLink, RefreshCw, Send, Trash2, XCircle, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";

type WebhookConfig = {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

type WebhookDeliveryLog = {
  id: string;
  webhook_id: string;
  organization_id: string;
  event_type: string;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  status: "pending" | "success" | "failed" | "retrying";
  error_message: string | null;
  attempt_count: number;
  created_at: string;
};

const SUPPORT_ENDPOINTS = [
  {
    name: "Email Webhook",
    path: "/api/support/webhooks/email",
    envKey: "SUPPORT_EMAIL_WEBHOOK_KEY",
    description: "Receives inbound emails and attaches them to support tickets via ticket number in subject.",
  },
  {
    name: "WhatsApp Webhook",
    path: "/api/support/webhooks/whatsapp",
    envKey: "SUPPORT_WHATSAPP_WEBHOOK_KEY",
    description: "Receives inbound WhatsApp messages and attaches them to open support tickets by customer phone number.",
  },
];

export function WebhooksClient() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"config" | "logs" | "endpoints">("config");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [testResult, setTestResult] = useState<{ loading: boolean; result?: string }>({ loading: false });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, logRes] = await Promise.all([
        fetch("/api/support/webhooks/configs"),
        fetch("/api/support/webhooks/logs"),
      ]);
      if (whRes.ok) {
        const whData = await whRes.json();
        setWebhooks(whData.data ?? []);
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.data ?? []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleTest = async (endpoint: string) => {
    setTestResult({ loading: true });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
        body: JSON.stringify({ test: true, subject: "TKT-TEST-000001", from: "test@example.com", text: "This is a test webhook payload." }),
      });
      const data = await res.json();
      setTestResult({ loading: false, result: data.ok ? "Webhook endpoint responded successfully." : `Error: ${data.error?.message ?? "Unknown"}` });
    } catch (err) {
      setTestResult({ loading: false, result: `Request failed: ${err instanceof Error ? err.message : "Unknown"}` });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "success": return "bg-green-50 text-green-700 border-green-200";
      case "failed": return "bg-red-50 text-red-700 border-red-200";
      case "retrying": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const filteredLogs = logStatusFilter === "all" ? logs : logs.filter((l) => l.status === logStatusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhook Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage outbound webhook configurations and monitor delivery across all organizations.</p>
        </div>
        <button onClick={fetchAll} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {(["config", "logs", "endpoints"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab === "config" ? "Webhook Configs" : tab === "logs" ? "Delivery Logs" : "Support Endpoints"}
          </button>
        ))}
      </div>

      {activeTab === "config" && (
        <div className="space-y-3">
          {webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <ExternalLink className="h-8 w-8 text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No webhook configurations found</p>
              <p className="text-xs text-muted-foreground mt-1">Organizations have not configured any outbound webhooks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{wh.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${wh.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {wh.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{wh.url}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground">Org: {wh.organization_id.slice(0, 8)}...</span>
                        {wh.last_triggered_at && (
                          <span className="text-[10px] text-muted-foreground">
                            Last: {new Date(wh.last_triggered_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(wh.events ?? []).slice(0, 4).map((ev) => (
                          <span key={ev} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{ev}</span>
                        ))}
                        {(wh.events ?? []).length > 4 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">+{wh.events.length - 4}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Filter by status:</span>
            {(["all", "success", "failed", "pending", "retrying"] as const).map((s) => (
              <button key={s} onClick={() => setLogStatusFilter(s)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${
                  logStatusFilter === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Clock className="h-8 w-8 text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No delivery logs</p>
              <p className="text-xs text-muted-foreground mt-1">Webhook delivery logs appear when organizations trigger outbound webhooks.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Response</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{log.event_type}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${statusBadge(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{log.response_status ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{log.attempt_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "endpoints" && (
        <div className="space-y-4">
          {SUPPORT_ENDPOINTS.map((ep) => (
            <div key={ep.name} className="rounded-lg border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{ep.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground font-mono">{ep.path}</code>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${ep.path}`); }} className="p-1 hover:text-foreground text-muted-foreground">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Auth: <code className="font-mono bg-muted px-1 rounded">x-api-key</code> header</span>
                    <span>Env: <code className="font-mono bg-muted px-1 rounded">{ep.envKey}</code></span>
                  </div>
                </div>
                <button
                  onClick={() => handleTest(ep.path)}
                  disabled={testResult.loading}
                  className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Send className="h-3 w-3" />
                  {testResult.loading ? "Testing..." : "Test"}
                </button>
              </div>
              {testResult.result && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-md border ${testResult.result.includes("successfully") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {testResult.result}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
