import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/members
 * List all members with pagination and filtering
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const supabase = createAdminClient();

    let query = supabase
      .from("members")
      .select("*", { count: "exact" })
      .eq("organization_id", context.apiKey.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch members", details: error.message }, { status: 500 });
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
  { requiredScope: "read:members", rateLimit: 100 }
);

/**
 * POST /api/v1/members
 * Create a new member
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    const body = await request.json();

    const { full_name, email, phone, membership_type, status } = body;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Missing required fields", message: "full_name and email are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("members")
      .insert({
        organization_id: context.apiKey.organization_id,
        full_name,
        email,
        phone: phone || null,
        membership_type: membership_type || "standard",
        status: status || "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create member", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  },
  { requiredScope: "write:members", rateLimit: 50 }
);
