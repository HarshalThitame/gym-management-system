import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { validateAndSetGstin } from "@/features/billing/services/tax-service";

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { orgId } = await params;
  try {
    const { gstin } = await request.json();
    if (!gstin || typeof gstin !== "string") {
      return NextResponse.json({ error: "GSTIN is required." }, { status: 400 });
    }

    const result = await validateAndSetGstin(orgId, gstin.toUpperCase());
    if (!result.valid) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message, parsed: result.parsed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
