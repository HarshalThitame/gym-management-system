import { describe, expect, it, vi } from "vitest";
import {
  assertAppointmentTransition,
  assertLeadTransition,
  assertTaskTransition,
  buildOperationalReference,
  isLikelyDuplicatePayment,
  isRecordInReceptionScope,
} from "@/features/reception/lib/operation-guards";

describe("reception operation guards", () => {
  it("matches records only within the assigned branch and organization scope", () => {
    const scope = {
      gymId: "gym-1",
      branchId: "branch-1",
      scopedOrganizationId: "org-1",
      organizationId: "org-1",
    };

    expect(isRecordInReceptionScope({
      id: "row-1",
      gym_id: "gym-1",
      branch_id: "branch-1",
      organization_id: "org-1",
    }, scope)).toBe(true);

    expect(isRecordInReceptionScope({
      id: "row-2",
      gym_id: "gym-1",
      branch_id: "branch-2",
      organization_id: "org-1",
    }, scope)).toBe(false);
  });

  it("builds collision-resistant operational references", () => {
    const reference = buildOperationalReference("PAY-FD", new Date("2026-07-03T10:11:12.000Z"), "ab12cd");
    expect(reference).toBe("PAY-FD-20260703101112-AB12CD");
  });

  it("blocks illegal appointment transitions from terminal statuses", () => {
    expect(() => assertAppointmentTransition("completed", "scheduled")).toThrow(/cannot move/i);
    expect(() => assertAppointmentTransition("confirmed", "completed")).not.toThrow();
  });

  it("blocks illegal task transitions", () => {
    expect(() => assertTaskTransition("completed", "in_progress")).toThrow(/cannot move/i);
    expect(() => assertTaskTransition("pending", "in_progress")).not.toThrow();
  });

  it("requires the dedicated lead conversion workflow", () => {
    expect(() => assertLeadTransition("trial_active", "converted")).toThrow(/conversion workflow/i);
    expect(() => assertLeadTransition("contacted", "visit_scheduled")).not.toThrow();
  });

  it("detects likely duplicate payment submissions within the duplicate window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T10:15:00.000Z"));

    expect(isLikelyDuplicatePayment({
      amount: 49900,
      method: "cash",
      paymentType: "membership",
      memberId: "member-1",
      membershipId: "membership-1",
      createdAt: "2026-07-03T10:14:10.000Z",
      createdBy: "user-1",
    }, {
      amount: 49900,
      method: "cash",
      paymentType: "membership",
      memberId: "member-1",
      membershipId: "membership-1",
      createdBy: "user-1",
    })).toBe(true);

    expect(isLikelyDuplicatePayment({
      amount: 49900,
      method: "cash",
      paymentType: "membership",
      memberId: "member-1",
      membershipId: "membership-1",
      createdAt: "2026-07-03T10:05:00.000Z",
      createdBy: "user-1",
    }, {
      amount: 49900,
      method: "cash",
      paymentType: "membership",
      memberId: "member-1",
      membershipId: "membership-1",
      createdBy: "user-1",
    })).toBe(false);

    vi.useRealTimers();
  });
});
