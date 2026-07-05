import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/pwa/sync", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("accepts kiosk attendance device check-in actions in the offline sync allowlist", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });

    vi.doMock("@/lib/auth/api-guards", () => ({
      requireApiAuth: vi.fn().mockResolvedValue({
        ok: true,
        context: { userId: "user-1", tenant: { organizationId: "org-1", branchId: "branch-1" } },
        tenant: { organizationId: "org-1", branchId: "branch-1" }
      }),
      getApiTenantOrganizationId: vi.fn().mockReturnValue("org-1"),
      getApiTenantBranchId: vi.fn().mockReturnValue("branch-1")
    }));

    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true })
    }));

    vi.doMock("@/lib/supabase/admin", () => ({
      getSupabaseAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert
        })
      })
    }));

    const { POST } = await import("@/app/api/pwa/sync/route");
    const response = await POST(
      new Request("http://localhost/api/pwa/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: [
            {
              id: "sync-kiosk-checkin-1",
              type: "attendance_check_in",
              endpoint: "/api/attendance/devices/check-in",
              method: "POST",
              payload: { member_id: "member-1", device_user_id: "card-1" },
              idempotencyKey: "sync-kiosk-checkin-key",
              createdAt: new Date().toISOString()
            }
          ]
        })
      }) as never
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "attendance_check_in",
          endpoint: "/api/attendance/devices/check-in",
          method: "POST",
          idempotency_key: "sync-kiosk-checkin-key"
        })
      ]),
      { onConflict: "user_id,idempotency_key" }
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      processedIds: ["sync-kiosk-checkin-1"],
      data: { stored: true, accepted: 1 }
    });
  });
});
