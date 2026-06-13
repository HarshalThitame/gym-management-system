import { NextResponse } from "next/server";
import type { Json } from "@/types/database";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const supabase = await createSupabaseServerClient();
    const sdb = db(supabase as unknown);

    const { data: existing } = await sdb
      .from("support_customer_feedback")
      .select("id")
      .eq("ticket_id", body.ticketId as string)
      .eq("survey_type", body.surveyType as string)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false, error: { code: "ALREADY_EXISTS", message: "Feedback already submitted for this ticket." } }, { status: 409 });
    }

    const { data, error } = await sdb.from("support_customer_feedback").insert({
      ticket_id: body.ticketId as string,
      survey_type: body.surveyType as string,
      score: body.score as number,
      feedback_text: (body.feedbackText as string) ?? null,
      improvement_suggestions: (body.improvementSuggestions as string) ?? null,
    }).select().single();

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "support.feedback.submitted" as const,
      entityType: "support_customer_feedback",
      entityId: data.id,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "SUBMIT_ERROR", message: e instanceof Error ? e.message : "Failed to submit feedback." } }, { status: 500 });
  }
}
