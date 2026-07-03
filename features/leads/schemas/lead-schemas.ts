import { z } from "zod";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export const LeadSchema = z.object({
  leadId: optionalUuid,
  name: z.string().trim().min(2, "Name is required.").max(200),
  phone: z.string().trim().min(7, "Valid phone required.").max(20),
  email: z.string().email("Valid email required.").max(255).optional().or(z.literal("")),
  source: z.enum(["walk_in", "website", "phone", "referral", "social_media", "event", "advertisement", "other"]),
  interest: z.string().trim().max(300).optional().or(z.literal("")),
  message: z.string().trim().max(1500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  preferredTrialAt: z.string().optional().or(z.literal("")),
  consentMarketing: z.coerce.boolean().default(false)
});

export const UpdateLeadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["new", "contacted", "visit_scheduled", "trial_active", "converted", "not_interested", "lost"]),
  notes: z.string().trim().max(1500).optional().or(z.literal(""))
});

export const ConvertLeadSchema = z.object({
  leadId: z.string().uuid(),
  memberName: z.string().trim().min(2, "Member name required.").max(200),
  phone: z.string().trim().min(7, "Valid phone required.").max(20)
});

export type LeadInput = z.infer<typeof LeadSchema>;
