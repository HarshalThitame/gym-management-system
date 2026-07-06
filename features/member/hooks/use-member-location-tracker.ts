"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDraft, saveDraft } from "@/features/pwa/lib/offline-store";
import {
  appendQueuedLocationSample,
  compactQueuedLocationSamples,
  isGeolocationPermissionDenied,
  queueKeyForMember,
  shouldSendLocationSample,
  type LocationTrackerStatus,
  type MemberLocationSample,
  type QueuedMemberLocationSample
} from "@/features/member/lib/location-tracking";

type MemberLocationTrackerInput = {
  memberId: string;
  activeSessionId: string | null;
  branchId: string | null;
  branchName: string | null;
  geofenceEnabled: boolean;
  radiusMeters: number;
  coordinatesConfigured: boolean;
  onSessionEnded: () => void;
};

type LocationReportResult = {
  ok: boolean;
  insideGeofence: boolean;
  autoCheckedOut: boolean;
  sessionActive: boolean;
  message: string;
};

type LocationTrackerState = {
  status: LocationTrackerStatus;
  message: string;
  lastSample: MemberLocationSample | null;
  lastSentAt: string | null;
  pendingCount: number;
  permissionState: PermissionState | "unavailable";
  reportNow: () => Promise<void>;
  retryLocationAccess: () => Promise<void>;
  retryPendingReports: () => Promise<void>;
};

