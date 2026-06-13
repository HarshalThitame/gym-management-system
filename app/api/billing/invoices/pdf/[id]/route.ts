import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateInvoicePdf } from "@/features/billing/lib/invoice-pdf";
import type { InvoiceBundle } from "@/types/billing";

type DB = {
  from(t: string): {
    select(c: string): {
      eq(c: string, v: string): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        order(c: string, o: { ascending: boolean }): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };
  };
};

const ADMIN_KEY_HEADER = "x-admin-api-key";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = _req.headers.get(ADMIN_KEY_HEADER);
  if (ADMIN_API_KEY && apiKey !== ADMIN_API_KEY) return unauthorized();

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Server config error" }, { status: 503 });

  const db = supabase as never as DB;
  const { id } = await params;

  const { data: invoice } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: items } = await db.from("invoice_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true });

  const memberId = invoice.member_id as string | null;
  let member: InvoiceBundle["member"] = null;
  if (memberId) {
    const { data: m } = await db.from("members").select("*").eq("id", memberId).maybeSingle();
    if (m) {
      member = {
        id: m.id as string,
        member_code: m.member_code as string,
        full_name: m.full_name as string,
        email: (m.email as string | null) ?? null,
        phone: m.phone as string,
        address: (m.address as string | null) ?? null,
      };
    }
  }

  const { data: payments } = await db.from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false });
  const { data: refunds } = await db.from("refunds").select("*").eq("invoice_id", id).order("created_at", { ascending: false });

  const bundle: InvoiceBundle = {
    invoice: invoice as InvoiceBundle["invoice"],
    items: (items ?? []) as InvoiceBundle["items"],
    member,
    payments: (payments ?? []) as InvoiceBundle["payments"],
    refunds: (refunds ?? []) as InvoiceBundle["refunds"],
  };

  try {
    const pdfBytes = await generateInvoicePdf(bundle);
    const pdfBuffer = Buffer.from(pdfBytes);
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${(invoice.invoice_number as string) || id}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
