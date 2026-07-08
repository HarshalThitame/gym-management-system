import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayPaymentLink, cancelRazorpayPaymentLink } from "@/features/billing/razorpay/razorpay-service";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";

export type GeneratePaymentLinkInput = {
  organizationId: string;
  invoiceId: string;
  memberName: string;
  memberEmail: string;
  memberPhone?: string;
  amount: number;
  description: string;
};

export type PaymentLinkResult = {
  ok: boolean;
  url?: string;
  linkId?: string;
  message?: string;
};

const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/member/membership?payment_success=1`;

export async function generateInvoicePaymentLink(input: GeneratePaymentLinkInput): Promise<PaymentLinkResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Supabase admin client not configured" };

  const result = await createRazorpayPaymentLink({
    amountInRupees: input.amount,
    currency: "INR",
    description: input.description,
    customerName: input.memberName,
    customerEmail: input.memberEmail,
    customerPhone: input.memberPhone,
    callbackUrl,
    notes: {
      organization_id: input.organizationId,
      invoice_id: input.invoiceId,
      source: "payment_link",
    },
  });

  if (!result.ok) {
    billingLogger.error("generateInvoicePaymentLink", "Failed to create payment link", { invoiceId: input.invoiceId, error: result.message });
    return { ok: false, message: result.message };
  }

  await admin.from("invoices").update({
    razorpay_order_id: result.data.id,
    payment_link: result.data.shortUrl,
  } as never).eq("id", input.invoiceId);

  billingLogger.info("generateInvoicePaymentLink", "Payment link created", { invoiceId: input.invoiceId, linkId: result.data.id, url: result.data.shortUrl });

  return { ok: true, url: result.data.shortUrl, linkId: result.data.id };
}

export async function regenerateInvoicePaymentLink(input: GeneratePaymentLinkInput, oldLinkId: string): Promise<PaymentLinkResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Supabase admin client not configured" };

  const cancelResult = await cancelRazorpayPaymentLink(oldLinkId);
  if (!cancelResult.ok) {
    billingLogger.warn("regenerateInvoicePaymentLink", "Failed to cancel old link, proceeding with new", { oldLinkId, error: cancelResult.message });
  }

  return generateInvoicePaymentLink(input);
}

export async function sendPaymentLinkByEmail(input: {
  memberEmail: string;
  memberName: string;
  invoiceNumber: string;
  paymentUrl: string;
  amount: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { sent, reason } = await sendEmail({
    to: input.memberEmail,
    subject: `Payment link for invoice ${input.invoiceNumber}`,
    html: `
      <p>Hi ${input.memberName},</p>
      <p>A payment link has been generated for your invoice <strong>${input.invoiceNumber}</strong> (${input.amount}).</p>
      <p>Click the button below to complete your payment:</p>
      <p><a href="${input.paymentUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">Pay Now</a></p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${input.paymentUrl}">${input.paymentUrl}</a></p>
      <p>This link will expire after the payment is completed.</p>
    `,
  });

  if (!sent) {
    billingLogger.error("sendPaymentLinkByEmail", "Failed to send payment link email", { email: input.memberEmail, reason });
    return { ok: false, message: reason ?? "Failed to send email" };
  }

  billingLogger.info("sendPaymentLinkByEmail", "Payment link emailed", { email: input.memberEmail, invoiceNumber: input.invoiceNumber });
  return { ok: true };
}
