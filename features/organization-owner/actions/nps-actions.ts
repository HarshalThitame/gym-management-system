"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess, entitlementSimpleCatch } from "@/features/entitlement";
import { writeAuditLog } from "@/lib/audit";

export type NPSSurvey = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  question: string;
  thank_you_message: string;
  trigger_type: "manual" | "after_join" | "after_class" | "after_renewal" | "days_since_join" | "scheduled";
  trigger_days: number;
  target_segment: Record<string, unknown>;
  channel: "email" | "whatsapp" | "sms" | "in_app";
  is_active: boolean;
  sent_count: number;
  response_count: number;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NPSResponse = {
  id: string;
  survey_id: string;
  organization_id: string;
  member_id: string;
  score: number;
  nps_category: "promoter" | "passive" | "detractor";
  feedback: string | null;
  channel: "email" | "whatsapp" | "sms" | "in_app" | "manual";
  responded_at: string;
  member_name?: string;
};

export type NPSDashboard = {
  overallNPS: number | null;
  totalResponses: number;
  promoters: { count: number; percentage: number };
  passives: { count: number; percentage: number };
  detractors: { count: number; percentage: number };
  trend: { month: string; nps: number; responses: number }[];
  bySurvey: { surveyId: string; surveyName: string; nps: number; responses: number }[];
  recentResponses: NPSResponse[];
  feedbackWordCloud: { word: string; count: number }[];
};

export type NPSSurveyInput = {
  name: string;
  description?: string | undefined;
  question?: string | undefined;
  thankYouMessage?: string | undefined;
  triggerType: NPSSurvey["trigger_type"];
  triggerDays?: number | undefined;
  targetSegment?: Record<string, unknown> | undefined;
  channel?: NPSSurvey["channel"] | undefined;
  isActive?: boolean | undefined;
};

function npsCategory(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

function calcNPS(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Number((((promoters - detractors) / scores.length) * 100).toFixed(1));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQueryBuilder = any;

export async function getSurveys(organizationId: string): Promise<NPSSurvey[]> {
  try {
    await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const { data, error } = await s
      .from("nps_surveys")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as NPSSurvey[];
  } catch {
    return [];
  }
}

export async function getSurveyNpsScores(
  organizationId: string,
): Promise<Record<string, number | null>> {
  try {
    await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const { data } = await s
      .from("nps_responses")
      .select("survey_id, score")
      .eq("organization_id", organizationId);

    const rows = (data ?? []) as Array<{ survey_id: string; score: number }>;
    const bySurvey = new Map<string, number[]>();
    for (const row of rows) {
      if (!bySurvey.has(row.survey_id)) bySurvey.set(row.survey_id, []);
      bySurvey.get(row.survey_id)!.push(row.score);
    }

    const result: Record<string, number | null> = {};
    for (const [surveyId, scores] of bySurvey) {
      result[surveyId] = calcNPS(scores);
    }
    return result;
  } catch {
    return {};
  }
}

export async function getSurvey(
  organizationId: string,
  surveyId: string,
): Promise<NPSSurvey | null> {
  try {
    await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const [{ data: survey, error: surveyErr }, countResult] = await Promise.all([
      s.from("nps_surveys").select("*").eq("id", surveyId).eq("organization_id", organizationId).single(),
      s.from("nps_responses").select("*", { count: "exact", head: true }).eq("survey_id", surveyId).eq("organization_id", organizationId),
    ]);

    if (surveyErr || !survey) return null;
    return { ...(survey as NPSSurvey), response_count: (countResult as { count?: number }).count ?? 0 };
  } catch {
    return null;
  }
}

export async function createSurvey(
  organizationId: string,
  data: NPSSurveyInput,
): Promise<NPSSurvey | null> {
  try {
    const { userId } = await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const { data: created, error } = await s
      .from("nps_surveys")
      .insert({
        organization_id: organizationId,
        name: data.name,
        description: data.description ?? null,
        question: data.question ?? "How likely are you to recommend our gym to a friend or colleague?",
        thank_you_message: data.thankYouMessage ?? "Thank you for your feedback!",
        trigger_type: data.triggerType,
        trigger_days: data.triggerDays ?? 0,
        target_segment: data.targetSegment ?? {},
        channel: data.channel ?? "email",
        is_active: data.isActive ?? true,
      })
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      actorId: userId,
      action: "organization_owner.create_nps_survey",
      entityType: "nps_survey",
      entityId: (created as Record<string, unknown>)?.id as string,
      metadata: { name: data.name, trigger_type: data.triggerType },
    });

    revalidatePath("/organization/communications");
    return created as NPSSurvey;
  } catch {
    return null;
  }
}

