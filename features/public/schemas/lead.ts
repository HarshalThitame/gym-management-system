import { z } from "zod";

export const LeadTypeSchema = z.enum(["free_trial", "membership_inquiry", "contact"]);

export const LeadSchema = z.object({
  type: LeadTypeSchema,
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().min(8, "Enter a valid phone number").max(20),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  interest: z.string().trim().max(80).optional(),
  preferredDate: z.string().trim().optional().or(z.literal("")),
  message: z.string().trim().min(8, "Tell us a little about your goal").max(800),
  consent: z.boolean().refine((value) => value, "Consent is required")
});

export type LeadInput = z.infer<typeof LeadSchema>;
