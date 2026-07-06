import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiRoleMock = vi.hoisted(() => vi.fn());
const checkRateLimitWithEnvMock = vi.hoisted(() => vi.fn());
const getRoleAccessPreviewMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guards", () => ({
  requireApiRole: requireApiRoleMock,
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimitWithEnv: checkRateLimitWithEnvMock,
}));

vi.mock("@/features/super-admin/services/role-access-preview-service", () => ({
  getRoleAccessPreview: getRoleAccessPreviewMock,
}));

describe("/api/super-admin/roles/[roleId]/preview", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiRoleMock.mockResolvedValue({ ok: true });
    checkRateLimitWithEnvMock.mockReturnValue({ allowed: true });
    getRoleAccessPreviewMock.mockResolvedValue({
      role: { id: "11111111-1111-4111-8111-111111111111", name: "front_desk", displayName: "Front Desk", isSystem: false },
      summary: {
        currentResourceCount: 1,
        proposedResourceCount: 2,
        currentActionCount: 2,
        proposedActionCount: 3,
        addedResourceCount: 1,
        removedResourceCount: 0,
        addedActionCount: 1,
        removedActionCount: 0,
      },
      matrix: [],
      warnings: [],
    });
  });

  it("returns an effective access preview", async () => {
    const { POST } = await import("@/app/api/super-admin/roles/[roleId]/preview/route");
    const response = await POST(
      new Request("http://localhost/api/super-admin/roles/11111111-1111-4111-8111-111111111111/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: [{ resource: "attendance", actions: ["read"] }] }),
      }) as never,
      { params: Promise.resolve({ roleId: "11111111-1111-4111-8111-111111111111" }) } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: { id: "11111111-1111-4111-8111-111111111111", name: "front_desk" },
      summary: { proposedResourceCount: 2 },
    });
    expect(getRoleAccessPreviewMock).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", [{ resource: "attendance", actions: ["read"] }]);
  });
});
