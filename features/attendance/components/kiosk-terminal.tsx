"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw, LogIn, LogOut, MonitorSmartphone, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { useKioskReader } from "@/features/attendance/hooks/use-kiosk-reader";
import { deleteDraft, flushOfflineActions, getDraft, queueOfflineAction, saveDraft } from "@/features/pwa/lib/offline-store";
import { getNetworkStatusMessage } from "@/features/pwa/lib/business-rules";

type KioskDevice = {
  id: string;
  device_name: string;
  device_code?: string | null;
  device_type?: string | null;
  status?: string | null;
  location?: string | null;
  last_seen_at?: string | null;
};

type KioskResult = {
  ok: boolean;
  message: string;
  code?: string;
  status?: string;
  session_id?: string;
  member_id?: string;
  check_in_at?: string;
  check_out_at?: string;
  duration_minutes?: number;
};

type KioskQueuedAction = {
  id: string;
  mode: "checkin" | "checkout";
  endpoint: string;
  payload: Record<string, string>;
  createdAt: string;
  label: string;
};

const FORM_STATE_STORAGE_KEYS = {
  apiKey: "attendance-kiosk-api-key",
  deviceId: "attendance-kiosk-device-id",
  mode: "attendance-kiosk-mode",
  deviceUserId: "attendance-kiosk-device-user-id",
  memberId: "attendance-kiosk-member-id",
  sessionId: "attendance-kiosk-session-id",
  notes: "attendance-kiosk-notes",
  pendingQueue: "attendance-kiosk-pending-actions"
} as const;

