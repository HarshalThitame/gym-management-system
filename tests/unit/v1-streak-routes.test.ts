import { beforeEach, describe, expect, it, vi } from "vitest";

describe("phase1 v1 member and streak routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an empty search response for too-short queries", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));
    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn(),
      searchMembersV1: vi.fn(),
    }));

    const { GET } = await import("@/app/api/v1/members/search/route");
    const response = await GET(new Request("http://localhost/api/v1/members/search?q=a") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ members: [] });
  });

  it("returns roadmap-compatible streak data", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getMemberStreakV1: vi.fn().mockResolvedValue({
        memberId: "member-1",
        memberName: "Phase One Member",
        gymId: "gym-1",
        branchId: "branch-1",
        currentStreak: 8,
        maxStreak: 12,
        lastCheckinDate: "2026-07-05",
        daysUntilMilestone: 6,
        nextMilestone: 14,
        totalCheckins: 31,
        milestonesReached: [7],
        milestonesClaimed: [7],
        streakStartDate: "2026-06-28",
        isBroken: false,
      }),
    }));

    const { GET } = await import("@/app/api/v1/members/[memberId]/streak/route");
    const response = await GET(new Request("http://localhost/api/v1/members/member-1/streak") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currentStreak: 8,
      maxStreak: 12,
      nextMilestone: 14,
      member: { id: "member-1", name: "Phase One Member" },
    });
  });

  it("returns leaderboard rows in the expected roadmap format", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    vi.doMock("@/features/attendance/lib/phase1-api", () => ({
      resolveGymScopeIds: vi.fn().mockResolvedValue(["gym-1"]),
      getStreakLeaderboardV1: vi.fn().mockResolvedValue([
        { rank: 1, memberId: "member-1", name: "Top One", currentStreak: 20, totalCheckins: 44 },
        { rank: 2, memberId: "member-2", name: "Top Two", currentStreak: 11, totalCheckins: 19 },
      ]),
    }));

    const { GET } = await import("@/app/api/v1/streaks/leaderboard/route");
    const response = await GET(new Request("http://localhost/api/v1/streaks/leaderboard?timeframe=month&limit=2") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { rank: 1, memberId: "member-1", name: "Top One", currentStreak: 20, totalCheckins: 44 },
      { rank: 2, memberId: "member-2", name: "Top Two", currentStreak: 11, totalCheckins: 19 },
    ]);
  });

  it("rejects invalid milestone claim payloads before service execution", async () => {
    vi.doMock("@/features/api/middleware/api-auth", () => ({
      withApiAuth: (handler: (request: Request, context: { apiKey: { id: string; organization_id: string } }) => Promise<Response>) =>
        (request: Request) => handler(request, { apiKey: { id: "key-1", organization_id: "org-1" } }),
    }));

    const { POST } = await import("@/app/api/v1/streaks/milestone-claim/[memberId]/route");
    const response = await POST(new Request("http://localhost/api/v1/streaks/milestone-claim/member-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneNumber: 0 }),
    }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "milestoneNumber must be a positive integer.",
    });
  });
});
