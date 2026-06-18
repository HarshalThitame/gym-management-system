import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { updateDisputeStatus } from "@/features/billing/services/dispute-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const body = await request.json();
    const validStatuses = ["under_review", "won", "lost", "closed"] as const;

    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Status must be one of: under_review, won, lost, closed" }, { status: 400 });
    }

    const result = await updateDisputeStatus(id, body.status, body.responseNotes ?? null);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
