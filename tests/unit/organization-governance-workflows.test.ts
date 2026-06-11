import { describe, expect, it } from "vitest";
import {
  organizationLegalHoldActionSchema,
  organizationLifecycleActionSchema,
  reviewOrganizationApprovalSchema
} from "@/features/super-admin/schemas/organization-schemas";

const organizationId = "11111111-1111-4111-8111-111111111111";
const approvalId = "22222222-2222-4222-8222-222222222222";

describe("organization governance workflow contracts", () => {
  it("accepts permanent purge lifecycle requests as a controlled workflow", () => {
    const parsed = organizationLifecycleActionSchema.safeParse({
      organizationId,
      action: "purge",
      confirmation: "PURGE:apex-fitness",
      stepUpEmail: "hthitame@gmail.com",
      reason: "Retention period complete."
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts legal hold apply and release requests", () => {
    expect(organizationLegalHoldActionSchema.safeParse({
      organizationId,
      action: "hold",
      confirmation: "HOLD",
      stepUpEmail: "hthitame@gmail.com",
      reason: "Litigation hold."
    }).success).toBe(true);

    expect(organizationLegalHoldActionSchema.safeParse({
      organizationId,
      action: "release",
      confirmation: "RELEASE",
      stepUpEmail: "hthitame@gmail.com",
      reason: "Case closed."
    }).success).toBe(true);
  });

  it("keeps maker-checker review decisions constrained", () => {
    expect(reviewOrganizationApprovalSchema.safeParse({
      approvalId,
      decision: "approve",
      confirmation: "APPROVE",
      stepUpEmail: "hthitame@gmail.com",
      reviewNote: "Reviewed evidence."
    }).success).toBe(true);

    expect(reviewOrganizationApprovalSchema.safeParse({
      approvalId,
      decision: "self_approve",
      confirmation: "APPROVE",
      stepUpEmail: "hthitame@gmail.com"
    }).success).toBe(false);
  });
});