export async function updateSurvey(
  organizationId: string,
  surveyId: string,
  data: Partial<NPSSurveyInput>,
): Promise<NPSSurvey | null> {
  try {
    const { userId } = await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.question !== undefined) update.question = data.question;
    if (data.thankYouMessage !== undefined) update.thank_you_message = data.thankYouMessage;
    if (data.triggerType !== undefined) update.trigger_type = data.triggerType;
    if (data.triggerDays !== undefined) update.trigger_days = data.triggerDays;
    if (data.targetSegment !== undefined) update.target_segment = data.targetSegment;
    if (data.channel !== undefined) update.channel = data.channel;
    if (data.isActive !== undefined) update.is_active = data.isActive;

    const { data: updated, error } = await s
      .from("nps_surveys")
      .update(update)
      .eq("id", surveyId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      actorId: userId,
      action: "organization_owner.update_nps_survey",
      entityType: "nps_survey",
      entityId: surveyId,
      metadata: { updated_fields: Object.keys(update) },
    });

    revalidatePath("/organization/communications");
    return updated as NPSSurvey;
  } catch {
    return null;
  }
}

export async function deleteSurvey(
  organizationId: string,
  surveyId: string,
): Promise<{ success: boolean }> {
  try {
    const { userId } = await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const { error } = await s
      .from("nps_surveys")
      .delete()
      .eq("id", surveyId)
      .eq("organization_id", organizationId);

    if (error) throw error;

    await writeAuditLog({
      actorId: userId,
      action: "organization_owner.delete_nps_survey",
      entityType: "nps_survey",
      entityId: surveyId,
    });

    revalidatePath("/organization/communications");
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function submitNPSResponse(
  surveyId: string,
  memberId: string,
  score: number,
  feedback?: string,
  channel?: string,
): Promise<{ success: boolean; category?: string; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const numScore = typeof score === "number" ? score : Number(score) || 0;
    const category = npsCategory(numScore);

    const { data: memberRow } = await s
      .from("members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();
    if (!memberRow) {
      return { success: false, message: "Member account not found." };
    }

    const { data: surveyRow, error: surveyErr } = await s
      .from("nps_surveys")
      .select("id, organization_id, thank_you_message")
      .eq("id", surveyId)
      .single();

    if (surveyErr || !surveyRow) {
      return { success: false, message: "Survey not found." };
    }

    const survey = surveyRow as Record<string, unknown>;

    const { data: existing } = await s
      .from("nps_responses")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("member_id", memberId)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        category,
        message: "You've already submitted your feedback for this survey. Thank you!",
      };
    }

    const { error: insertErr } = await s
      .from("nps_responses")
      .insert({
        survey_id: surveyId,
        organization_id: survey.organization_id,
        member_id: memberId,
        score: numScore,
        nps_category: category,
        feedback: feedback ?? null,
        channel: channel ?? "in_app",
        responded_at: new Date().toISOString(),
      });

    if (insertErr) {
      if (insertErr.message?.includes("duplicate") || (insertErr as { code?: string }).code === "23505") {
        return {
          success: false,
          category,
          message: "You've already submitted your feedback for this survey. Thank you!",
        };
      }
      throw insertErr;
    }

    const { count: currentCount } = await s
      .from("nps_responses")
      .select("*", { count: "exact", head: true })
      .eq("survey_id", surveyId);

    await s
      .from("nps_surveys")
      .update({ response_count: currentCount ?? 1, updated_at: new Date().toISOString() })
      .eq("id", surveyId);

    return {
      success: true,
      category,
      message: (survey.thank_you_message as string) || "Thank you for your feedback!",
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : "Failed to submit response.",
    };
  }
}

