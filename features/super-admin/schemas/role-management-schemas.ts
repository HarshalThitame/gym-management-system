import { z } from "zod";
import { authResources, permissionActions } from "@/types/auth";

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Role name is required.").max(60).regex(/^[a-z_]+$/, "Use lowercase letters and underscores only."),
  displayName: z.string().trim().min(2, "Display name is required.").max(120),
  description: z.string().trim().max(500).optional()
});

export const updateRoleSchema = z.object({
  roleId: z.string().uuid(),
  displayName: z.string().trim().min(2, "Display name is required.").max(120),
  description: z.string().trim().max(500).optional()
});

export const deleteRoleSchema = z.object({
  roleId: z.string().uuid(),
  confirmation: z.string().trim(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
});

export const updateRolePermissionsSchema = z.object({
  roleId: z.string().uuid(),
  permissions: z.array(
    z.object({
      resource: z.enum(authResources),
      actions: z.array(z.enum(permissionActions))
    })
  )
});

export const assignUserRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
});

export const unassignUserRoleSchema = z.object({
  userRoleId: z.string().uuid(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional()
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type AssignUserRoleInput = z.infer<typeof assignUserRoleSchema>;
export type UnassignUserRoleInput = z.infer<typeof unassignUserRoleSchema>;
