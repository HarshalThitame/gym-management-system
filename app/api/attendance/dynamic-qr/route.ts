import { NextRequest, NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantGymId } from "@/lib/auth/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueDynamicAttendanceQr } from "@/features/attendance/lib/phase1-api";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiPrimaryRole(["member"], {
      forbiddenMessage: "Only members can request a dynamic attendance QR.",
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
        { ok: false, error: { code: "FORBIDDEN", message: "You can only request a QR for your own member profile." } },
        { status: 403 },
      );
    }

    const result = await issueDynamicAttendanceQr(member.id, {
      userId: auth.context.userId,
      organizationId: auth.context.organizationId,
      profile: auth.context.profile,
      primaryRole: auth.context.primaryRole,
      roles: auth.context.roles,
      gymId,
      branchId: auth.tenant.resolved ? auth.tenant.branch.id : auth.context.profile?.branch_id ?? null,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: { code: "MEMBER_NOT_FOUND", message: "No member record is linked to this account." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        memberId: result.memberId,
        qrCode: result.qrCode,
        qrToken: result.qrToken.token_value,
        expiresAt: result.expiresAt,
        refreshAfterSeconds: result.refreshAfterSeconds,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" } },
      { status: 500 },
    );
  }
}
