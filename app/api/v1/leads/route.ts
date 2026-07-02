import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/leads
 * List all leads with pagination and filtering
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    const status = searchParams.get("status");
    const source = searchParams.get("source");

    const supabase = createAdminClient();

    let query = supabase
      .from("crm_leads")
      .select("*", { count: "exact" })
      .eq("organization_id", context.apiKey.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (source) {
      query = query.eq("source", source);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch leads", details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  },
  { requiredScope: "read:leads", rateLimit: 100 }
);

/**
 * POST /api/v1/leads
 * Create a new lead
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    const body = await request.json();

    const { full_name, email, phone, source, notes } = body;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Missing required fields", message: "full_name and email are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("crm_leads")
      .insert({
        organization_id: context.apiKey.organization_id,
        full_name,
        email,
        phone: phone || null,
        source: source || "api",
        status: "new",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create lead", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  },
  { requiredScope: "write:leads", rateLimit: 50 }
);
