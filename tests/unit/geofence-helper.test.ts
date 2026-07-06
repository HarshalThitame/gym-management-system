import { describe, expect, it } from "vitest";
import {
  evaluateGeofenceExitDecision,
  getGeofenceExitGraceSeconds,
  getGeofenceMinimumAccuracyMeters,
  getGeofenceOutsideSampleThreshold,
  getGeofenceRadiusMeters,
  haversineDistanceMeters,
  isGeofenceEnabled
} from "@/features/attendance/lib/geofence";

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
    expect(getGeofenceOutsideSampleThreshold({})).toBe(2);
    expect(getGeofenceMinimumAccuracyMeters({})).toBe(50);
    expect(getGeofenceExitGraceSeconds({})).toBe(120);
  });

  it("treats low accuracy and single outside samples as pending before confirmation", () => {
    const lowAccuracyDecision = evaluateGeofenceExitDecision({
      settings: {},
      evaluation: {
        enabled: true,
        branchId: "branch-1",
        branchName: "Main Branch",
        radiusMeters: 150,
        distanceMeters: 190,
        insideFence: false,
        message: "Member is outside the branch geofence.",
      },
      accuracyM: 80,
      occurredAt: "2026-07-06T09:00:00.000Z",
      recentEvents: [],
      hasActiveSession: true
    });

    expect(lowAccuracyDecision).toMatchObject({
      status: "low_accuracy",
      shouldAutoCheckout: false,
      shouldStoreOutsideEvent: true,
      reasonCode: "low_accuracy"
    });

    const pendingDecision = evaluateGeofenceExitDecision({
      settings: { geo_fence_outside_sample_threshold: 3 },
      evaluation: {
        enabled: true,
        branchId: "branch-1",
        branchName: "Main Branch",
        radiusMeters: 150,
        distanceMeters: 190,
        insideFence: false,
        message: "Member is outside the branch geofence.",
      },
      accuracyM: 12,
      occurredAt: "2026-07-06T09:00:00.000Z",
      recentEvents: [
        {
          inside_geofence: false,
          occurred_at: "2026-07-06T08:59:30.000Z",
          metadata: { geofenceDecision: "outside_pending" }
        }
      ],
      hasActiveSession: true
    });

    expect(pendingDecision).toMatchObject({
      status: "outside_pending",
      shouldAutoCheckout: false,
      shouldStoreOutsideEvent: true,
      reasonCode: "geo_fence_exit_pending",
      consecutiveOutsideSamples: 2,
      outsideSampleThreshold: 3
    });
  });

  it("confirms exit after enough recent outside samples", () => {
    const confirmedDecision = evaluateGeofenceExitDecision({
      settings: { geo_fence_outside_sample_threshold: 2 },
      evaluation: {
        enabled: true,
        branchId: "branch-1",
        branchName: "Main Branch",
        radiusMeters: 150,
        distanceMeters: 190,
        insideFence: false,
        message: "Member is outside the branch geofence.",
      },
      accuracyM: 12,
      occurredAt: "2026-07-06T09:00:00.000Z",
      recentEvents: [
        {
          inside_geofence: false,
          occurred_at: "2026-07-06T08:59:45.000Z",
          metadata: { geofenceDecision: "outside_pending" }
        }
      ],
      hasActiveSession: true
    });

    expect(confirmedDecision).toMatchObject({
      status: "outside_confirmed",
      shouldAutoCheckout: true,
      shouldStoreOutsideEvent: true,
      reasonCode: "geo_fence_exit_confirmed",
      consecutiveOutsideSamples: 2,
      outsideSampleThreshold: 2
    });
  });
});
