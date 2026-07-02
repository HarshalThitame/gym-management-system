import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/features/api/middleware/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/attendance
 * List attendance records with pagination and filtering
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    const memberId = searchParams.get("member_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const supabase = createAdminClient();

    let query = supabase
      .from("attendance_sessions")
      .select("*", { count: "exact" })
      .eq("organization_id", context.apiKey.organization_id)
      .order("check_in_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (memberId) {
      query = query.eq("member_id", memberId);
    }

    if (dateFrom) {
      query = query.gte("check_in_time", dateFrom);
    }

    if (dateTo) {
      query = query.lte("check_in_time", dateTo);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch attendance", details: error.message }, { status: 500 });
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
  { requiredScope: "read:attendance", rateLimit: 100 }
);

/**
 * POST /api/v1/attendance/check-in
 * Record a member check-in
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    const body = await request.json();
    const { member_id, gym_id, notes } = body;

    if (!member_id) {
      return NextResponse.json(
        { error: "Missing required field", message: "member_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if member has an active session (already checked in)
    const { data: activeSession } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("member_id", member_id)
      .eq("organization_id", context.apiKey.organization_id)
      .is("check_out_time", null)
      .maybeSingle();

    if (activeSession) {
      return NextResponse.json(
        { error: "Member already checked in", message: "Member must check out before checking in again" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        organization_id: context.apiKey.organization_id,
        member_id,
        gym_id: gym_id || null,
        check_in_time: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to record check-in", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  },
  { requiredScope: "write:attendance", rateLimit: 60 }
);
