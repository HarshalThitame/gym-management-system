import { z } from "zod";
import { roleNames } from "@/types/auth";

const optionalUuid = z.string().uuid().or(z.literal("")).optional();
const stepUpEmail = z.string().trim().email("Enter the critical Super Admin email for step-up confirmation.");

export const userManagementFiltersSchema = z.object({
  query: z.string().trim().max(120).optional(),
  role: z.enum([...roleNames, "all"] as const).optional(),
  status: z.enum(["active", "invited", "suspended", "archived", "all"] as const).optional(),
  organizationId: z.string().uuid().or(z.literal("all")).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(5).max(100).optional()
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  fullName: z.string().trim().min(2, "Full name is required.").max(140),
  role: z.enum(roleNames, { message: "Select a valid role." }),
  organizationId: z.string().uuid("Select an organization."),
  gymId: optionalUuid,
  branchId: optionalUuid,
  phone: z.string().trim().max(24).optional(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["activate", "suspend", "archive"]),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const forceLogoutUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const resetUserPasswordSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email(),
  confirmation: z.string().trim(),
  stepUpEmail,
  isTemporary: z.union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")]).optional().default(false),
  temporaryPassword: z.string().trim().min(8, "Temporary password must be at least 8 characters.").max(72).optional(),
  reason: z.string().trim().max(500).optional()
}).refine((data) => !data.isTemporary || data.temporaryPassword, {
  message: "Temporary password is required when setting a temporary password.",
  path: ["temporaryPassword"]
});

export const transferUserRoleSchema = z.object({
  userId: z.string().uuid(),
  targetRole: z.enum(roleNames, { message: "Select a valid target role." }),
  targetOrganizationId: z.string().uuid("Select an organization."),
  targetBranchId: z.string().uuid("Select a branch."),
  targetGymId: optionalUuid,
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "Select at least one user.").max(100, "Bulk actions are limited to 100 users."),
  action: z.enum(["suspend", "activate", "archive", "force_logout"]),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const updateUserProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(140).optional(),
  phone: z.string().trim().max(24).optional(),
  stepUpEmail: stepUpEmail.optional()
});

export const resendInviteSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const revokeInviteSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().trim(),
  stepUpEmail,
  kind: z.enum(["soft_delete", "permanent_purge"]).optional().default("soft_delete"),
  reason: z.string().trim().max(500).optional()
});

export const accountNoteSchema = z.object({
  userId: z.string().uuid(),
  content: z.string().trim().min(1, "Note content is required.").max(2000)
});

export const createOrgOwnerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  fullName: z.string().trim().min(2, "Full name is required.").max(140),
  password: z.string().trim().min(8, "Password must be at least 8 characters.").max(72),
  phone: z.string().trim().max(24).optional(),
  orgName: z.string().trim().min(2, "Organization name is required.").max(140),
  orgSlug: z.string().trim().min(2, "Slug is required.").max(60).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens."),
  orgDescription: z.string().trim().max(500).optional(),
  timezone: z.string().trim().optional().default("Asia/Kolkata"),
  currency: z.string().trim().optional().default("INR"),
  packageTier: z.enum(["starter", "growth", "enterprise"]),
  trialDays: z.coerce.number().int().min(0).max(365).optional().default(14),
  billingPeriod: z.enum(["monthly", "annual"]).optional().default("monthly"),
  confirmation: z.string().trim(),
  stepUpEmail,
  reason: z.string().trim().max(500).optional()
});

export type UserManagementFiltersInput = z.infer<typeof userManagementFiltersSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ForceLogoutUserInput = z.infer<typeof forceLogoutUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type TransferUserRoleInput = z.infer<typeof transferUserRoleSchema>;
export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type ResendInviteInput = z.infer<typeof resendInviteSchema>;
export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type AccountNoteInput = z.infer<typeof accountNoteSchema>;
export type CreateOrgOwnerInput = z.infer<typeof createOrgOwnerSchema>;
