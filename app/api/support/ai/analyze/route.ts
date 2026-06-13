import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { autoCategorize, analyzeSentiment, detectDuplicates, suggestResponse, generateSummary } from "@/features/support/services/support-ai-service";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { subject: string; description: string; organizationId: string; ticketId: string };
    if (!body.subject || !body.organizationId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "subject and organizationId required." } }, { status: 400 });
    }

    const [category, sentiment, duplicates, suggestedResponse] = await Promise.all([
      Promise.resolve(autoCategorize(body.subject, body.description)),
      Promise.resolve(analyzeSentiment(`${body.subject} ${body.description}`)),
      detectDuplicates(body.subject, body.description, body.organizationId),
      suggestResponse(body.subject, body.description, body.organizationId),
    ]);

    const summary = generateSummary({ subject: body.subject, description: body.description }, []);

    return NextResponse.json({
      ok: true,
      data: { category, sentiment, duplicates, suggestedResponse, summary },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ANALYSIS_ERROR", message: e instanceof Error ? e.message : "Analysis failed." } }, { status: 500 });
  }
}
