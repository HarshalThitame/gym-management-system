import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateReceiptPdf } from "@/features/billing/lib/receipt-pdf";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";

type PaymentReceiptInfo = {
  paymentId: string;
  invoiceId: string;
  memberId: string;
  amount: number;
  razorpayPaymentId: string;
  provider?: string;
};

export async function sendPaymentReceipt(info: PaymentReceiptInfo): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    billingLogger.error("sendPaymentReceipt", "Supabase admin client not configured");
    return;
  }

  const { data: member } = await admin
    .from("members")
    .select("full_name, member_code, email")
    .eq("id", info.memberId)
    .maybeSingle() as never as {
    data: { full_name: string; member_code: string; email: string | null } | null;
    error: { message: string } | null;
  };

  if (!member || !member.email) {
    billingLogger.warn("sendPaymentReceipt", "Member has no email, skipping receipt", { memberId: info.memberId });
    return;
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("invoice_number, currency, notes")
    .eq("id", info.invoiceId)
    .maybeSingle() as never as {
    data: { invoice_number: string; currency: string; notes: string | null } | null;
    error: { message: string } | null;
  };

  const receiptNumber = invoice?.invoice_number ?? `RCP-${info.invoiceId.slice(0, 8)}`;
  const currency = invoice?.currency ?? "INR";
  const description = invoice?.notes ?? "Membership payment";

  // Resolve provider from payment record if not passed
  let provider = info.provider || "Razorpay";
  if (!info.provider) {
    const { data: payment } = await admin
      .from("payments")
      .select("provider")
      .eq("id", info.paymentId)
      .maybeSingle() as never as {
      data: { provider: string } | null;
      error: { message: string } | null;
    };
    if (payment?.provider) {
      provider = payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1);
    }
  }

  const pdfBytes = await generateReceiptPdf({
    receiptNumber,
    paymentDate: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
    memberName: member.full_name,
    memberCode: member.member_code,
    memberEmail: member.email,
    description,
    amount: info.amount,
    currency,
    paymentMethod: provider,
    razorpayPaymentId: info.razorpayPaymentId,
  });

  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  const { sent } = await sendEmail({
    to: member.email,
    subject: `Payment Receipt — ${receiptNumber}`,
    html: `
      <p>Hi ${member.full_name},</p>
      <p>Your payment of <strong>${(info.amount / 100).toFixed(2)} ${currency}</strong> via ${provider} has been received successfully.</p>
      <p>Receipt: <strong>${receiptNumber}</strong></p>
      <p>Please find the receipt attached to this email.</p>
      <p>Thank you,<br/>Your Gym Team</p>
    `,
    attachments: pdfBase64
      ? [{ filename: `receipt-${receiptNumber}.pdf`, content: pdfBase64 }]
      : undefined,
  });

  if (!sent) {
    billingLogger.error("sendPaymentReceipt", "Failed to send receipt email", { memberId: info.memberId, invoiceId: info.invoiceId });
  }
}
