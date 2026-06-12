import { z } from "zod";
import { branchStatuses, gymStatuses } from "@/types/enterprise";

const optionalUuid = z.string().uuid().or(z.literal("")).optional();
const stepUpEmail = z.string().trim().email("Enter the critical Super Admin email.");

export const superAdminGymSchema = z.object({
  gymId: optionalUuid,
  organizationId: z.string().uuid("Select an organization."),
  name: z.string().trim().min(2, "Gym name is required.").max(140),
  slug: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(2).max(80),
  currency: z.string().trim().length(3, "Use a 3-letter currency code."),
  status: z.enum(gymStatuses),
  reason: z.string().trim().max(500).optional()
}).superRefine((value, context) => {
  if (value.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) {
    context.addIssue({ code: "custom", message: "Use lowercase letters, numbers, and hyphens only.", path: ["slug"] });
  }
});

export const superAdminBranchSchema = z.object({
  branchId: optionalUuid,
  organizationId: z.string().uuid("Select an organization."),
  gymId: optionalUuid,
  name: z.string().trim().min(2, "Branch name is required.").max(140),
  slug: z.string().trim().max(80).optional(),
  branchCode: z.string().trim().min(2).max(32),
  status: z.enum(branchStatuses),
  timezone: z.string().trim().min(2).max(80),
  currency: z.string().trim().length(3, "Use a 3-letter currency code."),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(24).optional(),
  phone: z.string().trim().max(24).optional(),
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")).optional(),
  capacity: z.coerce.number().int().min(0).max(100000),
  reason: z.string().trim().max(500).optional()
}).superRefine((value, context) => {
  if (value.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) {
    context.addIssue({ code: "custom", message: "Use lowercase letters, numbers, and hyphens only.", path: ["slug"] });
  }
});

export const gymAdminTransferSchema = z.object({
  gymId: z.string().uuid(),
  newAdminUserId: z.string().uuid("Select the new gym admin."),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().min(5, "Reason is required for audit.").max(500)
});

export const locationLifecycleSchema = z.object({
  entityType: z.enum(["gym", "branch"]),
  entityId: z.string().uuid(),
  nextStatus: z.string().trim(),
  confirmation: z.string().trim(),
  stepUpEmail: stepUpEmail.optional().or(z.literal("")),
  reason: z.string().trim().min(5, "Reason is required for audit.").max(500)
});

export const branchCapacityHoursSchema = z.object({
  branchId: z.string().uuid(),
  capacity: z.coerce.number().int().min(0).max(100000),
  timezone: z.string().trim().min(2).max(80),
  currency: z.string().trim().length(3),
  reason: z.string().trim().min(5, "Reason is required for audit.").max(500)
});

export const gymMoveSchema = z.object({
  gymId: z.string().uuid(),
  targetOrganizationId: z.string().uuid("Select target organization."),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().min(5, "Reason is required for audit.").max(500)
});

export const branchMoveSchema = z.object({
  branchId: z.string().uuid(),
  targetGymId: optionalUuid,
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().min(5, "Reason is required for audit.").max(500)
});

export const reviewGymBranchApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  stepUpEmail,
  reviewNote: z.string().trim().max(500).optional()
});

export type SuperAdminGymInput = z.infer<typeof superAdminGymSchema>;
export type SuperAdminBranchInput = z.infer<typeof superAdminBranchSchema>;
export type GymAdminTransferInput = z.infer<typeof gymAdminTransferSchema>;
export type LocationLifecycleInput = z.infer<typeof locationLifecycleSchema>;
export type BranchCapacityHoursInput = z.infer<typeof branchCapacityHoursSchema>;
export type GymMoveInput = z.infer<typeof gymMoveSchema>;
export type BranchMoveInput = z.infer<typeof branchMoveSchema>;
export type ReviewGymBranchApprovalInput = z.infer<typeof reviewGymBranchApprovalSchema>;
