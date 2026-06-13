import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { getOrgTaxSettings, upsertOrgTaxSettings } from "@/features/billing/services/tax-service";

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { orgId } = await params;
  const settings = await getOrgTaxSettings(orgId);
  return NextResponse.json({ data: settings });
}

export async function PUT(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { orgId } = await params;
  try {
    const body = await request.json();
    const result = await upsertOrgTaxSettings(orgId, body);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
