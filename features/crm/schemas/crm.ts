import { z } from "zod";

export const LeadSchema = z.object({
  leadId: z.string().uuid().optional().or(z.literal("")),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().min(10).max(20).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  referralSource: z.string().optional().or(z.literal("")),
  interestedIn: z.string().optional().or(z.literal("")),
  budgetRange: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
  assignedTo: z.string().uuid().optional().or(z.literal(""))
});

export const LeadStatusSchema = z.object({
  statusId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(50),
  code: z.string().trim().min(1).max(50),
  sortOrder: z.coerce.number().int().min(0).max(100)
});

export const LeadSourceSchema = z.object({
  sourceId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(50),
  code: z.string().trim().min(1).max(50).optional().or(z.literal(""))
});

export const FollowupSchema = z.object({
  leadId: z.string().uuid(),
  notes: z.string().trim().min(1).max(1000),
  followUpDate: z.string().optional().or(z.literal(""))
});

export const ConvertLeadSchema = z.object({
  leadId: z.string().uuid(),
  planId: z.string().uuid()
});

export type LeadInput = z.infer<typeof LeadSchema>;
export type LeadStatusInput = z.infer<typeof LeadStatusSchema>;
export type LeadSourceInput = z.infer<typeof LeadSourceSchema>;
export type FollowupInput = z.infer<typeof FollowupSchema>;
export type ConvertLeadInput = z.infer<typeof ConvertLeadSchema>;
