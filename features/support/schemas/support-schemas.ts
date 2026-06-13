import { z } from "zod";
import { ticketStatuses, ticketPriorities, ticketSources, ticketChannels, assignmentTypes, automationTriggerEvents, feedbackSurveyTypes, kbArticleTypes, kbStatuses, escalationTriggerTypes, escalationTriggerSources } from "@/types/enterprise";

export const TicketSchema = z.object({
  organizationId: z.string().uuid(),
  gymId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  customerType: z.enum(["member", "trainer", "staff", "owner", "lead", "other"]).optional(),
  membershipId: z.string().uuid().optional(),
  subject: z.string().min(1).max(500),
  description: z.string().min(1).max(10000),
  priority: z.enum(ticketPriorities).optional(),
  source: z.enum(ticketSources).optional(),
});

export const TicketUpdateSchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  subject: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(10000).optional(),
  slaPolicyId: z.string().uuid().optional().nullable(),
});

export const TicketNoteSchema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().default(true),
  mentions: z.array(z.string().uuid()).default([]),
});

export const TicketMessageSchema = z.object({
  channel: z.enum(ticketChannels),
  direction: z.enum(["inbound", "outbound"]),
  senderName: z.string().min(1).max(200),
  senderEmail: z.string().email().optional().or(z.literal("")),
  subject: z.string().max(500).optional(),
  body: z.string().min(1).max(50000),
  bodyHtml: z.string().optional(),
});

export const TicketAssignmentSchema = z.object({
  assignedTo: z.string().uuid(),
  assignmentType: z.enum(assignmentTypes),
});

export const TicketEscalationSchema = z.object({
  escalatedTo: z.string().uuid(),
  reason: z.string().min(1).max(2000),
  triggeredBy: z.enum(escalationTriggerSources),
});

export const SlaPolicySchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "medium", "high", "critical", "emergency"]),
  firstResponseMinutes: z.number().int().min(1).max(43200),
  resolutionMinutes: z.number().int().min(1).max(43200),
  escalationMinutes: z.number().int().optional(),
  reopenMinutes: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

export const EscalationRuleSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  triggerOn: z.enum(escalationTriggerTypes),
  priorityFrom: z.enum(["low", "medium", "high", "critical", "emergency"]).optional(),
  priorityTo: z.enum(["low", "medium", "high", "critical", "emergency"]).optional(),
  escalateAfterMinutes: z.number().int().min(1).optional(),
  escalateFromLevel: z.number().int().min(1).max(5),
  escalateToLevel: z.number().int().min(2).max(5),
  notifyRoles: z.array(z.string()).optional(),
});

export const KbArticleSchema = z.object({
  organizationId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(2).max(300),
  body: z.string().min(1),
  articleType: z.enum(kbArticleTypes).optional(),
  audience: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(kbStatuses).optional(),
});

export const AutomationRuleSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  triggerEvent: z.enum(automationTriggerEvents),
  conditions: z.record(z.string(), z.unknown()),
  actions: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(0).optional(),
});

export const CustomerFeedbackSchema = z.object({
  ticketId: z.string().uuid(),
  surveyType: z.enum(feedbackSurveyTypes),
  score: z.number().int().min(1).max(10),
  feedbackText: z.string().max(2000).optional(),
  improvementSuggestions: z.string().max(2000).optional(),
});