export function useMemberLocationTracker(input: MemberLocationTrackerInput): LocationTrackerState {
  const { memberId, activeSessionId, branchName, geofenceEnabled, coordinatesConfigured, onSessionEnded } = input;
  const [status, setStatus] = useState<LocationTrackerStatus>("idle");
  const [message, setMessage] = useState("Location tracking is inactive.");
  const [lastSample, setLastSample] = useState<MemberLocationSample | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [permissionState, setPermissionState] = useState<PermissionState | "unavailable">("unavailable");
  const watchIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const lastSampleRef = useRef<MemberLocationSample | null>(null);
  const sessionEndedRef = useRef(false);
  const replayingRef = useRef(false);
  const permissionRef = useRef<PermissionState | "unavailable">("unavailable");

  const queueKey = useMemo(() => queueKeyForMember(memberId), [memberId]);

  const updatePendingCount = useCallback(async () => {
    const draft = await getDraft<QueuedMemberLocationSample[]>(queueKey);
    const queued = Array.isArray(draft?.value) ? draft.value : [];
    setPendingCount(queued.length);
    return queued;
  }, [queueKey]);

  const persistQueue = useCallback(async (items: QueuedMemberLocationSample[]) => {
    if (items.length === 0) {
      await saveDraft(queueKey, [] as QueuedMemberLocationSample[]);
      setPendingCount(0);
      return;
    }

    await saveDraft(queueKey, items);
    setPendingCount(items.length);
  }, [queueKey]);

  const queueSample = useCallback(async (sample: MemberLocationSample, sessionId: string | null) => {
    const draft = await getDraft<QueuedMemberLocationSample[]>(queueKey);
    const queued = compactQueuedLocationSamples(Array.isArray(draft?.value) ? draft.value : []);
    const nextQueue = appendQueuedLocationSample(queued, sample, memberId, sessionId);
    await persistQueue(nextQueue);
  }, [memberId, persistQueue, queueKey]);

  const sendReport = useCallback(async (sample: MemberLocationSample, options: { allowQueueFallback?: boolean } = {}) => {
    if (!activeSessionId || !geofenceEnabled || !coordinatesConfigured) {
      return { ok: false, insideGeofence: true, autoCheckedOut: false, sessionActive: false, message: "Location tracking is disabled for this branch." } satisfies LocationReportResult;
    }

    const payload = {
      memberId,
      sessionId: activeSessionId,
      latitude: sample.latitude,
      longitude: sample.longitude,
      accuracyM: sample.accuracyM,
    };

    if (!navigator.onLine) {
      if (options.allowQueueFallback !== false) {
        await queueSample(sample, payload.sessionId);
      }
      setStatus("offline");
      setMessage("Offline. Location samples are being saved locally.");
      return { ok: false, insideGeofence: true, autoCheckedOut: false, sessionActive: true, message: "Saved locally until the connection returns." };
    }

    try {
      const response = await fetch("/api/v1/attendance/geofence/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(body) ?? "Location report failed.");
      }

      const result = normalizeReportResult(body);
      setLastSample(sample);
      lastSampleRef.current = sample;
      setLastSentAt(sample.recordedAt);
      setStatus(result.autoCheckedOut ? "idle" : "tracking");
      setMessage(result.autoCheckedOut ? "You left the branch radius. Checkout was recorded automatically." : result.message);

      if (result.autoCheckedOut || !result.sessionActive) {
        sessionEndedRef.current = true;
        onSessionEnded();
      }

      return { ok: true, ...result };
    } catch (error) {
      if (options.allowQueueFallback !== false) {
        await queueSample(sample, payload.sessionId);
      }
      setStatus("offline");
      setMessage(error instanceof Error ? error.message : "Location report failed. Saved locally for retry.");
      return { ok: false, insideGeofence: true, autoCheckedOut: false, sessionActive: true, message: error instanceof Error ? error.message : "Location report failed." };
    }
  }, [activeSessionId, coordinatesConfigured, geofenceEnabled, memberId, onSessionEnded, queueSample]);

  const reportSample = useCallback(async (coords: GeolocationCoordinates) => {
    const sample: MemberLocationSample = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
      recordedAt: new Date().toISOString()
    };

    if (!shouldSendLocationSample(lastSampleRef.current, sample)) {
      setStatus((current) => current === "idle" ? "tracking" : current);
      return;
    }

    await sendReport(sample);
  }, [sendReport]);

  const collectCurrentPosition = useCallback(async (): Promise<{ ok: true } | { ok: false; terminal: boolean; status: LocationTrackerStatus; message: string }> => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      setMessage("This browser does not support location access.");
      return { ok: false, terminal: true, status: "unsupported", message: "This browser does not support location access." };
    }

    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            void reportSample(position.coords).then(() => resolve()).catch(reject);
          },
          (error) => reject(error),
          {
            enableHighAccuracy: true,
            maximumAge: 10_000,
            timeout: 15_000
          }
        );
      });
      return { ok: true };
    } catch (error) {
      if (isGeolocationPermissionDenied(error)) {
        const message = "Location permission denied. Enable location access in your browser settings to keep checkout tracking active.";
        setStatus("permission_denied");
        setMessage(message);
        return { ok: false, terminal: true, status: "permission_denied", message };
      }

      const message = error instanceof Error ? error.message : "Location capture failed.";
      setStatus("error");
      setMessage(message);
      return { ok: false, terminal: false, status: "error", message };
    }
  }, [reportSample]);

  const retryPendingReports = useCallback(async () => {
    if (replayingRef.current || sessionEndedRef.current || !activeSessionId || !geofenceEnabled) {
      return;
    }

    replayingRef.current = true;
    try {
      const draft = await getDraft<QueuedMemberLocationSample[]>(queueKey);
      const queued = compactQueuedLocationSamples(Array.isArray(draft?.value) ? draft.value : []);
      if (queued.length === 0) {
        await persistQueue([]);
        return;
      }

      const remaining: QueuedMemberLocationSample[] = [];
      for (const sample of queued) {
        const result = await sendReport(sample, { allowQueueFallback: false });
        if (!result.ok) {
          remaining.push(sample);
          continue;
        }

        if (result.autoCheckedOut || !result.sessionActive) {
          break;
        }
      }

      await persistQueue(remaining);
    } finally {
      replayingRef.current = false;
    }
  }, [activeSessionId, geofenceEnabled, persistQueue, queueKey, sendReport]);

  const bootstrapTracking = useCallback(async () => {
    if (!activeSessionId || !geofenceEnabled || !coordinatesConfigured) {
      return;
    }

    stopWatchers();
    sessionEndedRef.current = false;
    setStatus("requesting");
    setMessage(`Starting branch location tracking for ${branchName ?? "your gym"}.`);

    const permission = await readPermissionState();
    permissionRef.current = permission;
    if (permission === "denied") {
      const message = "Location permission denied. Enable location access in your browser settings to keep checkout tracking active.";
      setStatus("permission_denied");
      setMessage(message);
      stopWatchers();
      return;
    }

    const initialCapture = await collectCurrentPosition();
    if (sessionEndedRef.current) {
      stopWatchers();
      return;
    }

    if (!initialCapture.ok && initialCapture.terminal) {
      stopWatchers();
      return;
    }

    if (typeof navigator.geolocation.watchPosition === "function") {
      pollTimerRef.current = window.setInterval(() => {
        void collectCurrentPosition();
      }, 60_000);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (sessionEndedRef.current) {
            return;
          }
          void reportSample(position.coords);
        },
        (error) => {
          if (isGeolocationPermissionDenied(error)) {
            const message = "Location permission denied. Enable location access in your browser settings to keep checkout tracking active.";
            setStatus("permission_denied");
            setMessage(message);
            stopWatchers();
            return;
          }

          setStatus("error");
          setMessage(error.message || "Live location tracking failed.");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10_000,
          timeout: 20_000
        }
      );
    } else {
      pollTimerRef.current = window.setInterval(() => {
        void collectCurrentPosition();
      }, 30_000);
    }

    setStatus("tracking");
    setMessage(`Tracking active for ${branchName ?? "your gym"} checkout geofence.`);
  }, [activeSessionId, branchName, collectCurrentPosition, coordinatesConfigured, geofenceEnabled, reportSample]);

  const retryLocationAccess = useCallback(async () => {
    const permission = await readPermissionState();
    permissionRef.current = permission;
    if (permission === "denied") {
      setStatus("permission_denied");
      setMessage("Location permission is still blocked. Allow location access in browser settings, then retry.");
      return;
    }

    await bootstrapTracking();
  }, [bootstrapTracking]);

  useEffect(() => {
    void updatePendingCount();
  }, [updatePendingCount]);

  useEffect(() => {
    if (!activeSessionId || !geofenceEnabled || !coordinatesConfigured) {
      setStatus("idle");
      setMessage(activeSessionId ? "Location tracking is disabled for this branch." : "No active session to track.");
      stopWatchers();
      return;
    }

    if (!navigator.geolocation) {
      setStatus("unsupported");
      setMessage("This browser does not support location access.");
      stopWatchers();
      return;
    }

    let cancelled = false;

    void bootstrapTracking().then(() => {
      if (cancelled) {
        stopWatchers();
      }
    });

    const handleResume = () => {
      if (!document.hidden) {
        void retryPendingReports();
        if (permissionRef.current !== "denied") {
          void collectCurrentPosition();
        }
      }
    };

    const handleOnline = () => {
      void retryPendingReports();
      if (permissionRef.current !== "denied") {
        void collectCurrentPosition();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    return () => {
      cancelled = true;
      stopWatchers();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, [activeSessionId, bootstrapTracking, collectCurrentPosition, coordinatesConfigured, geofenceEnabled, retryPendingReports]);

  useEffect(() => {
    if (navigator.onLine) {
      void retryPendingReports();
    }
  }, [retryPendingReports]);

  useEffect(() => {
    if (activeSessionId) {
      return;
    }

    lastSampleRef.current = null;
    setLastSample(null);
    setLastSentAt(null);
    void persistQueue([]);
  }, [activeSessionId, persistQueue]);

  async function readPermissionState(): Promise<PermissionState | "unavailable"> {
    if (!("permissions" in navigator) || typeof navigator.permissions.query !== "function") {
      setPermissionState("unavailable");
      permissionRef.current = "unavailable";
      return "unavailable";
    }

    try {
      const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      setPermissionState(result.state);
      permissionRef.current = result.state;
      result.onchange = () => {
        setPermissionState(result.state);
        permissionRef.current = result.state;
      };
      return result.state;
    } catch {
      setPermissionState("unavailable");
      permissionRef.current = "unavailable";
      return "unavailable";
    }
  }

  function stopWatchers() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  return {
    status,
    message,
    lastSample,
    lastSentAt,
    pendingCount,
    permissionState,
    reportNow: () => collectCurrentPosition().then(() => undefined),
    retryLocationAccess,
    retryPendingReports
  };
}

function normalizeReportResult(body: unknown): LocationReportResult {
  const data = body && typeof body === "object" && "data" in body ? (body as { data?: Record<string, unknown> }).data : null;
  return {
    insideGeofence: Boolean(data?.insideGeofence ?? true),
    autoCheckedOut: data?.autoCheckedOut === true,
    sessionActive: data?.sessionActive !== false,
    message: typeof data?.message === "string" ? data.message : "Location report recorded."
  };
}

function getErrorMessage(body: unknown) {
  const error = body && typeof body === "object" && "error" in body ? (body as { error?: Record<string, unknown> }).error : null;
  return typeof error?.message === "string" ? error.message : null;
}
