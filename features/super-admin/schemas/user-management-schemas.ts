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
  reason: z.string().trim().max(500).optional()
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
  reason: z.string().trim().max(500).optional()
});

export const accountNoteSchema = z.object({
  userId: z.string().uuid(),
  content: z.string().trim().min(1, "Note content is required.").max(2000)
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