export async function getNPSDashboard(
  organizationId: string,
  filters?: { surveyId?: string | undefined; dateFrom?: string | undefined; dateTo?: string | undefined },
): Promise<NPSDashboard | null> {
  try {
    await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    const dateFrom = filters?.dateFrom || new Date(Date.now() - 365 * 86400000).toISOString();
    const dateTo = filters?.dateTo || new Date().toISOString();

    const [responsesResult, trendResult, bySurveyResult, recentResult] = await Promise.all([
      s.from("nps_responses").select("score, nps_category")
        .eq("organization_id", organizationId)
        .gte("responded_at", dateFrom)
        .lte("responded_at", dateTo),
      s.from("nps_responses").select("responded_at, score")
        .eq("organization_id", organizationId)
        .gte("responded_at", dateFrom)
        .lte("responded_at", dateTo)
        .order("responded_at"),
      s.from("nps_responses").select("survey_id, nps_surveys!inner(name), score")
        .eq("organization_id", organizationId)
        .gte("responded_at", dateFrom)
        .lte("responded_at", dateTo),
      s.from("nps_responses").select("id, survey_id, member_id, score, nps_category, feedback, responded_at, members!inner(full_name)")
        .eq("organization_id", organizationId)
        .order("responded_at", { ascending: false })
        .limit(20),
    ]);

    const allResponses = (responsesResult.data ?? []) as Array<{ score: number; nps_category: string }>;
    const totalResponses = allResponses.length;

    const promoters = allResponses.filter((r) => r.nps_category === "promoter").length;
    const passives = allResponses.filter((r) => r.nps_category === "passive").length;
    const detractors = allResponses.filter((r) => r.nps_category === "detractor").length;
    const overallNPS = calcNPS(allResponses.map((r) => r.score));

    const trendData = (trendResult.data ?? []) as Array<{ responded_at: string; score: number }>;
    const byMonth = new Map<string, number[]>();
    for (const row of trendData) {
      const month = row.responded_at.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(row.score);
    }
    const trend = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, scores]) => ({
        month,
        nps: calcNPS(scores) ?? 0,
        responses: scores.length,
      }));

    const bySurveyRows = (bySurveyResult.data ?? []) as Array<{
      survey_id: string; nps_surveys: { name: string } | null; score: number;
    }>;
    const bySurveyMap = new Map<string, { name: string; scores: number[] }>();
    for (const row of bySurveyRows) {
      const sId = row.survey_id;
      if (!bySurveyMap.has(sId)) {
        bySurveyMap.set(sId, { name: row.nps_surveys?.name ?? "Unknown", scores: [] });
      }
      bySurveyMap.get(sId)!.scores.push(row.score);
    }
    const bySurvey = Array.from(bySurveyMap.entries()).map(([surveyId, { name, scores }]) => ({
      surveyId, surveyName: name, nps: calcNPS(scores) ?? 0, responses: scores.length,
    }));

    const recentRows = (recentResult.data ?? []) as Array<{
      id: string; survey_id: string; member_id: string; score: number;
      nps_category: string; feedback: string | null; responded_at: string;
      members: { full_name: string } | null;
    }>;
    const recentResponses: NPSResponse[] = recentRows.map((r) => ({
      id: r.id,
      survey_id: r.survey_id,
      organization_id: organizationId,
      member_id: r.member_id,
      score: r.score,
      nps_category: r.nps_category as "promoter" | "passive" | "detractor",
      feedback: r.feedback,
      channel: "in_app" as const,
      responded_at: r.responded_at,
      member_name: r.members?.full_name ?? "Unknown",
    }));

    const wordCounts = new Map<string, number>();
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "shall",
      "should", "may", "might", "must", "can", "could", "i", "you", "he",
      "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
      "your", "his", "its", "our", "their", "this", "that", "these", "those",
      "not", "no", "very", "just", "so", "if", "then", "than", "too",
      "also", "from", "up", "about", "into", "over", "after", "all", "some",
    ]);
    for (const r of recentResponses) {
      if (r.feedback) {
        const words = r.feedback.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
        for (const w of words) {
          if (w.length > 2 && !stopWords.has(w)) {
            wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
          }
        }
      }
    }
    const feedbackWordCloud = Array.from(wordCounts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return {
      overallNPS,
      totalResponses,
      promoters: {
        count: promoters,
        percentage: totalResponses > 0 ? Number(((promoters / totalResponses) * 100).toFixed(1)) : 0,
      },
      passives: {
        count: passives,
        percentage: totalResponses > 0 ? Number(((passives / totalResponses) * 100).toFixed(1)) : 0,
      },
      detractors: {
        count: detractors,
        percentage: totalResponses > 0 ? Number(((detractors / totalResponses) * 100).toFixed(1)) : 0,
      },
      trend,
      bySurvey,
      recentResponses,
      feedbackWordCloud,
    };
  } catch {
    return null;
  }
}

export async function processAutoSurveys(
  organizationId: string,
  surveyId?: string,
): Promise<{ processed: number; sent: number; skipped: number }> {
  try {
    await requireOrgFeatureAccess(organizationId, "member_nps_surveys");
    const supabase = await createSupabaseServerClient();
    const s = supabase as unknown as AnyQueryBuilder;

    if (surveyId) {
      const { data: manualSurvey } = await s
        .from("nps_surveys")
        .select("*")
        .eq("id", surveyId)
        .eq("organization_id", organizationId)
        .eq("trigger_type", "manual")
        .maybeSingle();

      if (manualSurvey) {
        return processSingleSurvey(s, organizationId, manualSurvey as NPSSurvey);
      }

      const { data: specificSurvey } = await s
        .from("nps_surveys")
        .select("*")
        .eq("id", surveyId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .neq("trigger_type", "manual")
        .maybeSingle();

      if (specificSurvey) {
        return processSingleSurvey(s, organizationId, specificSurvey as NPSSurvey);
      }

      return { processed: 0, sent: 0, skipped: 0 };
    }

    const { data: surveys } = await s
      .from("nps_surveys")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .neq("trigger_type", "manual");

    if (!surveys?.length) return { processed: 0, sent: 0, skipped: 0 };

    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const row of surveys) {
      const result = await processSingleSurvey(s, organizationId, row as NPSSurvey);
      processed += result.processed;
      sent += result.sent;
      skipped += result.skipped;
    }

    return { processed, sent, skipped };
  } catch (e) {
    return entitlementSimpleCatch(e, "Failed to process auto surveys.") as never;
  }
}

