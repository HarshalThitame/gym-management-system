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

  it("records a geofence report and auto-checks out when outside the fence", async () => {
    mockAuth();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "session-1", status: "inside", check_in_at: "2026-07-05T09:00:00.000Z" },
                error: null,
              }),
              update: vi.fn().mockReturnThis(),
            };
          }
          if (table === "attendance_location_events") return { insert: vi.fn().mockReturnThis() };
          if (table === "attendance_logs") return { insert: vi.fn().mockReturnThis() };
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

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        geofenceEnabled: true,
        insideGeofence: false,
        branchId: "branch-1",
      },
    });
  });
});
