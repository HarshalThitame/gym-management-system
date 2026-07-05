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
