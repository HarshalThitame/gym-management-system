import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { requireGymFrontDeskScope } from "@/features/reception/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertFeature, isWithinBranchLimit, isWithinMemberLimit } from "@/lib/tenant";
import { createRazorpayOrder } from "@/features/billing/lib/razorpay";
import { generateAiText } from "@/features/ai/services/openai-service";
import { createRazorpayOrderForPayment } from "@/features/billing/services/payment-processing";
import { saveClassCategoryAction } from "@/features/classes/actions/class-actions";
import { saveBranchAction } from "@/features/enterprise/actions/enterprise-actions";
import { onboardMemberAction } from "@/features/memberships/actions/membership-actions";
import { assignTrainerAction } from "@/features/training/actions/training-actions";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext, RoleName } from "@/types/auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  })
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn()
}));

vi.mock("@/features/admin/lib/access", () => ({
  requireGymAdminScope: vi.fn()
}));

vi.mock("@/features/reception/lib/access", () => ({
  requireGymFrontDeskScope: vi.fn()
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

vi.mock("@/lib/tenant", () => ({
  assertFeature: vi.fn(),
  isWithinMemberLimit: vi.fn(),
  isWithinBranchLimit: vi.fn()
}));

vi.mock("@/features/billing/lib/razorpay", () => ({
  createRazorpayOrder: vi.fn(),
  createRazorpayRefund: vi.fn(),
  fetchRazorpayPayment: vi.fn(),
  getRazorpayKeyId: vi.fn(() => "rzp_test_key"),
  verifyRazorpayCheckoutSignature: vi.fn(() => true),
  verifyRazorpayWebhookSignature: vi.fn(() => true)
}));

const organizationId = "00000000-0000-4000-8000-000000000001";
const gymId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const trainerId = "00000000-0000-4000-8000-000000000004";
const memberId = "00000000-0000-4000-8000-000000000005";
const planId = "00000000-0000-4000-8000-000000000006";
const paymentId = "00000000-0000-4000-8000-000000000007";

const previousState: AuthActionState = { status: "idle", message: "" };

const assertFeatureMock = vi.mocked(assertFeature);
const isWithinMemberLimitMock = vi.mocked(isWithinMemberLimit);
const isWithinBranchLimitMock = vi.mocked(isWithinBranchLimit);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);
const getSupabaseAdminClientMock = vi.mocked(getSupabaseAdminClient);
const createRazorpayOrderMock = vi.mocked(createRazorpayOrder);
const requireGymAdminScopeMock = vi.mocked(requireGymAdminScope);
const requireGymFrontDeskScopeMock = vi.mocked(requireGymFrontDeskScope);
const requireRoleMock = vi.mocked(requireRole);

describe("service feature gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(revalidatePath).mockReturnValue(undefined);
    vi.mocked(writeAuditLog).mockResolvedValue(undefined);
    assertFeatureMock.mockResolvedValue(undefined);
    isWithinMemberLimitMock.mockResolvedValue(true);
    isWithinBranchLimitMock.mockResolvedValue(true);
    createSupabaseServerClientMock.mockResolvedValue(createMockSupabaseClient() as never);
    getSupabaseAdminClientMock.mockReturnValue(createMockSupabaseClient() as never);
    createRazorpayOrderMock.mockResolvedValue({
      ok: true,
      order: {
        id: "order_test",
        amount: 120000,
        currency: "INR",
        status: "created"
      }
    } as never);
    requireGymAdminScopeMock.mockResolvedValue(createScope(["gym_admin"]) as never);
    requireGymFrontDeskScopeMock.mockResolvedValue(createScope(["gym_admin"]) as never);
    requireRoleMock.mockResolvedValue(createScope(["organization_owner"]) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.skip("blocks biometric attendance when biometricAttendanceEnabled is false", () => {
    // No biometric attendance recording function exists in the current attendance service surface.
  });

  it.skip("allows biometric attendance when biometricAttendanceEnabled is true", () => {
    // No biometric attendance recording function exists in the current attendance service surface.
  });

  it.skip("blocks RFID attendance when rfidAttendanceEnabled is false", () => {
    // No RFID check-in function exists in the current attendance service surface.
  });

  it.skip("allows RFID attendance when rfidAttendanceEnabled is true", () => {
    // No RFID check-in function exists in the current attendance service surface.
  });

  it("blocks AI provider calls when aiEnabled is false", async () => {
    assertFeatureMock.mockRejectedValueOnce(new Error("Feature not available on your current plan."));

    await expect(generateAiText({
      featureKey: "coach",
      fallback: "fallback",
      prompt: "Create a workout",
      gymId,
      userId
    })).rejects.toThrow("Feature not available on your current plan");
  });

  it("allows AI flow to continue when aiEnabled is true", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "");

    const result = await generateAiText({
      featureKey: "coach",
      fallback: "fallback",
      prompt: "Create a workout",
      gymId,
      userId
    });

    expect(assertFeatureMock).toHaveBeenCalledWith(organizationId, "aiEnabled");
    expect(result.status).toBe("fallback");
  });

  it("blocks class scheduling actions when classSchedulingEnabled is false", async () => {
    assertFeatureMock.mockRejectedValueOnce(new Error("Feature not available on your current plan."));

    await expect(saveClassCategoryAction(previousState, classCategoryForm())).resolves.toMatchObject({
      status: "error",
      message: "Feature not available on your current plan."
    });
  });

  it("allows class scheduling actions when classSchedulingEnabled is true", async () => {
    await expect(saveClassCategoryAction(previousState, classCategoryForm())).resolves.toMatchObject({
      status: "success"
    });
    expect(assertFeatureMock).toHaveBeenCalledWith(organizationId, "classSchedulingEnabled");
  });

  it("blocks trainer assignment when trainerAssignmentEnabled is false", async () => {
    assertFeatureMock.mockRejectedValueOnce(new Error("Feature not available on your current plan."));

    await expect(assignTrainerAction(previousState, trainerAssignmentForm())).resolves.toMatchObject({
      status: "error",
      message: "Feature not available on your current plan."
    });
  });

  it("allows trainer assignment when trainerAssignmentEnabled is true", async () => {
    await expect(assignTrainerAction(previousState, trainerAssignmentForm())).resolves.toMatchObject({
      status: "success"
    });
    expect(assertFeatureMock).toHaveBeenCalledWith(organizationId, "trainerAssignmentEnabled");
  });

  it("blocks Razorpay order creation when razorpayEnabled is false", async () => {
    assertFeatureMock.mockRejectedValueOnce(new Error("Feature not available on your current plan."));

    await expect(createRazorpayOrderForPayment(createScope(["gym_admin"]), paymentId)).resolves.toMatchObject({
      ok: false,
      status: 403,
      message: "Feature not available on your current plan."
    });
  });

  it("allows Razorpay order creation when razorpayEnabled is true", async () => {
    await expect(createRazorpayOrderForPayment(createScope(["gym_admin"]), paymentId)).resolves.toMatchObject({
      ok: true
    });
    expect(assertFeatureMock).toHaveBeenCalledWith(organizationId, "razorpayEnabled");
    expect(createRazorpayOrderMock).toHaveBeenCalled();
  });

  it("blocks member onboarding when the member limit is reached", async () => {
    isWithinMemberLimitMock.mockResolvedValueOnce(false);

    await expect(onboardMemberAction(previousState, memberOnboardingForm())).resolves.toMatchObject({
      status: "error",
      message: "Member limit reached for your current plan. Please upgrade to add more members."
    });
  });

  it("allows member onboarding to reach persistence when the member limit is available", async () => {
    await expect(onboardMemberAction(previousState, memberOnboardingForm())).rejects.toThrow("NEXT_REDIRECT:/admin/members/");
    expect(isWithinMemberLimitMock).toHaveBeenCalledWith(organizationId, 1);
  });

  it("blocks branch creation when the branch limit is reached", async () => {
    isWithinBranchLimitMock.mockResolvedValueOnce(false);

    await expect(saveBranchAction(previousState, branchForm())).resolves.toMatchObject({
      status: "error",
      message: "Branch limit reached for your current plan. Please upgrade to add more locations."
    });
  });

  it("allows branch creation when the branch limit is available", async () => {
    await expect(saveBranchAction(previousState, branchForm())).resolves.toMatchObject({
      status: "success"
    });
    expect(isWithinBranchLimitMock).toHaveBeenCalledWith(organizationId, 1);
  });
});

