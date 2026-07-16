import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateInvoicePaymentLink, regenerateInvoicePaymentLink, sendPaymentLinkByEmail } from "@/features/billing/services/payment-link-service";
import { cancelRazorpayPaymentLink } from "@/features/billing/razorpay/razorpay-service";
import { resolveRazorpayCredentialsForGym } from "@/features/billing/razorpay/razorpay-provider-config";

async function getAuthAndInvoice() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, organization_id")
    .eq("id", user.id)
    .maybeSingle() as never as {
    data: { gym_id: string | null; organization_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!profile?.gym_id) return { error: NextResponse.json({ error: "No gym scope assigned" }, { status: 403 }) };

  const admin = getSupabaseAdminClient();
  if (!admin) return { error: NextResponse.json({ error: "Database connection failed" }, { status: 500 }) };

  return { supabase, admin, user, profile, error: null as NextResponse | null };
}

export async function POST(request: Request) {
  const ctx = await getAuthAndInvoice();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const body = await request.json();
  const { invoiceId, action } = body as { invoiceId?: string; action?: "regenerate" | "revoke" };

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, member_id, total_amount, status, notes, membership_id, gym_id, organization_id, razorpay_order_id, invoice_number")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: {
      id: string;
      member_id: string;
      total_amount: number;
      status: string;
      notes: string | null;
      membership_id: string | null;
      gym_id: string | null;
      organization_id: string | null;
      razorpay_order_id: string | null;
      invoice_number: string;
    } | null;
    error: { message: string } | null;
  };

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Invoice does not belong to your gym" }, { status: 403 });
  }

  if (action === "revoke") {
    if (!invoice.razorpay_order_id) {
      return NextResponse.json({ error: "No payment link to revoke" }, { status: 400 });
    }

    const credentials = await resolveRazorpayCredentialsForGym(invoice.gym_id ?? profile.gym_id ?? "");
    const cancelResult = await cancelRazorpayPaymentLink(invoice.razorpay_order_id, credentials);
    if (!cancelResult.ok) {
      return NextResponse.json({ error: cancelResult.message }, { status: 500 });
    }

    await admin.from("invoices").update({ razorpay_order_id: null, payment_link: null } as never).eq("id", invoice.id);

    return NextResponse.json({ ok: true, message: "Payment link cancelled" });
  }

  const { data: member } = await admin
    .from("members")
    .select("full_name, email, phone")
    .eq("id", invoice.member_id)
    .maybeSingle() as never as {
    data: { full_name: string; email: string | null; phone: string } | null;
    error: { message: string } | null;
  };

  if (!member || !member.email) {
    return NextResponse.json({ error: "Member not found or has no email" }, { status: 404 });
  }

  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return NextResponse.json({ error: `Invoice is already ${invoice.status}` }, { status: 400 });
  }

  const linkInput = {
    gymId: invoice.gym_id ?? profile.gym_id ?? "",
    organizationId: invoice.organization_id ?? profile.organization_id ?? "",
    invoiceId: invoice.id,
    memberName: member.full_name,
    memberEmail: member.email,
    memberPhone: member.phone,
    amount: invoice.total_amount,
    description: invoice.notes || `Membership invoice ${invoiceId.slice(0, 8)}`,
  };

  let result;
  if (action === "regenerate" && invoice.razorpay_order_id) {
    result = await regenerateInvoicePaymentLink(linkInput, invoice.razorpay_order_id);
  } else {
    if (invoice.razorpay_order_id) {
      return NextResponse.json({
        ok: true,
        message: "Payment link already exists",
        linkId: invoice.razorpay_order_id,
      });
    }
    result = await generateInvoicePaymentLink(linkInput);
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: result.url, linkId: result.linkId, invoiceNumber: invoice.invoice_number, memberEmail: member.email, memberName: member.full_name });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthAndInvoice();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const body = await request.json();
  const { invoiceId } = body as { invoiceId?: string };

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, member_id, total_amount, status, gym_id, razorpay_order_id, invoice_number")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: {
      id: string;
      member_id: string;
      total_amount: number;
      status: string;
      gym_id: string | null;
      razorpay_order_id: string | null;
      invoice_number: string;
    } | null;
    error: { message: string } | null;
  };

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Invoice does not belong to your gym" }, { status: 403 });
  }

  if (!invoice.razorpay_order_id) {
    return NextResponse.json({ error: "No payment link to send. Generate one first." }, { status: 400 });
  }

  const { data: member } = await admin
    .from("members")
    .select("full_name, email")
    .eq("id", invoice.member_id)
    .maybeSingle() as never as {
    data: { full_name: string; email: string | null } | null;
    error: { message: string } | null;
  };

  if (!member?.email) {
    return NextResponse.json({ error: "Member has no email address" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const result = await sendPaymentLinkByEmail({
    memberEmail: member.email,
    memberName: member.full_name,
    invoiceNumber: invoice.invoice_number,
    paymentUrl: `${appUrl}/pay?link=${invoice.razorpay_order_id}`,
    amount: `₹${(invoice.total_amount / 100).toFixed(2)}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message ?? "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Payment link sent to member's email" });
}
