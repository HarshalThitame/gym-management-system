import { describe, expect, it } from "vitest";
import { haversineDistanceMeters, isGeofenceEnabled, getGeofenceRadiusMeters } from "@/features/attendance/lib/geofence";

describe("geofence helpers", () => {
  it("computes a plausible distance between two points", () => {
    const meters = haversineDistanceMeters(
      { latitude: 19.076, longitude: 72.8777 },
      { latitude: 19.0765, longitude: 72.8782 }
    );

    expect(meters).toBeGreaterThan(0);
    expect(meters).toBeLessThan(100);
  });

  it("reads geofence settings safely", () => {
    expect(isGeofenceEnabled({ geo_fence_enabled: true })).toBe(true);
    expect(isGeofenceEnabled({})).toBe(false);
    expect(getGeofenceRadiusMeters({ geo_fence_radius_m: 250 })).toBe(250);
    expect(getGeofenceRadiusMeters({})).toBe(150);
  });
});
