import { NextResponse } from "next/server";
import { transferDomainAction } from "@/features/enterprise/actions/domain-transfer-action";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await transferDomainAction(body);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
