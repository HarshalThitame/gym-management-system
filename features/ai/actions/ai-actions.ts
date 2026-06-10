"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import {
  AiContentDraftSchema,
  AiRecommendationReviewSchema,
  GenerateAiProfileSchema,
  GenerateNutritionGuidanceSchema,
  GenerateWorkoutProgramSchema
} from "../schemas/ai";
import {
  generateContentDraft,
  generateExecutiveInsightDraft,
  generateNutritionGuidance,
  generateWorkoutProgramDraft,
  saveLatestMemberAiProfile
} from "../services/ai-service";

const staffRoles = ["super_admin", "gym_admin"] as const;
const trainerRoles = ["super_admin", "gym_admin", "trainer"] as const;

export async function generateMyAiProfileAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["member", "super_admin"], "/member/ai-coach");
  const parsed = GenerateAiProfileSchema.safeParse({
    userId: formData.get("userId") ?? context.userId ?? ""
  });

  if (!parsed.success || !context.userId) {
    return { status: "error", message: "Member profile generation requires a signed-in account." };
  }

  const profile = await saveLatestMemberAiProfile({ userId: context.userId, createdBy: context.userId });
  revalidateAiPaths();
  return { status: "success", message: profile ? "AI fitness profile refreshed." : "No member profile is connected yet." };
}

export async function generateTrainerProgramAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(trainerRoles, "/trainer/ai");
  const parsed = GenerateWorkoutProgramSchema.safeParse({
    level: formData.get("level") ?? "beginner",
    weeks: formData.get("weeks") ?? 4
  });

  if (!parsed.success || !context.userId) {
    return validationState(parsed.error?.flatten().fieldErrors);
  }

  const draft = await generateWorkoutProgramDraft({
    userId: context.userId,
    level: parsed.data.level,
    weeks: parsed.data.weeks,
    generatedBy: context.userId
  });

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "ai.program.generated",
    entityType: "ai_generated_program",
    entityId: draft.id,
    metadata: { level: parsed.data.level, weeks: parsed.data.weeks }
  });
  revalidateAiPaths();
  return { status: "success", message: "AI program draft generated for trainer review." };
}

export async function generateNutritionGuidanceAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["member", "super_admin"], "/member/ai-coach");
  const parsed = GenerateNutritionGuidanceSchema.safeParse({
    goal: formData.get("goal") ?? "general fitness"
  });

  if (!parsed.success || !context.userId) {
    return validationState(parsed.error?.flatten().fieldErrors);
  }

  const guidance = await generateNutritionGuidance({ userId: context.userId, goal: parsed.data.goal });
  revalidateAiPaths();
  return { status: "success", message: guidance };
}

export async function generateAiContentDraftAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(staffRoles, "/admin/ai");
  const parsed = AiContentDraftSchema.safeParse({
    draftType: formData.get("draftType") ?? "announcement",
    audience: formData.get("audience"),
    brief: formData.get("brief")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const draft = await generateContentDraft({
    gymId: context.profile?.gym_id ?? null,
    userId: context.userId,
    draftType: parsed.data.draftType,
    audience: parsed.data.audience,
    brief: parsed.data.brief
  });

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "ai.content.generated",
    entityType: "ai_content_draft",
    entityId: draft.id,
    metadata: { draftType: parsed.data.draftType, audience: parsed.data.audience }
  });
  revalidateAiPaths();
  return { status: "success", message: "AI content draft created for human review." };
}

export async function generateExecutiveInsightAction(_previousState: AuthActionState): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(staffRoles, "/admin/ai");
  const content = await generateExecutiveInsightDraft({
    gymId: context.profile?.gym_id ?? null,
    userId: context.userId
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_insights").insert({
    gym_id: context.profile?.gym_id ?? null,
    insight_type: "executive",
    title: "AI executive summary",
    summary: content.slice(0, 700),
    recommendation: content,
    severity: "opportunity",
    confidence: 74,
    evidence: [],
    status: "open",
    generated_by: "hybrid",
    created_by: context.userId
  }).select("id").maybeSingle();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Executive insight generation failed." };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "ai.executive_insight.generated",
    entityType: "ai_insight",
    entityId: data.id,
    metadata: { source: "admin_ai" }
  });
  revalidateAiPaths();
  return { status: "success", message: "Executive AI insight generated." };
}

export async function reviewAiRecommendationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(staffRoles, "/admin/ai");
  const parsed = AiRecommendationReviewSchema.safeParse({
    recommendationId: formData.get("recommendationId"),
    status: formData.get("status"),
    note: formData.get("note") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_recommendations").update({
    status: parsed.data.status,
    reviewed_by: context.userId,
    reviewed_at: new Date().toISOString()
  }).eq("id", parsed.data.recommendationId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "ai.recommendation.reviewed",
    entityType: "ai_recommendation",
    entityId: parsed.data.recommendationId,
    metadata: { status: parsed.data.status, note: parsed.data.note ?? "" }
  });
  revalidateAiPaths();
  return { status: "success", message: "AI recommendation reviewed." };
}

function validationState(fieldErrors: Record<string, string[] | undefined> | undefined): AuthActionState {
  return {
    status: "error",
    message: "Please check the form and try again.",
    ...(fieldErrors ? { fieldErrors: compactFieldErrors(fieldErrors) } : {})
  };
}

function compactFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
  );
}

function revalidateAiPaths() {
  revalidatePath("/admin/ai");
  revalidatePath("/member/ai-coach");
  revalidatePath("/trainer/ai");
}
