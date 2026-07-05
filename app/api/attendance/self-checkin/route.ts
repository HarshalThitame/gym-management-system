import { NextRequest, NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantGymId } from "@/lib/auth/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInMember } from "@/features/attendance/lib/phase1-api";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiPrimaryRole(["member"], {
      forbiddenMessage: "Only members can self check in.",
    });
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedMemberId = typeof body.memberId === "string" ? body.memberId : null;
    const gymId = getApiTenantGymId(auth.context, auth.tenant);
    if (!gymId) {
      return NextResponse.json(
        { ok: false, error: { code: "TENANT_SCOPE_REQUIRED", message: "Member gym scope could not be resolved." } },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();
    const { data: member, error } = await supabase
      .from("members")
      .select("id, gym_id, user_id")
      .eq("user_id", auth.context.userId)
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "QUERY_FAILED", message: error.message } }, { status: 500 });
    }

    if (!member) {
      return NextResponse.json(
        { ok: false, error: { code: "MEMBER_NOT_FOUND", message: "No member record is linked to this account." } },
        { status: 404 },
      );
    }

    if (requestedMemberId && requestedMemberId !== member.id) {
      return NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "You can only self check in using your own member profile." } },
        { status: 403 },
      );
    }

    const result = await checkInMember({
      actor: {
        userId: auth.context.userId,
        organizationId: auth.context.organizationId,
        profile: auth.context.profile,
        primaryRole: auth.context.primaryRole,
        roles: auth.context.roles,
        gymId,
        branchId: auth.tenant.resolved ? auth.tenant.branch.id : auth.context.profile?.branch_id ?? null,
      },
      memberId: member.id,
      source: "member_app",
      notes: "Member self check-in",
      branchId: auth.tenant.resolved ? auth.tenant.branch.id : auth.context.profile?.branch_id ?? null,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: result.session.id,
        checkedInAt: result.session.check_in_at,
        status: result.session.status,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" } },
      { status: 500 },
    );
  }
}
