import { z } from "zod";

export const SupportTicketSchema = z.object({
  ticketId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  customerName: z.string().trim().min(1).max(100),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().trim().max(20).optional().or(z.literal("")),
  customerType: z.string().trim().max(50).optional().or(z.literal("")),
  priority: z.string().trim().max(50).optional().or(z.literal("")),
  status: z.string().trim().max(50).optional().or(z.literal("")),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
  assignedTeam: z.string().trim().max(100).optional().or(z.literal(""))
});

export const TicketMessageSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  isInternal: z.coerce.boolean().optional()
});

export type SupportTicketInput = z.infer<typeof SupportTicketSchema>;
export type TicketMessageInput = z.infer<typeof TicketMessageSchema>;
