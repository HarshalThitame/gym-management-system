"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Send, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

type AnalyticsData = {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  avgAttendanceRate: number;
  trend: { direction: "up" | "down" | "flat"; percent: number };
  totalCheckins: number;
  avgSessionDuration: number;
  peakHour: number | null;
  peakHourCount: number;
};

type OccupancyData = {
  currentlyInside: number;
  heatmap: Array<{ dayOfWeek: number; hourOfDay: number; avgMembersInGym: number; avgOccupancyPercent: number; samples: number }>;
};

type AutomationConfig = {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  smsConfigured: boolean;
  whatsappConfigured: boolean;
  rules: Array<{
    id: string;
    name: string;
    eventType: string;
    status: string;
    priority: number;
    runCount: number;
    lastRunAt: string | null;
    alertType: string | null;
  }>;
};

type BatchResult = {
  checkedInCount?: number;
  checkedOutCount?: number;
  failedCount: number;
  results: Array<{ memberId: string; success: boolean; message: string; code: string | null }>;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Phase2AttendanceHub({ gymId, branchId }: { gymId: string | null; branchId: string | null }) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [automation, setAutomation] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batchMemberIds, setBatchMemberIds] = useState("");
  const [batchSessionType, setBatchSessionType] = useState("class");
  const [batchSessionName, setBatchSessionName] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchPending, setBatchPending] = useState<"checkin" | "checkout" | null>(null);

  const [alertMemberId, setAlertMemberId] = useState("");
  const [alertType, setAlertType] = useState<"streak_alert" | "churn_warning">("streak_alert");
  const [alertChannels, setAlertChannels] = useState<("sms" | "whatsapp")[]>(["sms", "whatsapp"]);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertResult, setAlertResult] = useState<string | null>(null);
  const [alertPending, setAlertPending] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (gymId) params.set("gymId", gymId);
        if (branchId) params.set("branchId", branchId);

        const [analyticsResponse, occupancyResponse, automationResponse] = await Promise.all([
          fetch(`/api/v1/analytics/attendance?${params.toString()}`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/v1/analytics/occupancy?${params.toString()}`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/v1/automation/config?${params.toString()}`, { cache: "no-store", signal: controller.signal }),
        ]);

        if (!analyticsResponse.ok || !occupancyResponse.ok || !automationResponse.ok) {
          throw new Error("Unable to load Phase 2 attendance analytics.");
        }

        const [analyticsJson, occupancyJson, automationJson] = await Promise.all([
          analyticsResponse.json(),
          occupancyResponse.json(),
          automationResponse.json(),
        ]);

        if (!active) return;

        setAnalytics(analyticsJson.data ?? null);
        setOccupancy(occupancyJson.data ?? null);
        setAutomation(automationJson.data ?? null);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load Phase 2 attendance analytics.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [branchId, gymId]);

  const heatmapPreview = useMemo(() => {
    if (!occupancy?.heatmap) return [];
    return occupancy.heatmap
      .filter((entry) => entry.samples > 0)
      .slice()
      .sort((a, b) => b.avgOccupancyPercent - a.avgOccupancyPercent)
      .slice(0, 10);
  }, [occupancy]);

  async function submitBatch(kind: "checkin" | "checkout") {
    const memberIds = batchMemberIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    if (memberIds.length === 0) {
      setBatchResult({ failedCount: 1, results: [{ memberId: "", success: false, message: "Add at least one memberId.", code: "VALIDATION_ERROR" }] });
      return;
    }

    setBatchPending(kind);
    setBatchResult(null);
    try {
      const response = await fetch(`/api/v1/attendance/${kind === "checkin" ? "batch-checkin" : "batch-checkout"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          branchId,
          memberIds,
          sessionType: batchSessionType,
          sessionName: batchSessionName,
          notes: batchNotes,
          allInside: kind === "checkout" ? false : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "Batch request failed.");
      }
      setBatchResult(json.data ?? null);
    } catch (submitError) {
      setBatchResult({ failedCount: 1, results: [{ memberId: "", success: false, message: submitError instanceof Error ? submitError.message : "Batch request failed.", code: "REQUEST_FAILED" }] });
    } finally {
      setBatchPending(null);
    }
  }

  async function sendAlert() {
    setAlertPending(true);
    setAlertResult(null);
    try {
      const response = await fetch("/api/v1/automation/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          branchId,
          memberId: alertMemberId,
          alertType,
          channels: alertChannels,
          message: alertMessage || undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "Alert send failed.");
      }
      setAlertResult(`${json.data.memberName} alert queued via ${json.data.channels.map((channel: { channel: string }) => channel.channel).join(", ")}.`);
      setAutomation(json.data.config ?? automation);
    } catch (sendError) {
      setAlertResult(sendError instanceof Error ? sendError.message : "Alert send failed.");
    } finally {
      setAlertPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Phase 2</p>
          <h3 className="mt-1 text-2xl font-black">Analytics, batch actions, and alerts</h3>
        </div>
        <Button disabled={loading} onClick={() => window.location.reload()} variant="secondary">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Members" value={analytics ? String(analytics.totalMembers) : "—"} detail={analytics ? `${analytics.activeMembers} active / ${analytics.inactiveMembers} inactive` : "Loading"} />
        <InfoCard label="Attendance rate" value={analytics ? `${analytics.avgAttendanceRate}%` : "—"} detail={analytics ? `Trend ${analytics.trend.direction} ${analytics.trend.percent}%` : "Loading"} />
        <InfoCard label="Occupancy" value={occupancy ? String(occupancy.currentlyInside) : "—"} detail={occupancy ? "Current inside" : "Loading"} />
        <InfoCard label="Alerts" value={automation ? String(automation.rules.length) : "—"} detail={automation ? `${automation.smsEnabled ? "SMS" : "No SMS"} · ${automation.whatsappEnabled ? "WhatsApp" : "No WhatsApp"}` : "Loading"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h4 className="text-xl font-black">Batch attendance</h4>
            <p className="text-sm leading-6 text-muted-foreground">Paste comma-separated member IDs for bulk check-in or checkout. This is routed through the shared v1 attendance APIs.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea rows={4} value={batchMemberIds} onChange={(event) => setBatchMemberIds(event.target.value)} placeholder="member-1, member-2, member-3" />
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={batchSessionType} onChange={(event) => setBatchSessionType(event.target.value)} placeholder="class" />
              <Input value={batchSessionName} onChange={(event) => setBatchSessionName(event.target.value)} placeholder="Morning Strength" />
            </div>
            <Textarea rows={2} value={batchNotes} onChange={(event) => setBatchNotes(event.target.value)} placeholder="Optional notes" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={batchPending !== null} onClick={() => void submitBatch("checkin")} type="button">
                <UsersRound className="size-4" />
                {batchPending === "checkin" ? "Checking in..." : "Batch Check In"}
              </Button>
              <Button disabled={batchPending !== null} onClick={() => void submitBatch("checkout")} type="button" variant="secondary">
                <UsersRound className="size-4" />
                {batchPending === "checkout" ? "Checking out..." : "Batch Check Out"}
              </Button>
            </div>
            {batchResult ? (
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
                <p className="font-bold">{batchResult.checkedInCount !== undefined ? `${batchResult.checkedInCount} checked in` : `${batchResult.checkedOutCount ?? 0} checked out`} · {batchResult.failedCount} failed</p>
                <ul className="mt-2 space-y-1">
                  {batchResult.results.slice(0, 5).map((result) => (
                    <li key={`${result.memberId}-${result.message}`} className={result.success ? "text-emerald-600" : "text-red-600"}>{result.memberId || "member"}: {result.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h4 className="text-xl font-black">Attendance alerts</h4>
            <p className="text-sm leading-6 text-muted-foreground">Send retention or streak alerts over the configured SMS/WhatsApp providers.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={alertMemberId} onChange={(event) => setAlertMemberId(event.target.value)} placeholder="Member ID" />
            <div className="grid gap-3 md:grid-cols-2">
              <select className="h-11 rounded-md border border-border bg-surface px-3 text-base" value={alertType} onChange={(event) => setAlertType(event.target.value as "streak_alert" | "churn_warning")}>
                <option value="streak_alert">Streak alert</option>
                <option value="churn_warning">Churn warning</option>
              </select>
              <Input value={alertMessage} onChange={(event) => setAlertMessage(event.target.value)} placeholder="Optional custom message" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["sms", "whatsapp"] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
                  <input checked={alertChannels.includes(channel)} onChange={(event) => {
                    setAlertChannels((current) => event.target.checked ? [...new Set([...current, channel])] : current.filter((item) => item !== channel));
                  }} type="checkbox" />
                  {channel}
                </label>
              ))}
            </div>
            <Button disabled={alertPending} onClick={() => void sendAlert()} type="button">
              <Send className="size-4" />
              {alertPending ? "Sending..." : "Send Alert"}
            </Button>
            {alertResult ? <p className="text-sm font-semibold text-muted-foreground">{alertResult}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h4 className="text-xl font-black">Automation config</h4>
            <p className="text-sm leading-6 text-muted-foreground">Provider readiness and active attendance automation rules.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="SMS" value={automation?.smsEnabled ? "Enabled" : "Disabled"} />
              <MiniStat label="WhatsApp" value={automation?.whatsappEnabled ? "Enabled" : "Disabled"} />
            </div>
            <div className="space-y-2">
              {automation?.rules?.length ? automation.rules.slice(0, 4).map((rule) => (
                <div className="rounded-lg border border-border bg-surface-muted p-3" key={rule.id}>
                  <p className="font-bold">{rule.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{rule.eventType} · {rule.status} · runs {rule.runCount}</p>
                </div>
              )) : <p className="text-sm font-semibold text-muted-foreground">No attendance automation rules detected.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h4 className="text-xl font-black">Occupancy heatmap preview</h4>
            <p className="text-sm leading-6 text-muted-foreground">Top usage windows from the new occupancy analytics API.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              {heatmapPreview.length ? heatmapPreview.map((entry) => (
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2" key={`${entry.dayOfWeek}-${entry.hourOfDay}`}>
                  <div>
                    <p className="font-bold">{dayLabels[entry.dayOfWeek]} {String(entry.hourOfDay).padStart(2, "0")}:00</p>
                    <p className="text-xs font-semibold text-muted-foreground">{entry.samples} snapshots</p>
                  </div>
                  <p className="text-sm font-black">{entry.avgOccupancyPercent}%</p>
                </div>
              )) : (
                <p className="text-sm font-semibold text-muted-foreground">No occupancy snapshots yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
