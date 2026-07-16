import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateInvoicePdf } from "@/features/billing/lib/invoice-pdf";
import type { InvoiceBundle } from "@/types/billing";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Server config error" }, { status: 503 });

  const { id } = await params;

  const { data: member } = await admin
    .from("members")
    .select("id, gym_id")
    .eq("email", user.email ?? "")
    .maybeSingle() as never as {
    data: { id: string; gym_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!member || !member.gym_id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle() as never as {
    data: InvoiceBundle["invoice"] | null;
    error: { message: string } | null;
  };

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.member_id !== member.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: items } = await admin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true }) as never as {
    data: InvoiceBundle["items"] | null;
    error: { message: string } | null;
  };

  const { data: memberDetails } = await admin
    .from("members")
    .select("*")
    .eq("email", user.email ?? "")
    .maybeSingle() as never as {
    data: InvoiceBundle["member"] extends null ? null : NonNullable<InvoiceBundle["member"]>;
    error: { message: string } | null;
  };

  const { data: payments } = await admin
    .from("payments")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false }) as never as {
    data: InvoiceBundle["payments"] | null;
    error: { message: string } | null;
  };

  const { data: refunds } = await admin
    .from("refunds")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false }) as never as {
    data: InvoiceBundle["refunds"] | null;
    error: { message: string } | null;
  };

  const bundle: InvoiceBundle = {
    invoice,
    items: items ?? [],
    member: memberDetails ?? null,
    payments: payments ?? [],
    refunds: refunds ?? [],
  };

  try {
    const pdfBytes = await generateInvoicePdf(bundle);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${bundle.invoice.invoice_number || id}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
