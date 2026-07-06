import { beforeEach, describe, expect, it, vi } from "vitest";

function mockAuth() {
  vi.doMock("@/lib/auth/api-guards", () => ({
    requireApiPermission: vi.fn().mockResolvedValue({
      ok: true,
      context: { userId: "user-1", organizationId: "org-1" },
      tenant: { resolved: true },
    }),
    requireApiTenantGymScope: vi.fn().mockReturnValue({ ok: true, gymId: "gym-1", branchId: "branch-1" }),
  }));
  vi.doMock("@/lib/audit", () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
  }));
}

describe("v1 geofence route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("treats the first outside sample as pending and waits for confirmation", async () => {
    mockAuth();
    const history: Array<Record<string, unknown>> = [];
    let sessionStatus: "inside" | "auto_closed" = "inside";
    let autoCheckoutCount = 0;

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "branch-1", name: "Main Branch", latitude: 19.076, longitude: 72.8777 },
                error: null,
              }),
            };
          }

          if (table === "members") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "member-1", full_name: "Asha Patel", branch_id: "branch-1", gym_id: "gym-1" },
                error: null,
              }),
            };
          }

          if (table === "branch_settings") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { attendance_settings: { geo_fence_enabled: true, geo_fence_radius_m: 100, geo_fence_outside_sample_threshold: 2 } },
                error: null,
              }),
            };
          }

          if (table === "attendance_sessions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue(
                sessionStatus === "inside"
                  ? {
                      data: { id: "session-1", status: "inside", check_in_at: "2026-07-05T09:00:00.000Z" },
                      error: null,
                    }
                  : { data: null, error: null }
              ),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation(async () => {
                  sessionStatus = "auto_closed";
                  autoCheckoutCount += 1;
                  return { data: null, error: null };
                }),
              }),
            };
          }

          if (table === "attendance_location_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: history.filter((event) => event.attendance_session_id === "session-1"),
                error: null,
              }),
              insert: vi.fn().mockImplementation(async (row) => {
                history.unshift(row as Record<string, unknown>);
                return { data: null, error: null };
              }),
            };
          }

          if (table === "attendance_logs") {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
      }),
    }));

    const { POST } = await import("@/app/api/v1/attendance/geofence/report/route");
    const pendingResponse = await POST(
      new Request("http://localhost/api/v1/attendance/geofence/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: "member-1",
          latitude: 19.0901,
          longitude: 72.9901,
          accuracyM: 12,
        }),
      }) as never
    );

    const pendingBody = await pendingResponse.text();
    expect(pendingResponse.status).toBe(200);
    expect(JSON.parse(pendingBody)).toMatchObject({
      ok: true,
      data: {
        geofenceEnabled: true,
        insideGeofence: false,
        autoCheckedOut: false,
        sessionActive: true,
        exitStatus: "outside_pending",
        reasonCode: "geo_fence_exit_pending",
        consecutiveOutsideSamples: 1,
        outsideSampleThreshold: 2,
      },
    });

    const confirmedResponse = await POST(
      new Request("http://localhost/api/v1/attendance/geofence/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: "member-1",
          latitude: 19.0901,
          longitude: 72.9901,
          accuracyM: 12,
        }),
      }) as never
    );

    const confirmedBody = await confirmedResponse.text();
    expect(confirmedResponse.status).toBe(200);
    expect(JSON.parse(confirmedBody)).toMatchObject({
      ok: true,
      data: {
        geofenceEnabled: true,
        insideGeofence: false,
        autoCheckedOut: true,
        sessionActive: false,
        exitStatus: "outside_confirmed",
        reasonCode: "geo_fence_exit_confirmed",
        consecutiveOutsideSamples: 2,
        outsideSampleThreshold: 2,
      },
    });

    expect(autoCheckoutCount).toBe(1);
    expect(history.filter((event) => event.attendance_session_id === "session-1")).toHaveLength(2);
    expect(history[0]).toMatchObject({
      attendance_session_id: "session-1",
      metadata: expect.objectContaining({ geofenceDecision: "outside_confirmed" }),
      inside_geofence: false,
    });
  });

  it("does not store a location report when no active session exists", async () => {
    mockAuth();
    const history: Array<Record<string, unknown>> = [];

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "branch-1", name: "Main Branch", latitude: 19.076, longitude: 72.8777 },
                error: null,
              }),
            };
          }

          if (table === "members") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "member-1", full_name: "Asha Patel", branch_id: "branch-1", gym_id: "gym-1" },
                error: null,
              }),
            };
          }
          if (table === "branch_settings") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { attendance_settings: { geo_fence_enabled: true, geo_fence_radius_m: 100 } },
                error: null,
              }),
            };
          }
          if (table === "attendance_sessions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === "attendance_location_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: history, error: null }),
              insert: vi.fn().mockImplementation(async (row) => {
                history.unshift(row as Record<string, unknown>);
                return { data: null, error: null };
              }),
            };
          }
          if (table === "attendance_logs") {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
      }),
    }));

    const { POST } = await import("@/app/api/v1/attendance/geofence/report/route");
    const response = await POST(
      new Request("http://localhost/api/v1/attendance/geofence/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: "member-1",
          latitude: 19.0901,
          longitude: 72.9901,
          accuracyM: 12,
        }),
      }) as never
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toMatchObject({
      ok: true,
      data: {
        sessionActive: false,
        autoCheckedOut: false,
        exitStatus: "no_active_session",
        reasonCode: "no_active_session",
      },
    });
    expect(history).toHaveLength(0);
  });
});
