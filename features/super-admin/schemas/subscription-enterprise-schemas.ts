import { z } from "zod";

export const upgradePlanSchema = z.object({
  subscriptionId: z.string().uuid(),
  newPackageId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const downgradePlanSchema = z.object({
  subscriptionId: z.string().uuid(),
  newPackageId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  cancelType: z.enum(["immediate", "end_of_period"]).default("immediate"),
  cancellationCategory: z.enum([
    "too_expensive", "missing_features", "poor_support", "not_using",
    "switching_competitor", "business_closed", "technical_issues", "other",
  ]).optional(),
  reason: z.string().trim().min(10, "Please provide at least 10 characters explaining the cancellation reason.").max(1000),
  dataRetentionDays: z.number().int().min(0).max(365).default(90),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
});

export const reactivateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional(),
});

export const extendTrialSchema = z.object({
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  newTrialEndDate: z.string().datetime("Must be a valid ISO date."),
  reason: z.string().trim().max(500).optional(),
});

export const convertTrialSchema = z.object({
  subscriptionId: z.string().uuid(),
  packageId: z.string().uuid(),
});

export const assignAddonSchema = z.object({
  subscriptionId: z.string().uuid(),
  addonId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export const removeAddonSchema = z.object({
  assignedAddonId: z.string().uuid(),
});

export const scheduleChangeSchema = z.object({
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  fromPackageId: z.string().uuid(),
  toPackageId: z.string().uuid(),
  changeType: z.enum(["upgrade", "downgrade", "crossgrade"]),
  effectiveDate: z.string().datetime("Must be a valid ISO date."),
  reason: z.string().trim().max(500).optional(),
});

export const cancelScheduledChangeSchema = z.object({
  changeId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const bulkUpdateSubscriptionStatusSchema = z.object({
  subscriptionIds: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["active", "suspended", "expired"]),
  reason: z.string().trim().max(500).optional(),
});

export const addonQuantitySchema = z.object({
  subscriptionId: z.string().uuid(),
  addonId: z.string().uuid(),
  quantity: z.number().int().min(0, "Quantity must be 0 or more."),
});

export type UpgradePlanInput = z.infer<typeof upgradePlanSchema>;
export type DowngradePlanInput = z.infer<typeof downgradePlanSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type ReactivateSubscriptionInput = z.infer<typeof reactivateSubscriptionSchema>;
export type ExtendTrialInput = z.infer<typeof extendTrialSchema>;
export type ConvertTrialInput = z.infer<typeof convertTrialSchema>;
export type AssignAddonInput = z.infer<typeof assignAddonSchema>;
export type ScheduleChangeInput = z.infer<typeof scheduleChangeSchema>;
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateSubscriptionStatusSchema>;

export const overridePriceSchema = z.object({
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  price: z.number().int().min(0),
  reason: z.string().trim().min(5, "Please provide a reason.").max(500),
});

export type OverridePriceInput = z.infer<typeof overridePriceSchema>;
