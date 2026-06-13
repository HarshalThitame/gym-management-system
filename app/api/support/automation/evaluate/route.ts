import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { evaluateAutomationRules } from "@/features/support/services/support-automation-service";

export const runtime = "nodejs";

const roles = ["super_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Only super admins can evaluate automation rules.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { ticketId: string; triggerEvent: string };
    if (!body.ticketId || !body.triggerEvent) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "ticketId and triggerEvent required." } }, { status: 400 });
    }

    await evaluateAutomationRules(body.ticketId, body.triggerEvent);
    return NextResponse.json({ ok: true, message: "Automation rules evaluated." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "EVAL_ERROR", message: e instanceof Error ? e.message : "Evaluation failed." } }, { status: 500 });
  }
}
