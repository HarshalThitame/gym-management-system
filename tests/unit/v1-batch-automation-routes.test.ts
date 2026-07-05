import { beforeEach, describe, expect, it, vi } from "vitest";

describe("phase2 batch and automation routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("runs batch check-in for a scoped gym", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const batchCheckIn = vi.fn().mockResolvedValue({
      ok: true,
      checkedInCount: 2,
      failedCount: 0,
      results: [
        { memberId: "member-1", success: true, status: 201, message: "Member 1 checked in.", code: null, sessionId: "session-1", sessionType: "class", sessionName: "Morning Strength", durationMinutes: null },
        { memberId: "member-2", success: true, status: 201, message: "Member 2 checked in.", code: null, sessionId: "session-2", sessionType: "class", sessionName: "Morning Strength", durationMinutes: null },
      ],
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      batchCheckInMembersV1: batchCheckIn,
    }));

    const { POST } = await import("@/app/api/v1/attendance/batch-checkin/route");
    const response = await POST(new Request("http://localhost/api/v1/attendance/batch-checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gymId: "gym-1",
        sessionType: "class",
        sessionName: "Morning Strength",
        memberIds: ["member-1", "member-2"],
      }),
    }) as never);

    expect(response.status).toBe(201);
    expect(batchCheckIn).toHaveBeenCalledWith(expect.objectContaining({
      memberIds: ["member-1", "member-2"],
      sessionType: "class",
      sessionName: "Morning Strength",
      actor: expect.objectContaining({ gymId: "gym-1" }),
    }));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        checkedInCount: 2,
        failedCount: 0,
      },
    });
  });

  it("runs batch checkout for all active members in the gym", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const batchCheckOut = vi.fn().mockResolvedValue({
      ok: true,
      checkedOutCount: 1,
      failedCount: 0,
      results: [
        { memberId: "member-1", success: true, status: 200, message: "Member checked out.", code: null, sessionId: "session-1", sessionType: "class", sessionName: "Morning Strength", durationMinutes: 88 },
      ],
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      batchCheckOutMembersV1: batchCheckOut,
    }));

    const { POST } = await import("@/app/api/v1/attendance/batch-checkout/route");
    const response = await POST(new Request("http://localhost/api/v1/attendance/batch-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gymId: "gym-1",
        allInside: true,
        sessionType: "class",
        sessionName: "Morning Strength",
      }),
    }) as never);

    expect(response.status).toBe(200);
    expect(batchCheckOut).toHaveBeenCalledWith(expect.objectContaining({
      allInside: true,
      memberIds: [],
      actor: expect.objectContaining({ gymId: "gym-1" }),
    }));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        checkedOutCount: 1,
        failedCount: 0,
      },
    });
  });

  it("returns automation config with connected providers and scoped rules", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const getConfig = vi.fn().mockResolvedValue({
      smsEnabled: true,
      whatsappEnabled: false,
      smsConfigured: true,
      whatsappConfigured: false,
      rules: [
        {
          id: "rule-1",
          name: "Attendance streak alert",
          eventType: "attendance.alert",
          status: "active",
          priority: 100,
          runCount: 7,
          lastRunAt: "2026-07-05T08:00:00.000Z",
          alertType: "streak_alert",
        },
      ],
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getAttendanceAutomationConfigV1: getConfig,
    }));

    const { GET } = await import("@/app/api/v1/automation/config/route");
    const response = await GET(new Request("http://localhost/api/v1/automation/config?gymId=gym-1") as never);

    expect(response.status).toBe(200);
    expect(getConfig).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      gymIds: ["gym-1"],
      gymId: "gym-1",
    }));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        smsEnabled: true,
        rules: [{ alertType: "streak_alert" }],
      },
    });
  });

  it("sends attendance alerts over default channels when none are provided", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const sendAlert = vi.fn().mockResolvedValue({
      ok: true,
      memberId: "member-1",
      memberName: "Phase Two Member",
      alertType: "streak_alert",
      message: "Phase Two Member, your attendance streak is active.",
      channels: [
        { channel: "sms", success: true, message: "SMS sent." },
        { channel: "whatsapp", success: true, message: "WhatsApp sent." },
      ],
      automationRuleId: "rule-1",
    });

    const getConfig = vi.fn().mockResolvedValue({
      smsEnabled: true,
      whatsappEnabled: true,
      smsConfigured: true,
      whatsappConfigured: true,
      rules: [],
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      sendAttendanceAlertV1: sendAlert,
      getAttendanceAutomationConfigV1: getConfig,
    }));

    const { POST } = await import("@/app/api/v1/automation/send-alert/route");
    const response = await POST(new Request("http://localhost/api/v1/automation/send-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gymId: "gym-1",
        memberId: "member-1",
        alertType: "streak_alert",
      }),
    }) as never);

    expect(response.status).toBe(201);
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({
      gymIds: ["gym-1"],
      channels: ["sms", "whatsapp"],
      memberId: "member-1",
      alertType: "streak_alert",
    }));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        automationRuleId: "rule-1",
        config: {
          smsEnabled: true,
          whatsappEnabled: true,
        },
      },
    });
  });

  it("returns occupancy analytics heatmap data", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const getOccupancy = vi.fn().mockResolvedValue({
      currentlyInside: 14,
      snapshots: [
        {
          id: "snap-1",
          timestamp: "2026-07-05T10:00:00.000Z",
          members_in_gym: 12,
          total_capacity: 40,
          occupancy_percent: 30,
          hour_of_day: 10,
          day_of_week: 0,
          branch_id: "branch-1",
        },
      ],
      heatmap: [
        { dayOfWeek: 0, hourOfDay: 10, avgMembersInGym: 12, avgOccupancyPercent: 30, samples: 1 },
      ],
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getAttendanceOccupancyAnalyticsV1: getOccupancy,
    }));

    const { GET } = await import("@/app/api/v1/analytics/occupancy/route");
    const response = await GET(new Request("http://localhost/api/v1/analytics/occupancy?gymId=gym-1&hours=24") as never);

    expect(response.status).toBe(200);
    expect(getOccupancy).toHaveBeenCalledWith(expect.objectContaining({
      gymIds: ["gym-1"],
      gymId: "gym-1",
      hours: 24,
    }));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        currentlyInside: 14,
        heatmap: [{ avgOccupancyPercent: 30 }],
      },
    });
  });
});
