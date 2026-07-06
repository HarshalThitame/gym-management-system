import { createAdminClient } from "@/lib/supabase/admin";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type GeoFenceEvaluation = {
  enabled: boolean;
  branchId: string | null;
  branchName: string | null;
  radiusMeters: number;
  distanceMeters: number | null;
  insideFence: boolean;
  message: string;
};

export type GeofenceExitDecisionStatus = "inside" | "outside_pending" | "outside_confirmed" | "low_accuracy" | "no_active_session";

export type GeofenceExitDecision = {
  status: GeofenceExitDecisionStatus;
  shouldAutoCheckout: boolean;
  shouldStoreOutsideEvent: boolean;
  reasonCode: string;
  message: string;
  consecutiveOutsideSamples: number;
  outsideSampleThreshold: number;
  minimumAccuracyMeters: number;
  graceWindowSeconds: number;
};

type GeofenceHistoryEvent = {
  inside_geofence: boolean;
  occurred_at: string;
  accuracy_m?: number | null;
  metadata?: Record<string, unknown> | null;
};

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint) {
  const earthRadiusMeters = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const hav = Math.sin(dLat / 2) ** 2
    + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(hav));
}

export function isGeofenceEnabled(settings: unknown) {
  if (!settings || typeof settings !== "object") return false;
  const value = (settings as Record<string, unknown>).geo_fence_enabled;
  return value === true || value === "true";
}

export function getGeofenceRadiusMeters(settings: unknown) {
  if (!settings || typeof settings !== "object") return 150;
  const raw = (settings as Record<string, unknown>).geo_fence_radius_m;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 150;
}

export function getGeofenceOutsideSampleThreshold(settings: unknown) {
  if (!settings || typeof settings !== "object") return 2;
  const raw = (settings as Record<string, unknown>).geo_fence_outside_sample_threshold;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2;
}

