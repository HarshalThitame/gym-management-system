import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminRetryDunningInvoice,
  adminExtendGracePeriod,
  adminWaiveDunning,
  adminMarkDunningResolved,
} from "@/features/billing/services/dunning-action-service";

type ActionBody = {
  invoiceId: string;
  action: "retry" | "extend_grace" | "waive" | "resolve";
  newGraceEnd?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle() as never as {
    data: { gym_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "No gym scope assigned" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database connection failed" }, { status: 500 });

  const body: ActionBody = await request.json();
  const { invoiceId, action, newGraceEnd } = body;

  if (!invoiceId || !action) {
    return NextResponse.json({ error: "invoiceId and action are required" }, { status: 400 });
  }

  const validActions = ["retry", "extend_grace", "waive", "resolve"] as const;
  if (!validActions.includes(action as typeof validActions[number])) {
    return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, gym_id")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: { id: string; gym_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Invoice does not belong to your gym" }, { status: 403 });
  }

  let result;

  switch (action) {
    case "retry":
      result = await adminRetryDunningInvoice(invoiceId);
      break;
    case "extend_grace":
      if (!newGraceEnd) {
        return NextResponse.json({ error: "newGraceEnd date is required for extend_grace action" }, { status: 400 });
      }
      result = await adminExtendGracePeriod(invoiceId, newGraceEnd);
      break;
    case "waive":
      result = await adminWaiveDunning(invoiceId);
      break;
    case "resolve":
      result = await adminMarkDunningResolved(invoiceId);
      break;
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const responseBody: Record<string, unknown> = { ok: true, message: result.message };
  if ("url" in result && result.url) responseBody.url = result.url;
  return NextResponse.json(responseBody);
}
