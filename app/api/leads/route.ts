import { NextRequest, NextResponse } from "next/server";
import { LeadSchema } from "@/features/public/schemas/lead";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { insertLead } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiFeatureAccess } from "@/features/entitlement";

export async function POST(request: Request) {
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimit = await checkRateLimit(`lead:${ip}`, 8, 60_000);

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
    } as never);

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

// ─── Authenticated CRM Endpoints ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get("organization_id");
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "organization_id is required." } }, { status: 400 });
    }

    const denied = await requireApiFeatureAccess(organizationId, "lead_management");
    if (denied) return denied;

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize")) || 12));
    const status = searchParams.get("status") || undefined;
    const source = searchParams.get("source") || undefined;
    const q = searchParams.get("q") || undefined;

    const { data: gyms } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
    const gymIds = gyms?.map((g) => g.id) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from("leads").select("*", { count: "exact" });

    if (gymIds.length > 0) {
      query = query.in("gym_id", gymIds);
    }

    if (status && status !== "all") query = query.eq("status", status);
    if (source && source !== "all") query = query.eq("source", source);
    if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    return NextResponse.json({
      ok: true,
      data: { leads: data ?? [], total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) },
    });
  } catch (error) {
    if (error instanceof Error && error.message?.includes("ENTITLEMENT")) {
      return NextResponse.json({ ok: false, error: { code: "FEATURE_LOCKED", message: "This feature is not available on your current plan." } }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !body.organization_id || !body.lead_id) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "organization_id and lead_id are required." } }, { status: 400 });
    }

    const denied = await requireApiFeatureAccess(String(body.organization_id), "lead_management");
    if (denied) return denied;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) update.status = body.status;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.source) update.source = body.source;

    const { data, error } = await supabase
      .from("leads")
      .update(update as never)
      .eq("id", String(body.lead_id))
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "DATABASE_ERROR", message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof Error && error.message?.includes("ENTITLEMENT")) {
      return NextResponse.json({ ok: false, error: { code: "FEATURE_LOCKED", message: "This feature is not available on your current plan." } }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !body.organization_id || !body.lead_id) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "organization_id and lead_id are required." } }, { status: 400 });
    }

    const denied = await requireApiFeatureAccess(String(body.organization_id), "lead_management");
    if (denied) return denied;

    const { error } = await supabase.from("leads").delete().eq("id", String(body.lead_id));

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "DATABASE_ERROR", message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    if (error instanceof Error && error.message?.includes("ENTITLEMENT")) {
      return NextResponse.json({ ok: false, error: { code: "FEATURE_LOCKED", message: "This feature is not available on your current plan." } }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
  }
}
