import { NextResponse } from "next/server";
import { LeadSchema } from "@/features/public/schemas/lead";
import { checkRateLimit } from "@/lib/rate-limit";
import { insertLead } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || "local";
  const rateLimit = checkRateLimit(`lead:${ip}`, 8, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait a minute and try again."
        }
      },
      { status: 429 }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = LeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the form and try again.",
          fieldErrors: parsed.error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const result = await insertLead({
      name: data.name,
      phone: data.phone,
      email: data.email ? data.email : null,
      source: data.type,
      interest: data.interest ?? null,
      message: data.message,
      preferred_trial_at: parseOptionalDate(data.preferredDate),
      status: "new",
      consent_marketing: data.consent,
      notes: resultNote(data.type)
    });

    return NextResponse.json({
      ok: true,
      data: {
        stored: result.stored
      },
      message: result.stored
        ? "Your request has been received. The Apex team will contact you shortly."
        : "Your request has been validated. Configure Supabase environment variables to store leads."
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: "We could not save your request right now. Please call or WhatsApp the team."
        }
      },
      { status: 500 }
    );
  }
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function resultNote(type: string) {
  if (type === "free_trial") {
    return "Submitted from public free trial form.";
  }
  if (type === "membership_inquiry") {
    return "Submitted from membership inquiry form.";
  }
  return "Submitted from public contact form.";
}
