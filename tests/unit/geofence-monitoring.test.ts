import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("geofence monitoring analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:00:00.000Z"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("summarizes branch geofence health and incidents", async () => {
    const activeSessions = [
      {
        id: "session-stale",
        member_id: "member-stale",
        branch_id: "branch-1",
        gym_id: "gym-1",
        check_in_at: "2026-07-06T10:50:00.000Z",
        members: { full_name: "Stale Member", member_code: "M-001" }
      },
      {
        id: "session-fresh",
        member_id: "member-fresh",
        branch_id: "branch-1",
        gym_id: "gym-1",
        check_in_at: "2026-07-06T11:50:00.000Z",
        members: { full_name: "Fresh Member", member_code: "M-002" }
      }
    ];

    const autoCheckoutSessions = [
      {
        id: "session-auto",
        member_id: "member-auto",
        branch_id: "branch-1",
        gym_id: "gym-1",
        check_in_at: "2026-07-06T11:00:00.000Z",
        check_out_at: "2026-07-06T11:58:00.000Z",
        check_out_source: "system",
        members: { full_name: "Auto Member", member_code: "M-003" }
      }
    ];

    const branches = [
      { id: "branch-1", name: "Main Branch", gym_id: "gym-1", latitude: 19.076, longitude: 72.8777 },
      { id: "branch-2", name: "Offsite Studio", gym_id: "gym-1", latitude: null, longitude: null }
    ];

    const members = [
      { id: "member-stale", full_name: "Stale Member", member_code: "M-001" },
      { id: "member-fresh", full_name: "Fresh Member", member_code: "M-002" },
      { id: "member-auto", full_name: "Auto Member", member_code: "M-003" }
    ];

    const locationEvents = [
      {
        id: "event-exit",
        member_id: "member-fresh",
        branch_id: "branch-1",
        attendance_session_id: "session-fresh",
        latitude: 19.08,
        longitude: 72.9,
        inside_geofence: false,
        geofence_radius_m: 150,
        occurred_at: "2026-07-06T11:55:00.000Z",
        metadata: { distanceMeters: 212 }
      }
    ];

    const branchSettings = [
      {
        branch_id: "branch-1",
        attendance_settings: { geo_fence_enabled: true, geo_fence_radius_m: 150 }
      }
    ];

    const fromCallCounts: Record<string, number> = {};
    const createQuery = (result: unknown) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        gte: () => chain,
        order: () => chain,
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
      };
      return chain;
    };

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          fromCallCounts[table] = (fromCallCounts[table] ?? 0) + 1;

          if (table === "branches") {
            return createQuery({ data: branches, error: null });
          }
          if (table === "branch_settings") {
            return createQuery({ data: branchSettings, error: null });
          }
          if (table === "attendance_sessions") {
            return fromCallCounts[table] === 1
              ? createQuery({ data: activeSessions, error: null })
              : createQuery({ data: autoCheckoutSessions, error: null });
          }
          if (table === "attendance_location_events") {
            return createQuery({ data: locationEvents, error: null });
          }
          if (table === "members") {
            return createQuery({ data: members, error: null });
          }

          throw new Error(`Unexpected table ${table}`);
        })
      })
    }));

    const { getGeofenceMonitoringAnalyticsV1 } = await import("@/features/attendance/lib/geofence-monitoring");
    const data = await getGeofenceMonitoringAnalyticsV1({
      gymIds: ["gym-1"],
      gymId: "gym-1",
      hours: 24,
      staleMinutes: 30
    });

    expect(data.totals).toMatchObject({
      branchesMonitored: 2,
      branchesConfigured: 1,
      branchesMissingCoordinates: 1,
      activeTrackedSessions: 2,
      staleTrackedSessions: 1,
      recentExits: 1,
      recentAutoCheckouts: 1
    });

    expect(data.branches.find((branch) => branch.branchId === "branch-1")).toMatchObject({
      status: "watch",
      activeSessions: 2,
      staleSessions: 1,
      recentExits: 1,
      recentAutoCheckouts: 1
    });

    expect(data.branches.find((branch) => branch.branchId === "branch-2")).toMatchObject({
      status: "critical",
      coordinatesConfigured: false
    });

    expect(data.recentEvents[0]).toMatchObject({
      type: "auto_checkout",
      memberName: "Auto Member"
    });
    expect(data.staleSessions[0]).toMatchObject({
      memberName: "Stale Member",
      minutesSinceLastLocation: 70
    });
  });
});
