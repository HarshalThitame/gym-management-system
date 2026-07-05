import { beforeEach, describe, expect, it, vi } from "vitest";

function createRequest(url: string, init?: RequestInit) {
  return Object.assign(new Request(url, init), {
    nextUrl: new URL(url),
  }) as Request & { nextUrl: URL };
}

describe("phase2 v1 analytics routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns attendance analytics for the requested scope and date range", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const analytics = vi.fn().mockResolvedValue({
      totalMembers: 128,
      activeMembers: 92,
      inactiveMembers: 36,
      avgAttendanceRate: 72,
      trend: 11,
      totalCheckins: 245,
      avgSessionDuration: 74,
      peakHour: 18,
      peakHourCount: 31,
      range: { from: "2026-07-01T00:00:00.000Z", to: "2026-07-07T23:59:59.999Z" },
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getAttendanceAnalyticsV1: analytics,
    }));

    const { GET } = await import("@/app/api/v1/analytics/attendance/route");
    const response = await GET(createRequest("http://localhost/api/v1/analytics/attendance?gymId=gym-1&dateRange=2026-07-01,2026-07-07") as never);

    expect(response.status).toBe(200);
    expect(analytics).toHaveBeenCalledWith({
      gymIds: ["gym-1"],
      gymId: "gym-1",
      branchId: null,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        totalMembers: 128,
        activeMembers: 92,
        inactiveMembers: 36,
        avgAttendanceRate: 72,
        trend: 11,
        totalCheckins: 245,
        avgSessionDuration: 74,
        peakHour: 18,
        peakHourCount: 31,
        range: { from: "2026-07-01T00:00:00.000Z", to: "2026-07-07T23:59:59.999Z" },
      },
    });
  });

  it("clamps churn-risk queries to a bounded limit", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const churnRisk = vi.fn().mockResolvedValue([
      {
        memberId: "member-1",
        memberName: "High Risk Member",
        memberCode: "M-001",
        gymId: "gym-1",
        branchId: "branch-1",
        churnRiskScore: 88,
        averageSessionDuration: 42,
        checkinsThisWeek: 2,
        checkinsThisMonth: 8,
        attendanceTrend: -16,
        lastRiskAssessment: "2026-07-05T08:30:00.000Z",
        predictedCheckoutDate: "2026-07-12T00:00:00.000Z",
        engagementLevel: "At Risk",
        recommendation: "Trigger retention outreach",
      },
    ]);

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getChurnRiskAnalyticsV1: churnRisk,
    }));

    const { GET } = await import("@/app/api/v1/analytics/churn-risk/route");
    const response = await GET(createRequest("http://localhost/api/v1/analytics/churn-risk?gymId=gym-1&limit=200") as never);

    expect(response.status).toBe(200);
    expect(churnRisk).toHaveBeenCalledWith({
      gymIds: ["gym-1"],
      gymId: "gym-1",
      branchId: null,
      limit: 50,
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: [
        {
          memberId: "member-1",
          memberName: "High Risk Member",
          memberCode: "M-001",
          gymId: "gym-1",
          branchId: "branch-1",
          churnRiskScore: 88,
          averageSessionDuration: 42,
          checkinsThisWeek: 2,
          checkinsThisMonth: 8,
          attendanceTrend: -16,
          lastRiskAssessment: "2026-07-05T08:30:00.000Z",
          predictedCheckoutDate: "2026-07-12T00:00:00.000Z",
          engagementLevel: "At Risk",
          recommendation: "Trigger retention outreach",
        },
      ],
    });
  });

  it("returns member insights for a scoped member", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const memberInsights = vi.fn().mockResolvedValue({
      memberId: "member-1",
      memberName: "Phase Two Member",
      memberCode: "M-101",
      gymId: "gym-1",
      branchId: "branch-1",
      totalVisits: 34,
      totalDurationMinutes: 2480,
      averageSessionDuration: 73,
      preferredHours: [{ hour: 18, visits: 11 }],
      consistencyScore: 82,
      engagementLevel: "Active",
      churnRiskScore: 27,
      lastVisitAt: "2026-07-05T09:00:00.000Z",
      streak: { current: 6, max: 14 },
    });

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getMemberInsightsV1: memberInsights,
    }));

    const { GET } = await import("@/app/api/v1/analytics/member-insights/[memberId]/route");
    const response = await GET(createRequest("http://localhost/api/v1/analytics/member-insights/member-1?gymId=gym-1") as never);

    expect(response.status).toBe(200);
    expect(memberInsights).toHaveBeenCalledWith({
      gymIds: ["gym-1"],
      gymId: "gym-1",
      branchId: null,
      memberId: "member-1",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        memberId: "member-1",
        memberName: "Phase Two Member",
        memberCode: "M-101",
        gymId: "gym-1",
        branchId: "branch-1",
        totalVisits: 34,
        totalDurationMinutes: 2480,
        averageSessionDuration: 73,
        preferredHours: [{ hour: 18, visits: 11 }],
        consistencyScore: 82,
        engagementLevel: "Active",
        churnRiskScore: 27,
        lastVisitAt: "2026-07-05T09:00:00.000Z",
        streak: { current: 6, max: 14 },
      },
    });
  });
});
