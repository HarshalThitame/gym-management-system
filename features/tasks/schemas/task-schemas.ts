import { z } from "zod";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export const TaskSchema = z.object({
  taskId: optionalUuid,
  title: z.string().trim().min(2, "Title required.").max(300),
  description: z.string().trim().max(1500).optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  type: z.enum(["follow_up", "renewal", "payment", "appointment", "general"]),
  dueDate: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1500).optional().or(z.literal(""))
});

export const CompleteTaskSchema = z.object({
  taskId: z.string().uuid(),
  notes: z.string().trim().max(1500).optional().or(z.literal(""))
});

export type TaskInput = z.infer<typeof TaskSchema>;
