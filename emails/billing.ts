import { renderBrandedEmail } from "./auth";
import { formatCurrency } from "@/features/billing/lib/money";

export function paymentSuccessEmail(input: { name: string; invoiceNumber: string; amount: number; invoiceUrl: string }) {
  return renderBrandedEmail({
    title: "Payment received",
    preview: "Your Apex payment has been recorded.",
    body: `<p>Hi ${input.name || "there"}, we received your payment of <strong>${formatCurrency(input.amount)}</strong> for invoice <strong>${input.invoiceNumber}</strong>.</p><p>Your receipt and invoice are available from your member portal.</p>`,
    ctaLabel: "View Invoice",
    ctaUrl: input.invoiceUrl
  });
}

export function invoiceEmail(input: { name: string; invoiceNumber: string; amount: number; invoiceUrl: string }) {
  return renderBrandedEmail({
    title: "Your Apex invoice",
    preview: "A new invoice is ready in your portal.",
    body: `<p>Hi ${input.name || "there"}, invoice <strong>${input.invoiceNumber}</strong> for <strong>${formatCurrency(input.amount)}</strong> is ready.</p>`,
    ctaLabel: "Download Invoice",
    ctaUrl: input.invoiceUrl
  });
}

export function refundEmail(input: { name: string; amount: number; reason: string }) {
  return renderBrandedEmail({
    title: "Refund update",
    preview: "An Apex refund has been processed.",
    body: `<p>Hi ${input.name || "there"}, a refund of <strong>${formatCurrency(input.amount)}</strong> has been processed.</p><p>Reason: ${input.reason}</p>`
  });
}
