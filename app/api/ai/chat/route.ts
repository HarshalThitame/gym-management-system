import { NextResponse } from "next/server";
import { AiChatRequestSchema } from "@/features/ai/schemas/ai";
import { generateCoachReply } from "@/features/ai/services/ai-service";
import { getApiTenantOrganizationId, requireApiPrimaryRole } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertFeature } from "@/lib/tenant";

export async function POST(request: Request) {
  const auth = await requireApiPrimaryRole(["member"], {
    unauthenticatedMessage: "Sign in to use the AI coach.",
    forbiddenMessage: "Only members can use the member AI coach API."
  });

  if (!auth.ok) {
    return auth.response;
  }

  const featureResponse = await requireApiFeature(getApiTenantOrganizationId(auth.context, auth.tenant));
  if (featureResponse) {
    return featureResponse;
  }

  const rateLimit = await checkRateLimit(`ai-chat:${auth.context.userId}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many AI coach messages. Please wait a minute." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = AiChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please enter a valid message.",
          fieldErrors: parsed.error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  try {
    const reply = await generateCoachReply({
      userId: auth.context.userId,
      message: parsed.data.message,
      sessionId: parsed.data.sessionId || null
    });

    return NextResponse.json({ ok: true, data: reply });
  } catch (error) {
    if (isFeatureGateError(error)) {
      return NextResponse.json({ ok: false, error: { code: "FEATURE_NOT_AVAILABLE", message: error.message } }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: { code: "AI_ERROR", message: "AI coach is unavailable right now." } }, { status: 500 });
  }
}

function isFeatureGateError(error: unknown): error is Error {
  return error instanceof Error && error.message === "Feature not available on your current plan.";
}

async function requireApiFeature(organizationId: string | null) {
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: { code: "FEATURE_NOT_AVAILABLE", message: "Feature not available on your current plan." } }, { status: 403 });
  }

  try {
    await assertFeature(organizationId, "aiEnabled");
    return null;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "FEATURE_NOT_AVAILABLE", message: error instanceof Error ? error.message : "Feature not available on your current plan." } },
      { status: 403 }
    );
  }
}
