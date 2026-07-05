import { beforeEach, describe, expect, it, vi } from "vitest";

describe("phase1 attendance response normalizers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("maps check-in results to the roadmap-compatible payload", async () => {
    vi.doMock("@/lib/realtime/event-bus", () => ({
      publishAttendanceEvent: vi.fn(),
    }));

    const { normalizeV1CheckInResponse } = await import("@/features/attendance/lib/phase1-api");
    const payload = normalizeV1CheckInResponse({
      ok: true,
      session: {
        id: "session-1",
        check_in_at: "2026-07-05T10:00:00.000Z",
      },
      member: {
        id: "member-1",
        full_name: "Rutik Thitame",
        photo_url: "https://example.com/member.png",
      },
      membership: {
        membership_plan_id: "premium-plan",
      },
      streak: {
        current: 6,
        max: 12,
      },
    } as Parameters<typeof normalizeV1CheckInResponse>[0]);

    expect(payload).toEqual({
      success: true,
      message: "Rutik Thitame checked in.",
      memberData: {
        id: "member-1",
        name: "Rutik Thitame",
        photo: "https://example.com/member.png",
        membership_type: "premium-plan",
      },
      sessionId: "session-1",
      streakData: {
        current: 6,
        max: 12,
        daysToMilestone: 1,
      },
      timestamp: "2026-07-05T10:00:00.000Z",
    });
  });

  it("maps checkout results to the roadmap-compatible payload", async () => {
    vi.doMock("@/lib/realtime/event-bus", () => ({
      publishAttendanceEvent: vi.fn(),
    }));

    const { normalizeV1CheckOutResponse } = await import("@/features/attendance/lib/phase1-api");
    const payload = normalizeV1CheckOutResponse({
      ok: true,
      durationMinutes: 95,
      session: {
        check_in_at: "2026-07-05T10:00:00.000Z",
        check_out_at: "2026-07-05T11:35:00.000Z",
      },
    } as Parameters<typeof normalizeV1CheckOutResponse>[0]);

    expect(payload).toEqual({
      success: true,
      duration: 95,
      sessionData: {
        checkinTime: "2026-07-05T10:00:00.000Z",
        checkoutTime: "2026-07-05T11:35:00.000Z",
        durationMinutes: 95,
      },
      streakAchieved: null,
    });
  });
});

describe("/api/v1/attendance/checkin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects QR tokens from gyms outside the API key org scope", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string }; startTime: number }) => Promise<Response>) =>
        (request: Request) => handler(request, {
          apiKey: { id: "key-1", organization_id: "org-1" },
          startTime: 0,
        }),
    }));

    vi.doMock("@/features/attendance/lib/phase1-api", async () => {
      const actual = await vi.importActual<typeof import("@/features/attendance/lib/phase1-api")>("@/features/attendance/lib/phase1-api");
      return {
        ...actual,
        resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-a"]),
        validateAttendanceQrToken: vi.fn().mockResolvedValue({
          valid: true,
          memberId: "member-1",
          branchId: "branch-1",
          qrToken: { id: "qr-1", gym_id: "gym-b" },
        }),
      };
    });

    const { POST } = await import("@/app/api/v1/attendance/checkin/route");
    const response = await POST(new Request("http://localhost/api/v1/attendance/checkin", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token-1234567890123456" }),
      headers: { "Content-Type": "application/json" },
    }) as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "This QR belongs to another organization gym scope.",
    });
  });

  it("returns a created roadmap-compatible response for manual check-in", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string }; startTime: number }) => Promise<Response>) =>
        (request: Request) => handler(request, {
          apiKey: { id: "key-1", organization_id: "org-1" },
          startTime: 0,
        }),
    }));

    vi.doMock("@/features/attendance/lib/phase1-api", async () => {
      const actual = await vi.importActual<typeof import("@/features/attendance/lib/phase1-api")>("@/features/attendance/lib/phase1-api");
      return {
        ...actual,
        resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-a"]),
        checkInMember: vi.fn().mockResolvedValue({
          ok: true,
          session: { id: "session-1", check_in_at: "2026-07-05T12:00:00.000Z" },
          member: { id: "member-1", full_name: "Phase One Member", photo_url: null },
          membership: { membership_plan_id: "lite-plan" },
          streak: { current: 3, max: 5 },
        }),
      };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      }),
    }));

    const { POST } = await import("@/app/api/v1/attendance/checkin/route");
    const response = await POST(new Request("http://localhost/api/v1/attendance/checkin", {
      method: "POST",
      body: JSON.stringify({ memberId: "member-1" }),
      headers: { "Content-Type": "application/json" },
    }) as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      sessionId: "session-1",
      memberData: { id: "member-1", name: "Phase One Member" },
    });
  });
});
