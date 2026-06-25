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
  status: subscriptionStatusSchema,
  organizationId: z.string().uuid().optional(),
  stepUpEmail: z.string().email("Valid MFA step-up email required").optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters").optional()
}).refine(
  (data) => {
    if (data.status === "suspended") {
      return !!data.stepUpEmail && !!data.reason && data.reason.length >= 10;
    }
    return true;
  },
  { message: "MFA step-up email and reason (min 10 chars) required for suspension." }
);