async function processSingleSurvey(
  s: AnyQueryBuilder,
  organizationId: string,
  survey: NPSSurvey,
): Promise<{ processed: number; sent: number; skipped: number }> {
  const now = new Date();
  let members: Array<{ id: string; full_name: string | null; email: string | null; phone: string | null }> = [];

  switch (survey.trigger_type) {
    case "manual": {
      const { data } = await s
        .from("members")
        .select("id, full_name, email, phone")
        .eq("status", "active");
      members = (data ?? []) as typeof members;
      break;
    }
    case "scheduled":
    case "after_join": {
      const cutoff = new Date(now.getTime() - (survey.trigger_days || 30) * 86400000).toISOString();
      const { data } = await s
        .from("members")
        .select("id, full_name, email, phone")
        .eq("status", "active")
        .lte("created_at", cutoff);
      members = (data ?? []) as typeof members;
      break;
    }
    case "days_since_join": {
      const dayStart = new Date(now.getTime() - (survey.trigger_days + 1) * 86400000).toISOString();
      const dayEnd = new Date(now.getTime() - survey.trigger_days * 86400000).toISOString();
      const { data } = await s
        .from("members")
        .select("id, full_name, email, phone")
        .eq("status", "active")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);
      members = (data ?? []) as typeof members;
      break;
    }
    case "after_renewal": {
      const cutoff = new Date(now.getTime() - survey.trigger_days * 86400000).toISOString();
      const { data: memberships } = await s
        .from("memberships")
        .select("member_id")
        .eq("status", "active")
        .lte("start_date", cutoff);
      const memberIds = [...new Set((memberships ?? []).map((m: Record<string, unknown>) => m.member_id as string))];
      if (memberIds.length > 0) {
        const { data: mData } = await s
          .from("members")
          .select("id, full_name, email, phone")
          .in("id", memberIds)
          .eq("status", "active");
        const mArr = (mData ?? []) as typeof members;
        members = mArr.slice(0, 50);
      }
      break;
    }
    case "after_class": {
      const cutoff = new Date(now.getTime() - survey.trigger_days * 86400000).toISOString();
      const { data: attendees } = await s
        .from("class_attendance")
        .select("member_id")
        .lte("marked_at", cutoff);
      const memberIds = [...new Set((attendees ?? []).map((a: Record<string, unknown>) => a.member_id as string))];
      if (memberIds.length > 0) {
        const { data: mData } = await s
          .from("members")
          .select("id, full_name, email, phone")
          .in("id", memberIds)
          .eq("status", "active");
        members = (mData ?? []) as typeof members;
      }
      break;
    }
    default:
      return { processed: 0, sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const member of members) {
    const memberId = member.id;
    const hasContact = survey.channel === "email"
      ? !!member.email
      : survey.channel === "whatsapp" || survey.channel === "sms"
        ? !!member.phone
        : true;

    if (!hasContact) {
      skipped++;
      await s.from("nps_trigger_logs").insert({
        survey_id: survey.id,
        organization_id: organizationId,
        member_id: memberId,
        trigger_type: survey.trigger_type,
        sent_at: now.toISOString(),
        delivery_status: "failed",
        error_message: `No ${survey.channel} contact info`,
      });
      continue;
    }

    const { data: existingResp } = await s
      .from("nps_responses")
      .select("id")
      .eq("survey_id", survey.id)
      .eq("member_id", memberId)
      .maybeSingle();
    if (existingResp) { skipped++; continue; }

    const { data: existingTrigger } = await s
      .from("nps_trigger_logs")
      .select("id")
      .eq("survey_id", survey.id)
      .eq("member_id", memberId)
      .eq("delivery_status", "sent")
      .maybeSingle();
    if (existingTrigger) { skipped++; continue; }

    await s.from("nps_trigger_logs").insert({
      survey_id: survey.id,
      organization_id: organizationId,
      member_id: memberId,
      trigger_type: survey.trigger_type,
      sent_at: now.toISOString(),
      delivery_status: "sent",
    });

    sent++;
  }

  if (sent > 0) {
    await s
      .from("nps_surveys")
      .update({
        sent_count: survey.sent_count + sent,
        last_sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", survey.id);
  }

  revalidatePath("/organization/communications");
  return { processed: members.length, sent, skipped };
}
