/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function formatPrice(paise: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = getSupabaseAdminClient() as any;
  if (!adminDb) return NextResponse.json({ error: "Server config error" }, { status: 503 });

  const { id } = await params;

  const { data: invoice } = await adminDb.from("org_subscription_invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const orgId = invoice.organization_id as string;

  // Check access: Super Admin or org owner
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id as never).maybeSingle();
  const profileOrgId = (profile as unknown as { organization_id: string } | null)?.organization_id;
  // Simple check: if user's profile org doesn't match, check if they're super admin via a profiles check
  const { data: userRoles } = await supabase.from("user_roles" as never).select("role_id").eq("user_id", user.id as never).limit(1) as any;
  const isSuperAdminCheck = userRoles?.some((r: any) => r.role_id === "super_admin");

  if (profileOrgId !== orgId && !isSuperAdminCheck) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: org } = await adminDb.from("organizations").select("*").eq("id", orgId).maybeSingle();
  const orgName = (org?.name as string) || "Organization";
  const totalAmount = (invoice.total_amount as number) || (invoice.subtotal_amount as number) || 0;
  const amountPaid = (invoice.amount_paid as number) || 0;
  const amountDue = (invoice.amount_due as number) || totalAmount - amountPaid;
  const invoiceNumber = (invoice.invoice_number as string) || id;
  const isPaid = invoice.status === "paid" || !!invoice.paid_at;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const dark = rgb(0.067, 0.071, 0.078);
  const muted = rgb(0.37, 0.39, 0.43);
  const green = rgb(0.09, 0.63, 0.25);
  let y = 780;

  // Header
  page.drawText("Gym Management SaaS", { x: 48, y, size: 20, font: bold, color: dark });
  page.drawText(isPaid ? "PAID RECEIPT" : "SUBSCRIPTION INVOICE", { x: 48, y: y - 22, size: 10, font: regular, color: muted });
  page.drawText(isPaid ? "RECEIPT" : "INVOICE", { x: 455, y, size: 22, font: bold, color: isPaid ? green : dark });
  page.drawText(invoiceNumber, { x: 455, y: y - 22, size: 10, font: regular, color: muted });
  y -= 70;

  // Status badge
  if (isPaid) {
    page.drawRectangle({ x: 455, y: y - 8, width: 92, height: 20, color: green });
    page.drawText("PAID", { x: 480, y: y - 5, size: 12, font: bold, color: rgb(1, 1, 1) });
    y -= 36;
  }

  // Bill To
  page.drawText("Bill To", { x: 48, y, size: 9, font: regular, color: muted });
  page.drawText(orgName.slice(0, 36), { x: 48, y: y - 17, size: 12, font: bold, color: dark });
  if (org?.billing_email) page.drawText((org.billing_email as string), { x: 48, y: y - 34, size: 9, font: regular, color: muted });
  y -= 60;

  // Period + Details
  page.drawText("Billing Period", { x: 48, y, size: 9, font: regular, color: muted });
  const ps = (invoice.billing_period_start as string)?.slice(0, 10) ?? "-";
  const pe = (invoice.billing_period_end as string)?.slice(0, 10) ?? "-";
  page.drawText(`${ps} to ${pe}`, { x: 48, y: y - 17, size: 12, font: bold, color: dark });

  page.drawText("Billing Cycle", { x: 250, y, size: 9, font: regular, color: muted });
  page.drawText((invoice.billing_cycle as string) || "—", { x: 250, y: y - 17, size: 12, font: bold, color: dark });

  page.drawText("Due Date", { x: 400, y, size: 9, font: regular, color: muted });
  const dueDate = (invoice.due_at as string)?.slice(0, 10) ?? "-";
  page.drawText(dueDate, { x: 400, y: y - 17, size: 12, font: bold, color: dark });
  y -= 56;

  const currency = (invoice.currency as string) || "INR";

  // Table header
  page.drawRectangle({ x: 48, y: y - 8, width: 499, height: 28, color: rgb(0.94, 0.95, 0.92) });
  page.drawText("Description", { x: 60, y, size: 10, font: bold, color: dark });
  page.drawText("Amount", { x: 455, y, size: 10, font: bold, color: dark });
  y -= 30;

  page.drawText(`Subscription (${invoiceNumber})`, { x: 60, y, size: 10, font: regular, color: dark });
  page.drawText(formatPrice(totalAmount, currency), { x: 455, y, size: 10, font: regular, color: dark });
  y -= 24;

  // Totals
  y -= 34;
  page.drawText("Subtotal", { x: 360, y, size: 11, font: regular, color: dark });
  page.drawText(formatPrice(invoice.subtotal_amount as number || totalAmount, currency), { x: 455, y, size: 11, font: regular, color: dark });
  y -= 20;
  page.drawText("Discount", { x: 360, y, size: 11, font: regular, color: dark });
  page.drawText(formatPrice(invoice.discount_amount as number || 0, currency), { x: 455, y, size: 11, font: regular, color: dark });
  y -= 20;
  page.drawText("Tax (GST)", { x: 360, y, size: 11, font: regular, color: dark });
  page.drawText(formatPrice(invoice.tax_amount as number || 0, currency), { x: 455, y, size: 11, font: regular, color: dark });
  y -= 26;
  page.drawText("Total", { x: 360, y, size: 11, font: bold, color: dark });
  page.drawText(formatPrice(totalAmount, currency), { x: 455, y, size: 11, font: bold, color: dark });
  y -= 20;
  page.drawText("Amount Paid", { x: 360, y, size: 11, font: bold, color: isPaid ? green : dark });
  page.drawText(formatPrice(amountPaid, currency), { x: 455, y, size: 11, font: bold, color: isPaid ? green : dark });
  y -= 20;
  page.drawText("Balance Due", { x: 360, y, size: 11, font: bold, color: dark });
  page.drawText(formatPrice(amountDue, currency), { x: 455, y, size: 11, font: bold, color: dark });

  // Razorpay refs
  y -= 50;
  if (invoice.razorpay_order_id) {
    page.drawText("Razorpay Order ID", { x: 48, y, size: 8, font: regular, color: muted });
    page.drawText((invoice.razorpay_order_id as string).slice(0, 40), { x: 48, y: y - 12, size: 8, font: regular, color: dark });
    y -= 30;
  }
  if (invoice.razorpay_payment_id) {
    page.drawText("Razorpay Payment ID", { x: 48, y, size: 8, font: regular, color: muted });
    page.drawText((invoice.razorpay_payment_id as string).slice(0, 40), { x: 48, y: y - 12, size: 8, font: regular, color: dark });
    y -= 30;
  }

  page.drawText("Thank you for your business.", { x: 48, y: 80, size: 11, font: bold, color: dark });
  page.drawText("This is a computer-generated invoice/receipt.", { x: 48, y: 62, size: 9, font: regular, color: muted });

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${isPaid ? "receipt" : "invoice"}-${invoiceNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
