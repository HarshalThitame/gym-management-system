import { z } from "zod";

export const EquipmentSchema = z.object({
  equipmentId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(100),
  equipmentType: z.string().trim().min(1).max(50),
  brand: z.string().trim().max(50).optional().or(z.literal("")),
  model: z.string().trim().max(50).optional().or(z.literal("")),
  serialNumber: z.string().trim().max(100).optional().or(z.literal("")),
  location: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.string().trim().max(50).optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  purchasePrice: z.coerce.number().min(0).optional().or(z.literal("")),
  warrantyExpiry: z.string().optional().or(z.literal("")),
  amcProvider: z.string().trim().max(100).optional().or(z.literal("")),
  amcExpiry: z.string().optional().or(z.literal("")),
  serviceIntervalDays: z.coerce.number().int().min(0).optional().or(z.literal("")),
  lastServiceDate: z.string().optional().or(z.literal("")),
  nextServiceDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export type EquipmentInput = z.infer<typeof EquipmentSchema>;
