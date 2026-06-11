import { NextResponse } from "next/server";
import { saveLatestMemberAiProfile } from "@/features/ai/services/ai-service";
import { getApiTenantOrganizationId, requireApiPrimaryRole } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertFeature } from "@/lib/tenant";

export async function POST() {
  const auth = await requireApiPrimaryRole(["member"], {
    unauthenticatedMessage: "Sign in to generate AI recommendations.",
    forbiddenMessage: "Only members can generate member AI recommendations."
  });

  if (!auth.ok) {
    return auth.response;
  }

  const featureResponse = await requireApiFeature(getApiTenantOrganizationId(auth.context, auth.tenant));
  if (featureResponse) {
    return featureResponse;
  }

  const rateLimit = await checkRateLimit(`ai-recommendations:${auth.context.userId}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Please wait before refreshing AI recommendations again." } }, { status: 429 });
  }

  const profile = await saveLatestMemberAiProfile({
    userId: auth.context.userId,
    createdBy: auth.context.userId
  });

  return NextResponse.json({
    ok: true,
    data: {
      generated: Boolean(profile),
      profileId: profile?.id ?? null
    }
  });
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
