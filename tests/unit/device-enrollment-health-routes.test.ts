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

function createDeviceClient({
  deviceRow,
  updatedRow,
  healthLogs = [],
}: {
  deviceRow: Record<string, unknown>;
  updatedRow?: Record<string, unknown>;
  healthLogs?: Record<string, unknown>[];
}) {
  const attendanceDevices = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: deviceRow, error: null }),
    single: vi.fn().mockResolvedValue({ data: deviceRow, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis()
  };

  if (updatedRow) {
    attendanceDevices.update.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: updatedRow, error: null })
        })
      })
    });
  } else {
    attendanceDevices.update.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    });
  }

  attendanceDevices.insert.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: deviceRow, error: null })
  });

  const deviceEventLogs = {
    insert: vi.fn().mockReturnThis()
  };

  const deviceHealthLogs = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: healthLogs, error: null }),
    insert: vi.fn().mockReturnThis()
  };

  const deviceHealthIncidents = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };

  const deviceTypes = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "type-1" }, error: null })
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "attendance_devices") return attendanceDevices;
      if (table === "device_event_logs") return deviceEventLogs;
      if (table === "device_health_logs") return deviceHealthLogs;
      if (table === "device_health_incidents") return deviceHealthIncidents;
      if (table === "device_types") return deviceTypes;
      throw new Error(`Unexpected table ${table}`);
    }),
    attendanceDevices,
    deviceEventLogs,
    deviceHealthLogs,
    deviceHealthIncidents,
  };
}

describe("device enrollment and health routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns enrollment state for an existing device", async () => {
    mockAuth();
    const client = createDeviceClient({
      deviceRow: {
        id: "device-1",
        gym_id: "gym-1",
        branch_id: "branch-1",
        status: "pending",
        is_active: false,
        last_seen_at: null,
        metadata: {
          enrollment: {
            state: "pending",
            issued_at: "2026-07-06T10:00:00.000Z",
            expires_at: "2026-07-06T10:30:00.000Z",
            branch_id: "branch-1",
          }
        }
      }
    });
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(client)
    }));

    const { GET } = await import("@/app/api/attendance/devices/[id]/enrollment/route");
    const response = await GET(new Request("http://localhost/api/attendance/devices/device-1/enrollment") as never, {
      params: Promise.resolve({ id: "device-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        device_id: "device-1",
        enrollment: {
          state: "pending",
          branch_id: "branch-1"
        }
      }
    });
  });

  it("issues a pending enrollment claim", async () => {
    mockAuth();
    vi.doMock("@/lib/security/device-auth", () => ({
      generateDeviceEnrollmentCode: vi.fn().mockReturnValue({ plaintext: "claim-code", hash: "claim-hash" })
    }));
    const client = createDeviceClient({
      deviceRow: {
        id: "device-1",
        gym_id: "gym-1",
        branch_id: "branch-1",
        metadata: null
      }
    });
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(client)
    }));

    const { POST } = await import("@/app/api/attendance/devices/[id]/enrollment/route");
    const response = await POST(new Request("http://localhost/api/attendance/devices/device-1/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validMinutes: 45, branchId: "branch-1" })
    }) as never, {
      params: Promise.resolve({ id: "device-1" })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        claim_code: "claim-code",
        status: "pending"
      }
    });
    expect(client.attendanceDevices.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "pending",
      is_active: false,
      api_key: null,
    }));
  });

  it("activates a device when the claim code matches", async () => {
    vi.doMock("@/lib/security/device-auth", () => ({
      generateDeviceApiKey: vi.fn().mockReturnValue({ plaintext: "api-key", hash: "hashed-api-key" }),
      hashDeviceApiKey: vi.fn().mockReturnValue("claim-hash"),
    }));
    const client = createDeviceClient({
      deviceRow: {
        id: "device-1",
        gym_id: "gym-1",
        organization_id: "org-1",
        branch_id: "branch-1",
        status: "pending",
        is_active: false,
        metadata: {
          enrollment: {
            state: "pending",
            claim_code_hash: "claim-hash",
            expires_at: "2099-07-06T11:00:00.000Z",
            branch_id: "branch-1",
          }
        }
      }
    });
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(client)
    }));
    vi.doMock("@/lib/audit", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

    const { POST } = await import("@/app/api/attendance/devices/[id]/enrollment/claim/route");
    const response = await POST(new Request("http://localhost/api/attendance/devices/device-1/enrollment/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_code: "claim-code" })
    }) as never, {
      params: Promise.resolve({ id: "device-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        api_key: "api-key",
        status: "online"
      }
    });
    expect(client.attendanceDevices.update).toHaveBeenCalledWith(expect.objectContaining({
      api_key: "hashed-api-key",
      is_active: true,
      status: "online",
    }));
  });

  it("loads health samples and supports quarantine actions", async () => {
    mockAuth();
    const client = createDeviceClient({
      deviceRow: {
        id: "device-1",
        gym_id: "gym-1",
        branch_id: "branch-1",
        status: "online",
        is_active: true,
        last_seen_at: "2026-07-06T09:55:00.000Z",
        metadata: {
          health: {
            acknowledged_at: "2026-07-06T10:00:00.000Z"
          }
        }
      },
      healthLogs: [
        { id: "log-1", status: "healthy", checked_at: "2026-07-06T10:00:00.000Z", battery_level: 91, signal_strength: 77 }
      ]
    });
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(client)
    }));

    const { GET, PATCH } = await import("@/app/api/attendance/devices/[id]/health/route");
    const getResponse = await GET(new Request("http://localhost/api/attendance/devices/device-1/health") as never, {
      params: Promise.resolve({ id: "device-1" })
    });
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        device: expect.objectContaining({ id: "device-1" }),
        health_logs: [{ id: "log-1" }]
      }
    });

    const patchResponse = await PATCH(new Request("http://localhost/api/attendance/devices/device-1/health", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quarantine", note: "malfunction" })
    }) as never, {
      params: Promise.resolve({ id: "device-1" })
    });
    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        status: "quarantined"
      }
    });
  });
});
