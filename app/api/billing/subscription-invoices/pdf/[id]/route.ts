import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ADMIN_KEY_HEADER = "x-admin-api-key";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

type DB = {
  from(t: string): {
    select(c: string): {
      eq(c: string, v: string): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function formatPrice(paise: number, currency: string): string {
  const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 });
  return fmt.format(paise / 100);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = _req.headers.get(ADMIN_KEY_HEADER);
  if (ADMIN_API_KEY && apiKey !== ADMIN_API_KEY) return unauthorized();

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Server config error" }, { status: 503 });

  const db = supabase as never as DB;
  const { id } = await params;

  const { data: invoice } = await db.from("org_subscription_invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Subscription invoice not found" }, { status: 404 });

  const orgId = invoice.organization_id as string;
  const { data: org } = await db.from("organizations").select("*").eq("id", orgId).maybeSingle();
  const orgName = (org?.name as string) || "Organization";
  const totalAmount = (invoice.total_amount as number) || (invoice.subtotal_amount as number) || 0;
  const amountPaid = (invoice.amount_paid as number) || 0;
  const amountDue = (invoice.amount_due as number) || totalAmount - amountPaid;
  const invoiceNumber = (invoice.invoice_number as string) || id;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const dark = rgb(0.067, 0.071, 0.078);
  const muted = rgb(0.37, 0.39, 0.43);
  let y = 780;

  page.drawText("Apex Performance Club", { x: 48, y, size: 20, font: bold, color: dark });
  page.drawText("SaaS Subscription Invoice", { x: 48, y: y - 22, size: 10, font: regular, color: muted });
  page.drawText("INVOICE", { x: 455, y, size: 22, font: bold, color: dark });
  page.drawText(invoiceNumber, { x: 455, y: y - 22, size: 10, font: regular, color: muted });
  y -= 70;

  page.drawText("Bill To", { x: 48, y, size: 9, font: regular, color: muted });
  page.drawText(orgName.slice(0, 36), { x: 48, y: y - 17, size: 12, font: bold, color: dark });
  y -= 50;

  page.drawText("Period", { x: 48, y, size: 9, font: regular, color: muted });
  const periodStart = (invoice.billing_period_start as string)?.slice(0, 10) ?? "-";
  const periodEnd = (invoice.billing_period_end as string)?.slice(0, 10) ?? "-";
  page.drawText(`${periodStart} to ${periodEnd}`, { x: 48, y: y - 17, size: 12, font: bold, color: dark });
  y -= 56;

  const currency = (invoice.currency as string) || "INR";
  page.drawRectangle({ x: 48, y: y - 8, width: 499, height: 28, color: rgb(0.94, 0.95, 0.92) });
  page.drawText("Description", { x: 60, y, size: 10, font: bold, color: dark });
  page.drawText("Amount", { x: 455, y, size: 10, font: bold, color: dark });
  y -= 30;

  page.drawText(`SaaS Subscription (${invoiceNumber})`, { x: 60, y, size: 10, font: regular, color: dark });
  page.drawText(formatPrice(totalAmount, currency), { x: 455, y, size: 10, font: regular, color: dark });
  y -= 24;

  y -= 34;
  page.drawText("Subtotal", { x: 360, y, size: 11, font: regular, color: dark });
  page.drawText(formatPrice(invoice.subtotal_amount as number || totalAmount, currency), { x: 455, y, size: 11, font: regular, color: dark });
  y -= 20;
  page.drawText("Discount", { x: 360, y, size: 11, font: regular, color: dark });
  page.drawText(formatPrice(invoice.discount_amount as number || 0, currency), { x: 455, y, size: 11, font: regular, color: dark });
  y -= 20;
  page.drawText("Tax", { x: 360, y, size: 11, font: regular, color: dark });
  page.drawText(formatPrice(invoice.tax_amount as number || 0, currency), { x: 455, y, size: 11, font: regular, color: dark });
  y -= 26;
  page.drawText("Total", { x: 360, y, size: 11, font: bold, color: dark });
  page.drawText(formatPrice(totalAmount, currency), { x: 455, y, size: 11, font: bold, color: dark });
  y -= 24;
  page.drawText("Paid", { x: 360, y, size: 11, font: bold, color: dark });
  page.drawText(formatPrice(amountPaid, currency), { x: 455, y, size: 11, font: bold, color: dark });
  y -= 24;
  page.drawText("Due", { x: 360, y, size: 11, font: bold, color: dark });
  page.drawText(formatPrice(amountDue, currency), { x: 455, y, size: 11, font: bold, color: dark });

  page.drawText("Thank you for choosing Apex Performance Club.", { x: 48, y: 80, size: 11, font: bold, color: dark });
  page.drawText("This is a computer-generated SaaS subscription invoice.", { x: 48, y: 62, size: 9, font: regular, color: muted });

  const pdfBytes = await pdf.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="subscription-invoice-${invoiceNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