export function getGeofenceMinimumAccuracyMeters(settings: unknown) {
  if (!settings || typeof settings !== "object") return 50;
  const raw = (settings as Record<string, unknown>).geo_fence_min_accuracy_m;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

export function getGeofenceExitGraceSeconds(settings: unknown) {
  if (!settings || typeof settings !== "object") return 120;
  const raw = (settings as Record<string, unknown>).geo_fence_exit_grace_seconds;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 120;
}

export function getGeofenceStaleTimeoutMinutes(settings: unknown) {
  if (!settings || typeof settings !== "object") return 5;
  const raw = (settings as Record<string, unknown>).geo_fence_stale_timeout_minutes;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
}

export function evaluateGeofenceExitDecision(input: {
  settings: unknown;
  evaluation: GeoFenceEvaluation;
  accuracyM: number | null;
  occurredAt: string;
  recentEvents: GeofenceHistoryEvent[];
  hasActiveSession: boolean;
}): GeofenceExitDecision {
  const outsideSampleThreshold = getGeofenceOutsideSampleThreshold(input.settings);
  const minimumAccuracyMeters = getGeofenceMinimumAccuracyMeters(input.settings);
  const graceWindowSeconds = getGeofenceExitGraceSeconds(input.settings);

  if (!input.hasActiveSession) {
    return {
      status: "no_active_session",
      shouldAutoCheckout: false,
      shouldStoreOutsideEvent: false,
      reasonCode: "no_active_session",
      message: "No active session is currently open.",
      consecutiveOutsideSamples: 0,
      outsideSampleThreshold,
      minimumAccuracyMeters,
      graceWindowSeconds
    };
  }

  if (input.evaluation.insideFence) {
    return {
      status: "inside",
      shouldAutoCheckout: false,
      shouldStoreOutsideEvent: false,
      reasonCode: "inside_geofence",
      message: input.evaluation.message,
      consecutiveOutsideSamples: 0,
      outsideSampleThreshold,
      minimumAccuracyMeters,
      graceWindowSeconds
    };
  }

  const accuracyKnown = typeof input.accuracyM === "number" && Number.isFinite(input.accuracyM);
  if (accuracyKnown && input.accuracyM !== null && input.accuracyM > minimumAccuracyMeters) {
    return {
      status: "low_accuracy",
      shouldAutoCheckout: false,
      shouldStoreOutsideEvent: true,
      reasonCode: "low_accuracy",
      message: `Location sample accuracy is too low (${Math.round(input.accuracyM)}m). Tracking continues until a clearer sample confirms exit.`,
      consecutiveOutsideSamples: 0,
      outsideSampleThreshold,
      minimumAccuracyMeters,
      graceWindowSeconds
    };
  }

  const outsideSamples = countConsecutiveOutsideSamples(input.recentEvents, input.occurredAt, graceWindowSeconds);
  const consecutiveOutsideSamples = outsideSamples + 1;
  const shouldAutoCheckout = consecutiveOutsideSamples >= outsideSampleThreshold;

  return {
    status: shouldAutoCheckout ? "outside_confirmed" : "outside_pending",
    shouldAutoCheckout,
    shouldStoreOutsideEvent: true,
    reasonCode: shouldAutoCheckout ? "geo_fence_exit_confirmed" : "geo_fence_exit_pending",
    message: shouldAutoCheckout
      ? "Member is outside the branch geofence."
      : `Member appears outside the branch geofence, but we are waiting for ${outsideSampleThreshold} samples before auto-checkout.`,
    consecutiveOutsideSamples,
    outsideSampleThreshold,
    minimumAccuracyMeters,
    graceWindowSeconds
  };
}

function countConsecutiveOutsideSamples(recentEvents: GeofenceHistoryEvent[], occurredAt: string, graceWindowSeconds: number) {
  const now = new Date(occurredAt).getTime();
  const graceWindowMs = graceWindowSeconds * 1000;
  let consecutive = 0;

  for (const event of recentEvents) {
    const eventMetadata = event.metadata ?? {};
    const decision = typeof eventMetadata.geofenceDecision === "string" ? eventMetadata.geofenceDecision : null;
    const eventTime = new Date(event.occurred_at).getTime();

    if (!Number.isFinite(eventTime) || now - eventTime > graceWindowMs) {
      break;
    }

    if (decision === "inside") {
      break;
    }

    if (decision === "outside_pending_low_accuracy") {
      continue;
    }

    if (decision === "outside_pending" || decision === "outside_confirmed") {
      consecutive += 1;
      continue;
    }

    if (event.inside_geofence === false) {
      consecutive += 1;
      continue;
    }

    if (event.inside_geofence === true) {
      break;
    }
  }

  return consecutive;
}

export async function evaluateBranchGeofence(branchId: string, point: GeoPoint): Promise<GeoFenceEvaluation> {
  const supabase = createAdminClient();

  const [{ data: branch }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, latitude, longitude")
      .eq("id", branchId)
      .maybeSingle(),
    supabase
      .from("branch_settings")
      .select("attendance_settings")
      .eq("branch_id", branchId)
      .maybeSingle(),
  ]);

  if (!branch || branch.latitude === null || branch.longitude === null) {
    return {
      enabled: false,
      branchId,
      branchName: branch?.name ?? null,
      radiusMeters: 0,
      distanceMeters: null,
      insideFence: true,
      message: "Branch geofence is not configured.",
    };
  }

  const attendanceSettings = settingsRow?.attendance_settings ?? {};
  const enabled = isGeofenceEnabled(attendanceSettings);
  const radiusMeters = getGeofenceRadiusMeters(attendanceSettings);
  const distanceMeters = haversineDistanceMeters(
    { latitude: Number(branch.latitude), longitude: Number(branch.longitude) },
    point
  );

  return {
    enabled,
    branchId,
    branchName: branch.name ?? null,
    radiusMeters,
    distanceMeters,
    insideFence: !enabled || distanceMeters <= radiusMeters,
    message: enabled
      ? distanceMeters <= radiusMeters
        ? "Member is inside the branch geofence."
        : "Member is outside the branch geofence."
      : "Branch geofence is disabled.",
  };
}
