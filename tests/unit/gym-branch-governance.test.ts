import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  moveBranchToGymAction,
  moveGymToOrganizationAction,
  saveSuperAdminBranchAction,
  saveSuperAdminGymAction,
  transferGymAdminAction,
  updateLocationLifecycleAction
} from "@/features/super-admin/actions/gym-branch-actions";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => null) }))
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn()
}));

const previousState: AuthActionState = { status: "idle", message: "" };
const gymId = "11111111-1111-4111-8111-111111111111";
const branchId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

const requireRoleMock = vi.mocked(requireRole);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);

describe("super admin gym and branch governance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue(createSuperAdminContext() as never);
    createSupabaseServerClientMock.mockResolvedValue({} as never);
  });

  it("validates gym create and edit input before database writes", async () => {
    const result = await saveSuperAdminGymAction(previousState, new FormData());

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.organizationId).toBeDefined();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("validates branch create and edit input before database writes", async () => {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("name", "A");
    formData.set("branchCode", "");

    const result = await saveSuperAdminBranchAction(previousState, formData);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.name).toBeDefined();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("requires critical Super Admin step-up for gym admin transfer", async () => {
    const formData = new FormData();
    formData.set("gymId", gymId);
    formData.set("newAdminUserId", userId);
    formData.set("confirmation", "TRANSFER_ADMIN");
    formData.set("reason", "Admin changed by governance request.");

    const result = await transferGymAdminAction(previousState, formData);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.stepUpEmail).toBeDefined();
  });

  it("requires exact lifecycle confirmation before status changes", async () => {
    const formData = new FormData();
    formData.set("entityType", "gym");
    formData.set("entityId", gymId);
    formData.set("nextStatus", "archived");
    formData.set("confirmation", "ARCHIVE");
    formData.set("reason", "Retiring inactive location.");

    const result = await updateLocationLifecycleAction(previousState, formData);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.confirmation?.[0]).toContain("GYM:ARCHIVED");
  });

  it("requires critical Super Admin step-up for destructive lifecycle states", async () => {
    const formData = new FormData();
    formData.set("entityType", "branch");
    formData.set("entityId", branchId);
    formData.set("nextStatus", "suspended");
    formData.set("confirmation", "BRANCH:SUSPENDED");
    formData.set("reason", "Compliance issue under review.");

    const result = await updateLocationLifecycleAction(previousState, formData);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.stepUpEmail).toBeDefined();
  });

  it("requires critical Super Admin step-up for cross-organization gym moves", async () => {
    const formData = new FormData();
    formData.set("gymId", gymId);
    formData.set("targetOrganizationId", organizationId);
    formData.set("confirmation", "MOVE_GYM");
    formData.set("reason", "Corporate restructuring.");

    const result = await moveGymToOrganizationAction(previousState, formData);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.stepUpEmail).toBeDefined();
  });

  it("requires critical Super Admin step-up for branch move workflows", async () => {
    const formData = new FormData();
    formData.set("branchId", branchId);
    formData.set("targetGymId", gymId);
    formData.set("confirmation", "MOVE_BRANCH");
    formData.set("reason", "Branch hierarchy correction.");

    const result = await moveBranchToGymAction(previousState, formData);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.stepUpEmail).toBeDefined();
  });
});

function createSuperAdminContext(): AuthContext {
  return {
    userId,
    email: "hthitame@gmail.com",
    profile: {
      id: userId,
      gym_id: null,
      full_name: "Super Admin",
      email: "hthitame@gmail.com",
      phone: null,
      avatar_url: null,
      status: "active",
      emergency_contact_name: null,
      emergency_contact_phone: null
    },
    organizationId: null,
    roles: ["super_admin"],
    primaryRole: "super_admin",
    isAuthenticated: true,
    isActive: true
  };
}
