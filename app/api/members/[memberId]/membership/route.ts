import { NextRequest, NextResponse } from "next/server";
import { hasRequiredRole } from "@/lib/rbac";
import { requireApiAuth, getApiTenantGymId } from "@/lib/auth/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAttendanceMembershipSummary } from "@/features/attendance/lib/phase1-api";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const { memberId } = await params;
    const supabase = createAdminClient();
    const { data: member, error } = await supabase
      .from("members")
      .select("id, gym_id, user_id")
      .eq("id", memberId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "QUERY_FAILED", message: error.message } }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Member not found." } }, { status: 404 });
    }

    const staffAllowed = hasRequiredRole(auth.context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer"]);
    const gymId = getApiTenantGymId(auth.context, auth.tenant);
    const memberOwnsRecord = member.user_id === auth.context.userId;

    if (!memberOwnsRecord && !staffAllowed) {
      return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "You do not have permission to view this membership." } }, { status: 403 });
    }
    if (!memberOwnsRecord && gymId && member.gym_id !== gymId) {
      return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "Member does not belong to this gym scope." } }, { status: 403 });
    }

    const membership = await getAttendanceMembershipSummary(memberId, memberOwnsRecord ? null : gymId);
    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" } },
      { status: 500 },
    );
  }
}