function createScope(roles: RoleName[]): AuthContext & {
  gymId: string;
  branchId: string | null;
  scopedOrganizationId: string;
  permissions: [];
} {
  return {
    isAuthenticated: true,
    isActive: true,
    userId,
    email: "qa@example.com",
    roles,
    primaryRole: roles[0] ?? null,
    organizationId,
    profile: {
      id: userId,
      gym_id: gymId,
      branch_id: null,
      full_name: "QA User",
      email: "qa@example.com",
      phone: "9876543210",
      avatar_url: null,
      status: "active",
      emergency_contact_name: null,
      emergency_contact_phone: null
    },
    gymId,
    branchId: null,
    scopedOrganizationId: organizationId,
    permissions: []
  };
}

function classCategoryForm() {
  const formData = new FormData();
  formData.set("name", "Strength");
  formData.set("description", "Strength category");
  formData.set("colorToken", "accent");
  formData.set("status", "active");
  formData.set("displayOrder", "1");
  return formData;
}

function trainerAssignmentForm() {
  const formData = new FormData();
  formData.set("trainerId", trainerId);
  formData.set("memberId", memberId);
  formData.set("assignmentType", "primary");
  formData.set("reason", "Initial assignment");
  return formData;
}

function memberOnboardingForm() {
  const formData = new FormData();
  formData.set("fullName", "QA Member");
  formData.set("email", "qa.member@example.com");
  formData.set("phone", "9876543210");
  formData.set("planId", planId);
  formData.set("startDate", "2026-06-11");
  formData.set("paymentStatus", "waived");
  formData.set("discountAmount", "0");
  return formData;
}

