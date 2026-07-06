import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/analytics/geofence", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns geofence monitoring analytics for the requested scope", async () => {
    const getGeofenceMonitoringAnalyticsV1 = vi.fn().mockResolvedValue({
      totals: {
        branchesMonitored: 1,
        branchesConfigured: 1,
        branchesMissingCoordinates: 0,
        branchesDisabled: 0,
        activeTrackedSessions: 1,
        staleTrackedSessions: 0,
        recentExits: 1,
        recentAutoCheckouts: 1
      },
      branches: [],
      recentEvents: [],
      staleSessions: []
    });

    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: unknown) => handler
    }));
    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"])
    }));
    vi.doMock("@/features/attendance/lib/geofence-monitoring", () => ({
      getGeofenceMonitoringAnalyticsV1
    }));

    const { GET } = await import("@/app/api/v1/analytics/geofence/route");
    const response = await GET(
      new Request("http://localhost/api/v1/analytics/geofence?gymId=gym-1&branchId=branch-1&hours=12&staleMinutes=45") as never,
      { apiKey: { organization_id: "org-1" } } as never
    );

    expect(response.status).toBe(200);
    expect(getGeofenceMonitoringAnalyticsV1).toHaveBeenCalledWith({
      gymIds: ["gym-1"],
      gymId: "gym-1",
      branchId: "branch-1",
      hours: 12,
      staleMinutes: 45
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        totals: {
          branchesMonitored: 1,
          recentExits: 1
        }
      }
    });
  });
});
