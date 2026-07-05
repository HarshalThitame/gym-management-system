import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/attendance/self-checkin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("checks in the logged-in member through the member portal route", async () => {
    vi.doMock("@/lib/auth/api-guards", () => ({
      requireApiPrimaryRole: vi.fn().mockResolvedValue({
        ok: true,
        context: {
          userId: "user-1",
          organizationId: "org-1",
          primaryRole: "member",
          roles: ["member"],
          profile: { gym_id: "gym-1", branch_id: "branch-1" },
        },
        tenant: { resolved: false },
      }),
      getApiTenantGymId: vi.fn().mockReturnValue("gym-1"),
    }));

    const memberQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "member-1", gym_id: "gym-1", user_id: "user-1" },
        error: null,
      }),
    };

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "members") return memberQuery;
          throw new Error(`Unexpected table ${table}`);
        }),
      }),
    }));

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      checkInMember: vi.fn().mockResolvedValue({
        ok: true,
        session: {
          id: "session-1",
          check_in_at: "2026-07-05T13:00:00.000Z",
          status: "inside",
        },
      }),
    }));

    const { POST } = await import("@/app/api/attendance/self-checkin/route");
    const response = await POST(new Request("http://localhost/api/attendance/self-checkin", {
      method: "POST",
      body: JSON.stringify({ memberId: "member-1" }),
      headers: { "Content-Type": "application/json" },
    }) as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        sessionId: "session-1",
        status: "inside",
      },
    });
  });

  it("rejects self check-in when the member is outside the branch geofence", async () => {
    vi.doMock("@/lib/auth/api-guards", () => ({
      requireApiPrimaryRole: vi.fn().mockResolvedValue({
        ok: true,
        context: {
          userId: "user-1",
          organizationId: "org-1",
          primaryRole: "member",
          roles: ["member"],
          profile: { gym_id: "gym-1", branch_id: "branch-1" },
        },
        tenant: { resolved: false },
      }),
      getApiTenantGymId: vi.fn().mockReturnValue("gym-1"),
    }));

    const memberQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "member-1", gym_id: "gym-1", user_id: "user-1", branch_id: "branch-1" },
        error: null,
      }),
    };

    const branchQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "branch-1", name: "Main Branch", latitude: 19.076, longitude: 72.8777 },
        error: null,
      }),
    };

    const branchSettingsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { attendance_settings: { geo_fence_enabled: true, geo_fence_radius_m: 100 } },
        error: null,
      }),
    };

    const insert = vi.fn().mockReturnThis();

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "members") return memberQuery;
          if (table === "branches") return branchQuery;
          if (table === "branch_settings") return branchSettingsQuery;
          if (table === "attendance_location_events") return { insert };
          throw new Error(`Unexpected table ${table}`);
        }),
      }),
    }));

    const { POST } = await import("@/app/api/attendance/self-checkin/route");
    const response = await POST(new Request("http://localhost/api/attendance/self-checkin", {
      method: "POST",
      body: JSON.stringify({ memberId: "member-1", latitude: 19.5, longitude: 73.1, accuracyM: 15 }),
      headers: { "Content-Type": "application/json" },
    }) as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "GEOFENCE_DENIED",
      },
    });
    expect(insert).toHaveBeenCalled();
  });
});
