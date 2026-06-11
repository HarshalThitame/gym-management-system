import { z } from "zod";
import { subscriptionStatuses } from "../services/subscription-service";

export const subscriptionStatusSchema = z.enum(subscriptionStatuses);

const optionalIsoDateString = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.string().datetime().optional()
);

const optionalNotes = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(500).optional()
);

export const assignPackageSchema = z.object({
  organizationId: z.string().uuid(),
  packageId: z.string().uuid(),
  status: subscriptionStatusSchema.default("active"),
  expiresAt: optionalIsoDateString,
  trialEndsAt: optionalIsoDateString,
  notes: optionalNotes
});

export const updateStatusSchema = z.object({
  subscriptionId: z.string().uuid(),
  status: subscriptionStatusSchema
});
