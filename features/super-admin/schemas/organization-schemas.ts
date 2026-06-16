import { z } from "zod";
import { organizationStatuses } from "@/types/enterprise";

const optionalUuid = z.string().uuid().or(z.literal("")).optional();

export const saveSuperAdminOrganizationSchema = z.object({
  organizationId: optionalUuid,
  name: z.string().trim().min(2, "Organization name is required.").max(140),
  slug: z.string().trim().max(80).optional(),
  status: z.enum(organizationStatuses),
  primaryDomain: z.string().trim().max(160).optional(),
  billingEmail: z.string().trim().email("Enter a valid billing email.").or(z.literal("")).optional(),
  ownerUserId: optionalUuid,
  legalName: z.string().trim().max(160).optional(),
  gstNumber: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(32).optional(),
  address: z.string().trim().max(360).optional(),
  supportNotes: z.string().trim().max(800).optional()
}).superRefine((value, context) => {
  if (value.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) {
    context.addIssue({
      code: "custom",
      message: "Use lowercase letters, numbers, and hyphens only.",
      path: ["slug"]
    });
  }
});

export const transferOrganizationOwnerSchema = z.object({
  organizationId: z.string().uuid(),
  newOwnerUserId: z.string().uuid("Select a new owner."),
  confirmation: z.string().trim(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
});

export const organizationLifecycleActionSchema = z.object({
  organizationId: z.string().uuid(),
  action: z.enum(["suspend", "activate", "delete", "restore", "purge"]),
  confirmation: z.string().trim(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
});

export const organizationLegalHoldActionSchema = z.object({
  organizationId: z.string().uuid(),
  action: z.enum(["hold", "release"]),
  confirmation: z.string().trim(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
});

export const bulkOrganizationActionSchema = z.object({
  organizationIds: z.array(z.string().uuid()).min(1, "Select at least one organization.").max(100, "Bulk actions are limited to 100 organizations."),
  action: z.enum(["suspend", "activate", "assign_package", "tag"]),
  packageId: optionalUuid,
  status: z.enum(["active", "trial", "expired", "suspended", "cancelled"]).optional(),
  tags: z.string().trim().max(240).optional(),
  confirmation: z.string().trim(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
}).superRefine((value, context) => {
  if (value.action === "assign_package" && !value.packageId) {
    context.addIssue({
      code: "custom",
      message: "Select a package for bulk assignment.",
      path: ["packageId"]
    });
  }

  if (value.action === "tag" && !value.tags?.trim()) {
    context.addIssue({
      code: "custom",
      message: "Enter at least one tag.",
      path: ["tags"]
    });
  }
});

export const reviewOrganizationApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "cancel"]),
  confirmation: z.string().trim(),
  reviewNote: z.string().trim().max(500).optional()
});

export type SaveSuperAdminOrganizationInput = z.infer<typeof saveSuperAdminOrganizationSchema>;
export type TransferOrganizationOwnerInput = z.infer<typeof transferOrganizationOwnerSchema>;
export type OrganizationLifecycleActionInput = z.infer<typeof organizationLifecycleActionSchema>;
export type OrganizationLegalHoldActionInput = z.infer<typeof organizationLegalHoldActionSchema>;
export type BulkOrganizationActionInput = z.infer<typeof bulkOrganizationActionSchema>;
export type ReviewOrganizationApprovalInput = z.infer<typeof reviewOrganizationApprovalSchema>;
