import { z } from "zod";
import { aiContentDraftTypes, aiRecommendationStatuses } from "@/types/ai";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export const AiChatRequestSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  sessionId: optionalUuid
});

export const GenerateAiProfileSchema = z.object({
  userId: optionalUuid
});

export const GenerateWorkoutProgramSchema = z.object({
  level: z.enum(["beginner", "intermediate", "advanced"]),
  weeks: z.coerce.number().int().min(1).max(16)
});

export const GenerateNutritionGuidanceSchema = z.object({
  goal: z.string().trim().min(2).max(180)
});

export const AiContentDraftSchema = z.object({
  draftType: z.enum(aiContentDraftTypes),
  audience: z.string().trim().min(2).max(120),
  brief: z.string().trim().min(10).max(1500)
});

export const AiRecommendationReviewSchema = z.object({
  recommendationId: z.string().uuid(),
  status: z.enum(aiRecommendationStatuses),
  note: z.string().trim().max(500).optional().or(z.literal(""))
}).refine((value) => ["approved", "rejected", "applied", "archived"].includes(value.status), {
  message: "Choose a review status.",
  path: ["status"]
});

export type AiChatRequestInput = z.infer<typeof AiChatRequestSchema>;
export type AiContentDraftInput = z.infer<typeof AiContentDraftSchema>;
