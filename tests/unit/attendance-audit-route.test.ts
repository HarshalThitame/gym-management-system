import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiRoleMock = vi.hoisted(() => vi.fn());
const checkRateLimitWithEnvMock = vi.hoisted(() => vi.fn());
const searchAttendanceAuditDrilldownMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guards", () => ({
  requireApiRole: requireApiRoleMock,
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimitWithEnv: checkRateLimitWithEnvMock,
}));

vi.mock("@/features/security/services/attendance-audit-service", () => ({
  searchAttendanceAuditDrilldown: searchAttendanceAuditDrilldownMock,
}));

describe("/api/super-admin/security/audit/attendance", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiRoleMock.mockResolvedValue({ ok: true });
    checkRateLimitWithEnvMock.mockReturnValue({ allowed: true });
    searchAttendanceAuditDrilldownMock.mockResolvedValue({
      entries: [
        {
          id: "audit-1",
          action: "attendance.checked_in",
          actorId: "user-1",
          actorName: "Asha",
          actorEmail: "asha@example.com",
          entityType: "attendance_session",
          entityId: "session-1",
          branchId: "branch-1",
          createdAt: "2026-07-07T10:00:00.000Z",
          module: "attendance",
          workflow: "check_in",
          reasonCode: "qr_scan",
          decision: "allowed",
          source: "qr",
          severity: "info",
          metadata: { module: "attendance" },
        },
      ],
      total: 1,
      totalPages: 1,
      summary: {
        totalAttendanceEvents: 1,
        byWorkflow: [{ workflow: "check_in", count: 1 }],
        byReasonCode: [{ reasonCode: "qr_scan", count: 1 }],
        byDecision: [{ decision: "allowed", count: 1 }],
      },
    });
  });

  it("returns attendance audit drilldown rows", async () => {
    const { GET } = await import("@/app/api/super-admin/security/audit/attendance/route");
    const response = await GET(new Request("http://localhost/api/super-admin/security/audit/attendance?page=1&pageSize=25") as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 1,
      summary: {
        totalAttendanceEvents: 1,
        byWorkflow: [{ workflow: "check_in", count: 1 }],
      },
    });
    expect(searchAttendanceAuditDrilldownMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 25 }));
  });
});
