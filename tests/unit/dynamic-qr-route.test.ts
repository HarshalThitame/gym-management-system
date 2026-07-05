import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/attendance/dynamic-qr", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a rotating QR for the signed-in member", async () => {
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
      issueDynamicAttendanceQr: vi.fn().mockResolvedValue({
        memberId: "member-1",
        qrCode: "<svg>dynamic</svg>",
        qrPayload: "https://example.com",
        expiresAt: "2026-07-05T12:00:12.000Z",
        refreshAfterSeconds: 10,
        qrToken: { token_value: "dynamic-token" },
      }),
    }));

    const { POST } = await import("@/app/api/attendance/dynamic-qr/route");
    const response = await POST(new Request("http://localhost/api/attendance/dynamic-qr", {
      method: "POST",
      body: JSON.stringify({ memberId: "member-1" }),
      headers: { "Content-Type": "application/json" },
    }) as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        memberId: "member-1",
        qrCode: "<svg>dynamic</svg>",
        refreshAfterSeconds: 10,
      },
    });
  });
});

describe("/api/v1/qr/dynamic/[memberId]", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a rotating QR for staff tools", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, {
          apiKey: { id: "key-1", organization_id: "org-1" },
        } as never),
    }));

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      issueDynamicAttendanceQr: vi.fn().mockResolvedValue({
        memberId: "member-1",
        qrCode: "<svg>dynamic</svg>",
        qrPayload: "https://example.com",
        expiresAt: "2026-07-05T12:00:12.000Z",
        refreshAfterSeconds: 10,
        qrToken: { token_value: "dynamic-token" },
      }),
    }));

    const { POST } = await import("@/app/api/v1/qr/dynamic/[memberId]/route");
    const response = await POST(new Request("http://localhost/api/v1/qr/dynamic/member-1?gymId=gym-1", {
      method: "POST",
    }) as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      qrCode: "<svg>dynamic</svg>",
      refreshAfterSeconds: 10,
    });
  });
});
