import { beforeEach, describe, expect, it, vi } from "vitest";

function mockAuth() {
  vi.doMock("@/lib/auth/api-guards", () => ({
    requireApiPermission: vi.fn().mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
      tenant: { resolved: true }
    }),
    getApiTenantOrganizationId: vi.fn().mockReturnValue("org-1"),
    requireApiTenantGymScope: vi.fn().mockReturnValue({ ok: true, gymId: "gym-1" })
  }));
  vi.doMock("@/lib/audit", () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined)
  }));
}

function createDeviceClient() {
  const deviceRow = {
    id: "device-1",
    device_name: "Front Desk Reader",
    device_type_id: "type-1",
    organization_id: "org-1",
    gym_id: "gym-1",
    branch_id: "branch-1",
    status: "offline",
    is_active: true,
    last_seen_at: null,
    api_key: "hashed-key"
  };

  const attendanceDevices = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: deviceRow, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: deviceRow, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis()
  };

  const deviceTypes = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "type-1" }, error: null })
  };

  const logInsert = {
    insert: vi.fn().mockReturnThis()
  };

  const healthInsert = {
    insert: vi.fn().mockReturnThis()
  };

  const updateResult = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        ...deviceRow,
        device_name: "Updated Reader",
        branch_id: "branch-2"
      },
      error: null
    })
  };

  attendanceDevices.insert.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        ...deviceRow,
        id: "device-created",
        api_key: "plain-key"
      },
      error: null
    })
  });

  attendanceDevices.update.mockReturnValue({
    eq: vi.fn().mockReturnValue(updateResult)
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "attendance_devices") return attendanceDevices;
      if (table === "device_types") return deviceTypes;
      if (table === "device_event_logs") return logInsert;
      if (table === "device_health_logs") return healthInsert;
      throw new Error(`Unexpected table ${table}`);
    })
  };
}

describe("device lifecycle routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registers a device with a branch assignment and returns the plaintext api key", async () => {
    mockAuth();
    vi.doMock("@/lib/security/device-auth", () => ({
      generateDeviceApiKey: vi.fn().mockReturnValue({ plaintext: "plain-key", hash: "hashed-key" })
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(createDeviceClient())
    }));

    const { POST } = await import("@/app/api/attendance/devices/route");
    const response = await POST(
      new Request("http://localhost/api/attendance/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_name: "Front Desk Reader",
          device_type_id: "type-1",
          branch_id: "branch-1",
          location: "Main Desk"
        })
      }) as never
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        device_name: "Front Desk Reader",
        branch_id: "branch-1",
        api_key: "plain-key"
      }
    });
  });

  it("registers a device in pending enrollment mode and returns the enrollment code", async () => {
    mockAuth();
    vi.doMock("@/lib/security/device-auth", () => ({
      generateDeviceApiKey: vi.fn().mockReturnValue({ plaintext: "plain-key", hash: "hashed-key" }),
      generateDeviceEnrollmentCode: vi.fn().mockReturnValue({ plaintext: "claim-code", hash: "claim-hash" })
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(createDeviceClient())
    }));

    const { POST } = await import("@/app/api/attendance/devices/route");
    const response = await POST(
      new Request("http://localhost/api/attendance/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_name: "Front Desk Reader",
          device_type_id: "type-1",
          branch_id: "branch-1",
          provision_mode: "pending",
        })
      }) as never
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        device_name: "Front Desk Reader",
        branch_id: "branch-1",
        enrollment_code: "claim-code"
      }
    });
  });

  it("updates a device branch and regenerates its api key", async () => {
    mockAuth();
    vi.doMock("@/lib/security/device-auth", () => ({
      generateDeviceApiKey: vi.fn().mockReturnValue({ plaintext: "rotated-key", hash: "rotated-hash" })
    }));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "attendance_devices") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "device-1", device_name: "Front Desk Reader", device_type_id: "type-1" },
                error: null
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "device-1",
                      device_name: "Updated Reader",
                      branch_id: "branch-2",
                      api_key: "rotated-hash"
                    },
                    error: null
                  })
                })
              })
            };
          }
          if (table === "device_event_logs") return { insert: vi.fn().mockReturnThis() };
          throw new Error(`Unexpected table ${table}`);
        })
      })
    }));

    const { PATCH } = await import("@/app/api/attendance/devices/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/attendance/devices/device-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: "branch-2",
          regenerate_api_key: true
        })
      }) as never,
      { params: Promise.resolve({ id: "device-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        branch_id: "branch-2",
        api_key: "rotated-key"
      }
    });
  });

  it("records a ping heartbeat for the device", async () => {
    vi.doMock("@/lib/security/device-auth", () => ({
      authenticateDeviceRequest: vi.fn().mockResolvedValue({
        ok: true,
        device: { id: "device-1", gym_id: "gym-1", branch_id: "branch-1" }
      })
    }));
    const updateSpy = vi.fn().mockReturnThis();
    const insert = vi.fn().mockReturnThis();
    const healthInsert = vi.fn().mockReturnThis();
    const incidents = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis()
    };
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "attendance_devices") {
            return {
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "device-1", status: "offline", last_seen_at: null, metadata: null },
                error: null
              }),
              update: updateSpy,
              eq: vi.fn().mockReturnThis()
            };
          }
          if (table === "device_event_logs") return { insert };
          if (table === "device_health_logs") return { insert: healthInsert };
          if (table === "device_health_incidents") return incidents;
          throw new Error(`Unexpected table ${table}`);
        })
      })
    }));

    const { POST } = await import("@/app/api/attendance/devices/[id]/ping/route");
    const response = await POST(
      new Request("http://localhost/api/attendance/devices/device-1/ping", { method: "POST" }) as never,
      { params: Promise.resolve({ id: "device-1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "online" }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: "ping" }));
    expect(healthInsert).toHaveBeenCalledWith(expect.objectContaining({ device_id: "device-1" }));
  });
});
