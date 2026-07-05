import { beforeEach, describe, expect, it, vi } from "vitest";

function mockAdminClient(tokenRow: Record<string, unknown> | null, memberBranchId: string | null = null) {
  const tokenQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: tokenRow, error: null }),
    update: vi.fn().mockReturnThis(),
  };
  const memberQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: memberBranchId === null ? null : { branch_id: memberBranchId }, error: null }),
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "qr_tokens") return tokenQuery;
      if (table === "members") return memberQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("validateAttendanceQrToken", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns invalid when the token does not exist", async () => {
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(),
    }));
    vi.doMock("@/lib/realtime/event-bus", () => ({
      publishAttendanceEvent: vi.fn(),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(mockAdminClient(null)),
    }));

    const { validateAttendanceQrToken } = await import("@/features/attendance/lib/phase1-api");
    const result = await validateAttendanceQrToken("token-1", "gym-1");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid");
  });

  it("returns used for consumed dynamic tokens", async () => {
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(),
    }));
    vi.doMock("@/lib/realtime/event-bus", () => ({
      publishAttendanceEvent: vi.fn(),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(mockAdminClient({
        id: "qr-1",
        member_id: "member-1",
        gym_id: "gym-1",
        purpose: "attendance_dynamic",
        status: "used",
        expires_at: "2026-07-05T12:00:00.000Z",
      }, "branch-1")),
    }));

    const { validateAttendanceQrToken } = await import("@/features/attendance/lib/phase1-api");
    const result = await validateAttendanceQrToken("token-2", "gym-1");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("used");
  });

  it("returns wrong_gym when the token scope does not match", async () => {
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(),
    }));
    vi.doMock("@/lib/realtime/event-bus", () => ({
      publishAttendanceEvent: vi.fn(),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(mockAdminClient({
        id: "qr-1",
        member_id: "member-1",
        gym_id: "gym-2",
        purpose: "attendance_dynamic",
        status: "active",
        expires_at: "2026-07-05T12:00:00.000Z",
      }, "branch-1")),
    }));

    const { validateAttendanceQrToken } = await import("@/features/attendance/lib/phase1-api");
    const result = await validateAttendanceQrToken("token-3", "gym-1");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("wrong_gym");
  });

  it("returns expired and marks the token as expired", async () => {
    const update = vi.fn().mockReturnThis();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(),
    }));
    vi.doMock("@/lib/realtime/event-bus", () => ({
      publishAttendanceEvent: vi.fn(),
    }));
    const tokenQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "qr-1",
          member_id: "member-1",
          gym_id: "gym-1",
          purpose: "attendance_dynamic",
          status: "active",
          expires_at: "2020-01-01T00:00:00.000Z",
        },
        error: null,
      }),
      update,
    };
    const memberQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { branch_id: "branch-1" }, error: null }),
    };

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "qr_tokens") return tokenQuery;
          if (table === "members") return memberQuery;
          throw new Error(`Unexpected table ${table}`);
        }),
      }),
    }));

    const { validateAttendanceQrToken } = await import("@/features/attendance/lib/phase1-api");
    const result = await validateAttendanceQrToken("token-4", "gym-1");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
    expect(update).toHaveBeenCalledWith({ status: "expired" });
  });
});
