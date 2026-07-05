import { beforeEach, describe, expect, it, vi } from "vitest";

function mockAuth(branchId = "branch-1") {
  vi.doMock("@/lib/security/device-auth", () => ({
    authenticateDeviceRequest: vi.fn().mockResolvedValue({
      ok: true,
      device: {
        id: "device-1",
        gym_id: "gym-1",
        organization_id: "org-1",
        branch_id: branchId,
        device_name: "Front Desk Reader",
      },
    }),
  }));
}

function mockAttendanceGuards() {
  vi.doMock("@/lib/audit", () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
  }));
}

function createCheckInClient({ memberBranchId, activeSessions }: { memberBranchId: string | null; activeSessions: Array<Record<string, unknown>>; }) {
  const attendanceDevices = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };

  const members = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "member-1", branch_id: memberBranchId, full_name: "Asha Patel", member_code: "M-001" },
      error: null,
    }),
  };

  const memberships = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: "membership-1",
        member_id: "member-1",
        status: "active",
        payment_status: "paid",
        end_date: "2026-12-31",
      },
      error: null,
    }),
  };

  const attendanceSessions = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: activeSessions, error: null }),
    insert: vi.fn().mockReturnThis(),
  };

  const deviceLogs = { insert: vi.fn().mockReturnThis() };
  const attendanceLogs = { insert: vi.fn().mockReturnThis() };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "attendance_devices") return attendanceDevices;
      if (table === "members") return members;
      if (table === "memberships") return memberships;
      if (table === "attendance_sessions") return attendanceSessions;
      if (table === "device_event_logs") return deviceLogs;
      if (table === "attendance_logs") return attendanceLogs;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createCheckOutClient({ activeSessions }: { activeSessions: Array<Record<string, unknown>>; }) {
  const attendanceDevices = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };

  const sessionQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: activeSessions, error: null }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: activeSessions[0]?.id ?? "session-1",
        member_id: "member-1",
        check_in_at: "2026-07-05T09:00:00.000Z",
        branch_id: "branch-1",
      },
      error: null,
    }),
  };

  const memberMappings = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { member_id: "member-1" }, error: null }),
  };

  const deviceLogs = { insert: vi.fn().mockReturnThis() };
  const attendanceLogs = { insert: vi.fn().mockReturnThis() };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "attendance_devices") return attendanceDevices;
      if (table === "attendance_sessions") return sessionQuery;
      if (table === "member_device_mappings") return memberMappings;
      if (table === "device_event_logs") return deviceLogs;
      if (table === "attendance_logs") return attendanceLogs;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("device branch and conflict routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects kiosk check-in when the member belongs to a different branch", async () => {
    mockAuth("branch-1");
    mockAttendanceGuards();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(createCheckInClient({
        memberBranchId: "branch-2",
        activeSessions: [],
      })),
    }));

    const { POST } = await import("@/app/api/attendance/devices/check-in/route");
    const response = await POST(
      new Request("http://localhost/api/attendance/devices/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: "member-1" }),
      }) as never
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "BRANCH_SCOPE_DENIED",
      },
    });
  });

  it("rejects checkout when multiple active sessions exist for a member", async () => {
    mockAuth("branch-1");
    mockAttendanceGuards();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(createCheckOutClient({
        activeSessions: [
          { id: "session-1", branch_id: "branch-1", check_in_at: "2026-07-05T09:00:00.000Z" },
          { id: "session-2", branch_id: "branch-1", check_in_at: "2026-07-05T09:05:00.000Z" },
        ],
      })),
    }));

    const { POST } = await import("@/app/api/attendance/devices/check-out/route");
    const response = await POST(
      new Request("http://localhost/api/attendance/devices/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: "member-1" }),
      }) as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "DUPLICATE_SESSION_CONFLICT",
      },
    });
  });
});
