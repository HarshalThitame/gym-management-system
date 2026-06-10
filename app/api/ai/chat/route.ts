import { NextResponse } from "next/server";
import { AiChatRequestSchema } from "@/features/ai/schemas/ai";
import { generateCoachReply } from "@/features/ai/services/ai-service";
import { getAuthContext } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to use the AI coach." } }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`ai-chat:${context.userId}`, 20, 60_000);
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
      userId: context.userId,
      message: parsed.data.message,
      sessionId: parsed.data.sessionId || null
    });

    return NextResponse.json({ ok: true, data: reply });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "AI_ERROR", message: "AI coach is unavailable right now." } }, { status: 500 });
  }
}
