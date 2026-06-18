import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { approveWriteOff, rejectWriteOff, applyWriteOff } from "@/features/billing/services/write-off-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const body = await request.json();

    if (body.action === "approve") {
      const result = await approveWriteOff(id, auth.context.userId);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (body.action === "reject") {
      const result = await rejectWriteOff(id, body.reason ?? null);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (body.action === "apply") {
      const result = await applyWriteOff(id);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ error: "action must be: approve, reject, or apply" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
