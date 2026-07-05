import { beforeEach, describe, expect, it, vi } from "vitest";

function mockAuth() {
  vi.doMock("@/lib/auth/api-guards", () => ({
    requireApiPermission: vi.fn().mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
      tenant: { resolved: true },
    }),
    requireApiTenantGymScope: vi.fn().mockReturnValue({ ok: true, gymId: "gym-1" }),
  }));
  vi.doMock("@/lib/audit", () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
  }));
}

function createGetMockClient() {
  const deviceQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "device-1", device_name: "Front Desk Reader", gym_id: "gym-1", organization_id: "org-1", branch_id: "branch-1" },
      error: null,
    }),
  };

  const mappingsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    in: vi.fn().mockReturnThis(),
  };

  mappingsQuery.select.mockReturnValue(mappingsQuery);
  mappingsQuery.eq.mockReturnValue(mappingsQuery);
  mappingsQuery.order.mockReturnValue(mappingsQuery);
  mappingsQuery.in.mockReturnValue(mappingsQuery);

  const memberQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: [
        { id: "member-1", full_name: "Asha Patel", member_code: "M-001", phone: "9999999999", email: "asha@example.com" },
      ],
      error: null,
    }),
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "attendance_devices") return deviceQuery;
      if (table === "member_device_mappings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "mapping-1",
                    member_id: "member-1",
                    device_id: "device-1",
                    gym_id: "gym-1",
                    device_user_id: "RFID-001",
                    device_user_name: "Main Card",
                    is_active: true,
                    created_at: "2026-07-05T10:00:00.000Z",
                    updated_at: "2026-07-05T10:00:00.000Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "members") return memberQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createPostMockClient() {
  const deviceQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "device-1", device_name: "Front Desk Reader", gym_id: "gym-1", organization_id: "org-1", branch_id: "branch-1" },
      error: null,
    }),
  };

  const memberQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "member-1", full_name: "Asha Patel", member_code: "M-001", gym_id: "gym-1" },
      error: null,
    }),
  };

  const existingMemberMappingQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const existingUserMappingQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const saveQuery = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "mapping-1",
        member_id: "member-1",
        device_id: "device-1",
        gym_id: "gym-1",
        device_user_id: "RFID-001",
        device_user_name: "Main Card",
        is_active: true,
        created_at: "2026-07-05T10:00:00.000Z",
        updated_at: "2026-07-05T10:00:00.000Z",
      },
      error: null,
    }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  };

  const logInsert = {
    insert: vi.fn().mockReturnThis(),
  };

  let mappingCall = 0;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "attendance_devices") return deviceQuery;
      if (table === "members") return memberQuery;
      if (table === "member_device_mappings") {
        mappingCall += 1;
        if (mappingCall === 1) return existingMemberMappingQuery;
        if (mappingCall === 2) return existingUserMappingQuery;
        return saveQuery;
      }
      if (table === "device_event_logs") return logInsert;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("device mapping routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("lists device member mappings", async () => {
    mockAuth();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(createGetMockClient()),
    }));

    const { GET } = await import("@/app/api/attendance/devices/[id]/mappings/route");
    const response = await GET(new Request("http://localhost/api/attendance/devices/device-1/mappings") as never, { params: Promise.resolve({ id: "device-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: [
        {
          id: "mapping-1",
          device_user_id: "RFID-001",
          member: { full_name: "Asha Patel" },
        },
      ],
    });
  });

  it("creates a new mapping for a member and device user id", async () => {
    mockAuth();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(createPostMockClient()),
    }));

    const { POST } = await import("@/app/api/attendance/devices/[id]/mappings/route");
    const response = await POST(
      new Request("http://localhost/api/attendance/devices/device-1/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: "member-1",
          deviceUserId: "RFID-001",
          deviceUserName: "Main Card",
        }),
      }) as never,
      { params: Promise.resolve({ id: "device-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        id: "mapping-1",
        member_id: "member-1",
        device_user_id: "RFID-001",
      },
    });
  });
});