export function KioskTerminal({ devices }: { devices: KioskDevice[] }) {
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"checkin" | "checkout">("checkin");
  const [deviceUserId, setDeviceUserId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [queuedActions, setQueuedActions] = useState<KioskQueuedAction[]>([]);
  const [syncingQueuedActions, setSyncingQueuedActions] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<KioskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { lastScanAt, readerMessage, readerMode, readerStatus, setReaderMode } = useKioskReader({
    onScan: ({ value }) => {
      setDeviceUserId(value);
    }
  });

  const selectedDevice = useMemo(() => devices.find((device) => device.id === deviceId) ?? null, [deviceId, devices]);
  const queuedCount = queuedActions.length;
  const networkMessage = getNetworkStatusMessage(isOnline, queuedCount);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("Connection restored. Syncing queued kiosk actions.");
      void syncQueuedActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("Offline mode enabled. New kiosk actions will be queued locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // syncQueuedActions is stable enough for the mounted kiosk; it is defined below in the same component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void hydrateKioskSession();
  }, []);

  useEffect(() => {
    if (isOnline && apiKey.trim() && queuedActions.length > 0 && !syncingQueuedActions) {
      void syncQueuedActions();
    }
    // The kiosk should opportunistically retry on reconnect or when pending actions exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, apiKey, queuedActions.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.apiKey, apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.deviceId, deviceId);
  }, [deviceId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.mode, mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.deviceUserId, deviceUserId);
  }, [deviceUserId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.memberId, memberId);
  }, [memberId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.sessionId, sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    persistSessionValue(FORM_STATE_STORAGE_KEYS.notes, notes);
  }, [notes]);

  async function hydrateKioskSession() {
    if (typeof window === "undefined") {
      return;
    }

    const storedApiKey = readSessionValue(FORM_STATE_STORAGE_KEYS.apiKey);
    const storedDeviceId = readSessionValue(FORM_STATE_STORAGE_KEYS.deviceId);
    const storedMode = readSessionValue(FORM_STATE_STORAGE_KEYS.mode);
    const storedDeviceUserId = readSessionValue(FORM_STATE_STORAGE_KEYS.deviceUserId);
    const storedMemberId = readSessionValue(FORM_STATE_STORAGE_KEYS.memberId);
    const storedSessionId = readSessionValue(FORM_STATE_STORAGE_KEYS.sessionId);
    const storedNotes = readSessionValue(FORM_STATE_STORAGE_KEYS.notes);

    if (storedApiKey) setApiKey(storedApiKey);
    if (storedDeviceId) setDeviceId(storedDeviceId);
    if (storedMode === "checkin" || storedMode === "checkout") setMode(storedMode);
    if (storedDeviceUserId) setDeviceUserId(storedDeviceUserId);
    if (storedMemberId) setMemberId(storedMemberId);
    if (storedSessionId) setSessionId(storedSessionId);
    if (storedNotes) setNotes(storedNotes);

    const draft = await getDraft<unknown>(FORM_STATE_STORAGE_KEYS.pendingQueue);
    setQueuedActions(normalizeQueuedActions(draft?.value));
  }

  async function syncQueuedActions() {
    if (!navigator.onLine || syncingQueuedActions || queuedActions.length === 0) {
      return;
    }

    if (!apiKey.trim()) {
      setSyncStatus("Queued kiosk actions are waiting for the device API key.");
      return;
    }

    setSyncingQueuedActions(true);
    setSyncStatus("Retrying queued kiosk actions.");
    setError(null);

    try {
      const remaining: KioskQueuedAction[] = [];

      for (const action of queuedActions) {
        const replayResult = await replayQueuedAction(action, apiKey.trim());
        if (replayResult.synced) {
          continue;
        }

        remaining.push({
          ...action,
          label: replayResult.reason
        });
      }

      setQueuedActions(remaining);
      await persistQueuedActions(remaining);

      try {
        await flushOfflineActions();
      } catch {
        // The browser outbox is an audit trail. If the server sync is unavailable, keep the
        // local kiosk queue cleared only after the device request itself succeeded.
      }

      setSyncStatus(remaining.length > 0 ? `${remaining.length} kiosk action${remaining.length === 1 ? "" : "s"} still need manual review.` : "Queued kiosk actions synced.");
    } catch (syncError) {
      setSyncStatus("Kiosk sync failed. Manual review required.");
      setError(syncError instanceof Error ? syncError.message : "Queued kiosk sync failed.");
    } finally {
      setSyncingQueuedActions(false);
    }
  }

  async function submit() {
    if (!deviceId || !apiKey.trim()) {
      setError("Device ID and API key are required.");
      return;
    }

    const endpoint = mode === "checkout" ? "/api/attendance/devices/check-out" : "/api/attendance/devices/check-in";
    const payload = buildPayload({ deviceUserId, memberId, sessionId, notes });

    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await sendKioskRequest(endpoint, payload, apiKey.trim());
      if (!response.ok) {
        const errorCode = getErrorCode(response.json);
        if (!navigator.onLine || response.response.status === 503 || errorCode === "OFFLINE") {
          const fallbackQueued = await queueKioskAction(endpoint, payload, mode);
          const nextQueue = [...queuedActions, fallbackQueued];
          setQueuedActions(nextQueue);
          await persistQueuedActions(nextQueue);
          setResult({
            ok: true,
            message: "Saved offline. This kiosk action will sync automatically when the device comes back online.",
            code: "QUEUED_OFFLINE"
          });
          setSyncStatus("Kiosk action queued locally.");
          return;
        }

        const failureMessage = getErrorMessage(response.json) ?? "Kiosk request failed.";
        setResult({
          ok: false,
          message: failureMessage,
          code: errorCode ?? "REQUEST_FAILED"
        });
        setError(failureMessage);
        return;
      }

      setResult(normalizeSuccessfulResult(response.json, mode));
      setSyncStatus("Live kiosk request completed.");
    } catch {
      const fallbackQueued = await queueKioskAction(endpoint, payload, mode);
      const nextQueue = [...queuedActions, fallbackQueued];
      setQueuedActions(nextQueue);
      await persistQueuedActions(nextQueue);

      setResult({
        ok: true,
        message: "Network unavailable. This kiosk action was queued and will retry automatically.",
        code: "QUEUED_OFFLINE"
      });
      setSyncStatus("Kiosk action queued locally.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden border-white/10 bg-[#0b1220] text-white shadow-2xl">
        <CardHeader className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Enterprise Kiosk</p>
              <h2 className="mt-2 text-3xl font-black">RFID / NFC / Device Check-In</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Use a registered reader API key, scan a card UID, or enter a member ID. Keyboard-wedge readers and Web NFC are both supported where the browser allows them.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Device</p>
              <p className="mt-1 text-lg font-black">{selectedDevice?.device_name ?? "Select a device"}</p>
              <p className="text-xs text-slate-300">{selectedDevice?.device_type ?? "Unknown type"}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPill online={isOnline} />
            <StatusPill online={queuedCount === 0} label={queuedCount > 0 ? `${queuedCount} queued` : "No queue"} />
            {syncingQueuedActions ? (
              <StatusPill online={true} label="Syncing queue" />
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-6">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            {networkMessage}
          </div>
          {syncStatus ? <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">{syncStatus}</div> : null}
          {readerMessage ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">{readerMessage}</div> : null}
          <div className="flex flex-wrap gap-2">
            <StatusPill online={readerStatus === "active" || readerStatus === "listening"} label={`Reader ${readerStatus}`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Device</span>
              <select
                className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
              >
                <option value="">Select device</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.device_name} {device.device_code ? `· ${device.device_code}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">API Key</span>
              <Input
                className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                placeholder="dev_..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
          </div>

          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${mode === "checkin" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/5"}`}
              onClick={() => setMode("checkin")}
              type="button"
            >
              <LogIn className="size-4" />
              Check In
            </button>
            <button
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${mode === "checkout" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/5"}`}
              onClick={() => setMode("checkout")}
              type="button"
            >
              <LogOut className="size-4" />
              Check Out
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${readerMode === "keyboard_wedge" ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
              onClick={() => setReaderMode("keyboard_wedge")}
              type="button"
            >
              <p className="font-black uppercase tracking-[0.14em]">Keyboard wedge</p>
              <p className="mt-1 text-xs opacity-80">Best for USB RFID readers that type the card UID like a keyboard.</p>
            </button>
            <button
              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${readerMode === "web_nfc" ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
              onClick={() => setReaderMode("web_nfc")}
              type="button"
            >
              <p className="font-black uppercase tracking-[0.14em]">Web NFC</p>
              <p className="mt-1 text-xs opacity-80">Use supported browsers and NFC-enabled devices for native reads.</p>
            </button>
            <button
              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${readerMode === "manual" ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
              onClick={() => setReaderMode("manual")}
              type="button"
            >
              <p className="font-black uppercase tracking-[0.14em]">Manual</p>
              <p className="mt-1 text-xs opacity-80">Fallback mode for staff-assisted entry and unsupported browsers.</p>
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Card UID / Device User ID</span>
              <Input
                className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                placeholder="RFID-001"
                value={deviceUserId}
                onChange={(event) => setDeviceUserId(event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Member ID fallback</span>
              <Input
                className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                placeholder="member-uuid"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              />
            </label>
          </div>

          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
            {readerMode === "keyboard_wedge" ? (
              <p>Keyboard wedge capture is active. Tap or scan a card and the reader payload will auto-fill the device user ID field.</p>
            ) : readerMode === "web_nfc" ? (
              <p>Web NFC is active. The browser must support NDEFReader and NFC scanning must be allowed on this device.</p>
            ) : (
              <p>Manual mode is active. Enter the card UID or member ID yourself.</p>
            )}
            {lastScanAt ? <p className="mt-2 opacity-80">Last scan: {new Date(lastScanAt).toLocaleString("en-IN")}</p> : null}
          </div>

          {mode === "checkout" ? (
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Session ID</span>
              <Input
                className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                placeholder="Optional active session id"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              />
            </label>
          ) : null}

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Notes</span>
            <Textarea
              className="min-h-[90px] border-white/10 bg-white/5 text-white placeholder:text-slate-400"
              placeholder="Optional terminal notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <Button className="h-12 w-full rounded-xl text-base font-black" disabled={pending} onClick={() => void submit()} type="button">
              {pending ? "Processing..." : mode === "checkout" ? "Submit Check Out" : "Submit Check In"}
            </Button>
            <Button
              className="h-12 w-full rounded-xl text-base font-black"
              disabled={syncingQueuedActions || queuedCount === 0 || !apiKey.trim()}
              onClick={() => void syncQueuedActions()}
              type="button"
              variant="secondary"
            >
              {syncingQueuedActions ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Syncing Queue
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>

          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
              <p>{error}</p>
            </div>
          ) : null}

          {result ? (
            <div className={`rounded-xl border p-4 text-sm ${result.ok ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-50" : "border-red-400/20 bg-red-400/10 text-red-50"}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                <p className="font-black">{result.message}</p>
              </div>
              {result.code ? <p className="mt-2 text-xs uppercase tracking-[0.14em] opacity-80">Code: {result.code}</p> : null}
              {result.status ? <p className="mt-2 text-xs uppercase tracking-[0.14em] opacity-80">Status: {result.status}</p> : null}
              {result.session_id ? <p className="mt-1 break-all text-xs opacity-80">Session: {result.session_id}</p> : null}
              {result.duration_minutes !== undefined ? <p className="mt-1 text-xs opacity-80">Duration: {result.duration_minutes} minutes</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="size-5" />
            <h3 className="text-xl font-black">Device Summary</h3>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">Operational state for the selected kiosk device. Keep the API key secure.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-border bg-surface-muted p-4">
            <InfoRow label="Device" value={selectedDevice?.device_name ?? "Select a device"} />
            <InfoRow label="Code" value={selectedDevice?.device_code ?? "—"} />
            <InfoRow label="Type" value={selectedDevice?.device_type ?? "—"} />
            <InfoRow label="Status" value={selectedDevice?.status ?? "—"} />
            <InfoRow label="Location" value={selectedDevice?.location ?? "—"} />
            <InfoRow label="Last seen" value={selectedDevice?.last_seen_at ? new Date(selectedDevice.last_seen_at).toLocaleString("en-IN") : "Never"} />
          </div>

          <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Queued actions</p>
            {queuedActions.length > 0 ? (
              <div className="mt-3 space-y-3">
                {queuedActions.slice(0, 5).map((action) => (
                  <div key={action.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{action.label}</p>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{action.mode}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(action.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No queued kiosk actions.</p>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4">
            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="size-4 text-emerald-500" /> : <WifiOff className="size-4 text-amber-500" />}
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Operational notes</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Use a mapped `device_user_id` for RFID/NFC readers.</li>
              <li>Use member ID fallback only for manual kiosk override.</li>
              <li>Check-out can target the latest active session when no session ID is provided.</li>
              <li>Queued requests replay with the stored device API key from the active browser session.</li>
              <li>Local kiosk actions are replayed before the browser outbox sync is flushed.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ online, label }: { online: boolean; label?: string }) {
  const text = label ?? (online ? "Online" : "Offline");
  const icon = online ? <Wifi className="size-3.5" /> : <CloudOff className="size-3.5" />;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${
        online ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"
      }`}
    >
      {icon}
      {text}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="max-w-[60%] truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

async function sendKioskRequest(endpoint: string, payload: Record<string, string>, apiKey: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json().catch(() => null);

  return { response, json };
}

function normalizeSuccessfulResult(json: unknown, mode: "checkin" | "checkout"): KioskResult {
  const data = json && typeof json === "object" && "data" in json ? (json as { data?: Record<string, unknown> }).data : undefined;
  const status = typeof data?.status === "string" ? data.status : undefined;

  return {
    ok: true,
    message:
      status === "already_inside"
        ? "Member is already checked in."
        : mode === "checkout"
          ? "Member checked out successfully."
          : "Member checked in successfully.",
    status,
    session_id: typeof data?.session_id === "string" ? data.session_id : undefined,
    member_id: typeof data?.member_id === "string" ? data.member_id : undefined,
    check_in_at: typeof data?.check_in_at === "string" ? data.check_in_at : undefined,
    check_out_at: typeof data?.check_out_at === "string" ? data.check_out_at : undefined,
    duration_minutes: typeof data?.duration_minutes === "number" ? data.duration_minutes : undefined
  };
}

async function queueKioskAction(endpoint: string, payload: Record<string, string>, mode: "checkin" | "checkout") {
  const queuedAction = await queueOfflineAction({
    type: mode === "checkout" ? "attendance_check_out" : "attendance_check_in",
    endpoint,
    method: "POST",
    payload
  });

  return {
    id: queuedAction.id,
    mode,
    endpoint,
    payload,
    createdAt: queuedAction.createdAt,
    label: `${mode === "checkout" ? "Check out" : "Check in"} queued offline`
  } satisfies KioskQueuedAction;
}

async function replayQueuedAction(action: KioskQueuedAction, apiKey: string) {
  const { response, json } = await sendKioskRequest(action.endpoint, action.payload, apiKey);

  if (response.ok) {
    return { synced: true, reason: "synced" };
  }

  const errorCode = getErrorCode(json);
  if (action.mode === "checkin" && errorCode === "VALIDATION_ERROR") {
    return { synced: false, reason: "Check-in validation failed. Manual review required." };
  }

  if (action.mode === "checkout" && (errorCode === "NO_ACTIVE_SESSION" || errorCode === "SESSION_NOT_FOUND")) {
    return { synced: true, reason: "already-processed" };
  }

  if (action.mode === "checkin" && getAlreadyInsideStatus(json)) {
    return { synced: true, reason: "already-processed" };
  }

  return { synced: false, reason: getErrorMessage(json) ?? "Queued action could not be replayed." };
}

function getAlreadyInsideStatus(json: unknown) {
  const data = json && typeof json === "object" && "data" in json ? (json as { data?: Record<string, unknown> }).data : undefined;
  return typeof data?.status === "string" && data.status === "already_inside";
}

function getErrorCode(json: unknown) {
  const error = json && typeof json === "object" && "error" in json ? (json as { error?: Record<string, unknown> }).error : undefined;
  return typeof error?.code === "string" ? error.code : null;
}

function getErrorMessage(json: unknown) {
  const error = json && typeof json === "object" && "error" in json ? (json as { error?: Record<string, unknown> }).error : undefined;
  return typeof error?.message === "string" ? error.message : null;
}

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function persistSessionValue(key: string, value: string) {
  try {
    if (value.trim()) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore browser storage failures. The kiosk still works without persistence.
  }
}

async function persistQueuedActions(actions: KioskQueuedAction[]) {
  if (actions.length === 0) {
    await deleteDraft(FORM_STATE_STORAGE_KEYS.pendingQueue);
    return;
  }

  await saveQueuedActionsDraft(actions);
}

async function saveQueuedActionsDraft(actions: KioskQueuedAction[]) {
  const normalized = normalizeQueuedActions(actions);
  await saveDraft(FORM_STATE_STORAGE_KEYS.pendingQueue, normalized);
}

function normalizeQueuedActions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Partial<KioskQueuedAction>;

    if (
      typeof record.id !== "string" ||
      (record.mode !== "checkin" && record.mode !== "checkout") ||
      typeof record.endpoint !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.label !== "string" ||
      !record.payload ||
      typeof record.payload !== "object"
    ) {
      return [];
    }

    return [
      {
        id: record.id,
        mode: record.mode,
        endpoint: record.endpoint,
        payload: record.payload as Record<string, string>,
        createdAt: record.createdAt,
        label: record.label
      }
    ];
  });
}

function buildPayload(input: { deviceUserId: string; memberId: string; sessionId: string; notes: string }) {
  const payload: Record<string, string> = {};

  if (input.deviceUserId.trim()) payload.device_user_id = input.deviceUserId.trim();
  if (input.memberId.trim()) payload.member_id = input.memberId.trim();
  if (input.sessionId.trim()) payload.session_id = input.sessionId.trim();
  if (input.notes.trim()) payload.notes = input.notes.trim();

  return payload;
}
