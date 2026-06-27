import { describe, expect, it } from "vitest";
import type { MembershipPlanRow, MembershipRow } from "@/types/membership";
import { MembershipPlanSchema, MemberOnboardingSchema } from "@/features/memberships/schemas/membership";
import {
  calculateEndDate,
  classifyPlanChange,
  getExpiryBucket,
  validateMembershipDates,
  validateRenewalSource,
  validateStatusTransition
} from "@/features/memberships/lib/business-rules";

const baseMembership: MembershipRow = {
  id: "membership-1",
  gym_id: "gym-1",
  member_id: "member-1",
  branch_id: null,
  membership_plan_id: "plan-1",
  status: "active",
  start_date: "2026-06-01",
  end_date: "2026-06-30",
  activated_at: null,
  cancelled_at: null,
  frozen_at: null,
  suspended_at: null,
  renewal_of_membership_id: null,
  source: "manual",
  price_amount: 500000,
  joining_fee_amount: 0,
  discount_amount: 0,
  total_amount: 500000,
  invoice_number: "INV-1",
  payment_status: "paid",
  notes: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z"
};

const basePlan: MembershipPlanRow = {
  id: "plan-1",
  gym_id: "gym-1",
  branch_id: null,
  name: "Monthly",
  slug: "monthly",
  description: "Monthly access plan.",
  plan_type: "monthly",
  duration_days: 30,
  price_amount: 500000,
  joining_fee_amount: 0,
  currency: "INR",
  access_level: "standard",
  features: [],
  status: "active",
  is_public: true,
  display_order: 10,
  created_by: null,
  archived_at: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z"
};

describe("membership business rules", () => {
  it("calculates inclusive membership expiry dates", () => {
    expect(calculateEndDate("2026-06-01", 30)).toBe("2026-06-30");
  });

  it("rejects invalid date ranges", () => {
    expect(validateMembershipDates("2026-07-01", "2026-06-30")).toBe("Expiry date must be after the start date.");
    expect(validateMembershipDates("2026-06-01", "2026-06-30")).toBeNull();
  });

  it("prevents cancelled and suspended renewals", () => {
    expect(validateRenewalSource({ ...baseMembership, status: "cancelled" })).toContain("Cancelled");
    expect(validateRenewalSource({ ...baseMembership, status: "suspended" })).toContain("reactivation");
    expect(validateRenewalSource(baseMembership)).toBeNull();
  });

  it("enforces lifecycle transitions", () => {
    expect(validateStatusTransition("active", "frozen")).toBeNull();
    expect(validateStatusTransition("pending", "suspended")).toContain("Cannot move");
    expect(validateStatusTransition("cancelled", "active")).toContain("final");
  });

  it("classifies upgrades and downgrades by plan price", () => {
    expect(classifyPlanChange(basePlan, { ...basePlan, id: "plan-2", price_amount: 700000 })).toBe("upgraded");
    expect(classifyPlanChange(basePlan, { ...basePlan, id: "plan-3", price_amount: 300000 })).toBe("downgraded");
    expect(classifyPlanChange(basePlan, { ...basePlan, id: "plan-4" })).toBe("plan_changed");
  });

  it("detects expired buckets", () => {
    expect(getExpiryBucket("2020-01-01", "active")).toBe("expired");
    expect(getExpiryBucket("2020-01-01", "expired")).toBe("expired");
  });
});

describe("membership schemas", () => {
  it("transforms money input into smallest currency units", () => {
    const parsed = MembershipPlanSchema.parse({
      name: "Annual Elite",
      description: "Annual elite plan for committed members.",
      planType: "annual",
      durationDays: 365,
      priceAmount: "42000",
      joiningFeeAmount: "1500",
      accessLevel: "elite",
      status: "active",
      isPublic: true,
      displayOrder: 1
    });

    expect(parsed.priceAmount).toBe(4_200_000);
    expect(parsed.joiningFeeAmount).toBe(150_000);
  });

  it("requires a plan during member onboarding", () => {
    const parsed = MemberOnboardingSchema.safeParse({
      fullName: "Apex Member",
      phone: "9876543210",
      planId: "not-a-uuid",
      startDate: "2026-06-10",
      paymentStatus: "paid",
      discountAmount: "0"
    });

    expect(parsed.success).toBe(false);
  });
});