function branchForm() {
  const formData = new FormData();
  formData.set("organizationId", organizationId);
  formData.set("gymId", gymId);
  formData.set("name", "Bandra Branch");
  formData.set("slug", "bandra-branch");
  formData.set("branchCode", "BAN");
  formData.set("status", "active");
  formData.set("timezone", "Asia/Kolkata");
  formData.set("currency", "INR");
  formData.set("address", "Bandra");
  formData.set("city", "Mumbai");
  formData.set("state", "Maharashtra");
  formData.set("country", "India");
  formData.set("postalCode", "400050");
  formData.set("phone", "9876543210");
  formData.set("email", "bandra@example.com");
  formData.set("capacity", "100");
  formData.set("operatingHours", "{}");
  return formData;
}

function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => createQueryBuilder(table)),
    rpc: vi.fn().mockResolvedValue({ data: "MEM-001", error: null })
  };
}

function createQueryBuilder(table: string) {
  const builder: Record<string, unknown> = {
    data: selectDataForTable(table),
    error: null,
    count: countForTable(table),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: rowForTable(table), error: null }))
  };

  return builder;
}

function rowForTable(table: string) {
  if (table === "payments") {
    return {
      id: paymentId,
      payment_number: "PAY-001",
      gym_id: gymId,
      member_id: memberId,
      invoice_id: null,
      amount: 120000,
      currency: "INR",
      provider: "razorpay",
      method: "razorpay",
      status: "pending",
      provider_order_id: null,
      provider_payment_id: null,
      provider_signature: null,
      metadata: {}
    };
  }

  if (table === "gyms") {
    return { id: gymId, organization_id: organizationId };
  }

  if (table === "class_categories") {
    return { id: "class_category_1", gym_id: gymId };
  }

  if (table === "trainers") {
    return { id: trainerId, gym_id: gymId, user_id: userId };
  }

  if (table === "members") {
    return {
      id: memberId,
      gym_id: gymId,
      user_id: userId,
      member_code: "MEM-001",
      full_name: "QA Member",
      email: "qa.member@example.com",
      phone: "9876543210",
      status: "active"
    };
  }

  if (table === "trainer_assignments") {
    return { id: "assignment_1", gym_id: gymId };
  }

  if (table === "membership_plans") {
    return {
      id: planId,
      gym_id: gymId,
      name: "Monthly",
      status: "active",
      duration_days: 30,
      price_amount: 100000,
      joining_fee_amount: 0
    };
  }

  if (table === "memberships") {
    return {
      id: "membership_1",
      gym_id: gymId,
      member_id: memberId,
      start_date: "2026-06-11",
      end_date: "2026-07-11",
      price_amount: 100000,
      joining_fee_amount: 0,
      discount_amount: 0,
      payment_status: "waived",
      status: "active"
    };
  }

  if (table === "branches") {
    return { id: "branch_1", organization_id: organizationId, gym_id: gymId, name: "Bandra Branch" };
  }

  if (table === "invoices") {
    return { id: "invoice_1", invoice_number: "INV-001" };
  }

  return { id: `${table}_1`, gym_id: gymId, organization_id: organizationId };
}

function selectDataForTable(table: string) {
  if (table === "gyms") {
    return [{ id: gymId, organization_id: organizationId }];
  }

  return [rowForTable(table)];
}

function countForTable(table: string) {
  if (table === "members" || table === "branches") {
    return 1;
  }

  return null;
}
