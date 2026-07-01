import { z } from "zod";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export const BranchSchema = z.object({
  branchId: optionalUuid,
  name: z.string().trim().min(2).max(160),
  branchCode: z.string().trim().min(2).max(40),
  status: z.enum(["planned", "active", "maintenance", "suspended", "deactivated", "archived"]),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(50000),
  timezone: z.string().trim().min(2).max(80).optional().or(z.literal(""))
});

export const BranchSettingSchema = z.object({
  settingId: optionalUuid,
  branchId: z.string().uuid(),
  settingKey: z.string().trim().min(2).max(120),
  settingValue: z.string().trim().max(4000),
  scope: z.string().trim().max(80).optional().or(z.literal(""))
});

export const FeatureFlagSchema = z.object({
  flagId: optionalUuid,
  branchId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  flagKey: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  enabled: z.coerce.boolean(),
  status: z.enum(["active", "paused", "archived"]),
  rolloutPercentage: z.coerce.number().int().min(0).max(100)
});

export const TenantDomainSchema = z.object({
  domainId: optionalUuid,
  domain: z.string().trim().min(3).max(253),
  domainType: z.enum(["custom_domain", "subdomain", "system"]),
  routingMode: z.enum(["organization", "branch", "gym"]),
  isPrimary: z.coerce.boolean(),
  sslStatus: z.enum(["pending", "provisioning", "active", "failed", "disabled"]).optional()
});

export type BranchInput = z.infer<typeof BranchSchema>;
export type BranchSettingInput = z.infer<typeof BranchSettingSchema>;
export type FeatureFlagInput = z.infer<typeof FeatureFlagSchema>;
export type TenantDomainInput = z.infer<typeof TenantDomainSchema>;
