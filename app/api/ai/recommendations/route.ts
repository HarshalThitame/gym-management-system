import { NextResponse } from "next/server";
import { saveLatestMemberAiProfile } from "@/features/ai/services/ai-service";
import { getAuthContext } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to generate AI recommendations." } }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`ai-recommendations:${context.userId}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Please wait before refreshing AI recommendations again." } }, { status: 429 });
  }

  const profile = await saveLatestMemberAiProfile({
    userId: context.userId,
    createdBy: context.userId
  });

  return NextResponse.json({
    ok: true,
    data: {
      generated: Boolean(profile),
      profileId: profile?.id ?? null
    }
  });
}
