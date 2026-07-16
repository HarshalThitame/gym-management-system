import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, createRazorpayPaymentLink } from "@/features/billing/razorpay/razorpay-service";
import { resolveRazorpayCredentialsForGym } from "@/features/billing/razorpay/razorpay-provider-config";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";

export type DunningActionResult =
  | { ok: true; message: string; url?: string }
  | { ok: false; message: string };

const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/member/membership?payment_success=1`;

export async function adminRetryDunningInvoice(invoiceId: string): Promise<DunningActionResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, member_id, total_amount, amount_due, status, invoice_number, dunning_attempts, dunning_status, razorpay_order_id, gym_id")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: {
      id: string;
      member_id: string;
      total_amount: number | null;
      amount_due: number;
      status: string;
      invoice_number: string;
      dunning_attempts: number;
      dunning_status: string | null;
      razorpay_order_id: string | null;
      gym_id: string | null;
    } | null;
    error: { message: string } | null;
  };

  if (!invoice) return { ok: false, message: "Invoice not found" };
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return { ok: false, message: `Invoice is ${invoice.status}` };
  }
  if (invoice.razorpay_order_id) {
    return { ok: false, message: "A Razorpay order already exists for this invoice. Revoke it first or use a new checkout link." };
  }

  const { data: member } = await admin
    .from("members")
    .select("full_name, email")
    .eq("id", invoice.member_id)
    .maybeSingle() as never as {
    data: { full_name: string; email: string | null } | null;
    error: { message: string } | null;
  };

  if (!member) return { ok: false, message: "Member not found" };

  const amount = invoice.total_amount ?? invoice.amount_due;
  const gymId = invoice.gym_id;
  if (!gymId) {
    return { ok: false, message: "Gym is missing for this invoice" };
  }

  const credentials = await resolveRazorpayCredentialsForGym(gymId);
  if (!credentials) {
    return { ok: false, message: "Razorpay is not configured for this gym" };
  }

  const orderResult = await createRazorpayOrder({
    amountInRupees: amount / 100,
    currency: "INR",
    receipt: `MEM-DUN-${invoiceId.slice(0, 8)}-${Date.now()}`,
    notes: { invoice_id: invoiceId, member_id: invoice.member_id, type: "admin_dunning_retry" },
  }, credentials);

  if (!orderResult.ok) {
    billingLogger.error("adminRetryDunningInvoice", "Failed to create Razorpay order", { invoiceId, error: orderResult.message });
    return { ok: false, message: orderResult.message };
  }

  const now = new Date().toISOString();
  const nextRetry = new Date();
  nextRetry.setDate(nextRetry.getDate() + 3);

  await admin.from("invoices").update({
    razorpay_order_id: orderResult.data.id,
    dunning_status: "retry_scheduled",
    dunning_attempts: (invoice.dunning_attempts ?? 0) + 1,
    dunning_last_attempt_at: now,
    dunning_next_retry_at: nextRetry.toISOString(),
  } as never).eq("id", invoiceId);

  const linkResult = await createRazorpayPaymentLink({
    amountInRupees: amount / 100,
    currency: "INR",
    description: `Invoice ${invoice.invoice_number}`,
    customerName: member.full_name,
    customerEmail: member.email || "",
    callbackUrl,
    notes: {
      invoice_id: invoiceId,
      member_id: invoice.member_id,
      source: "dunning_retry",
    },
  }, credentials);

  let paymentUrl: string | undefined;
  if (linkResult.ok) {
    paymentUrl = linkResult.data.shortUrl;
  } else {
    billingLogger.warn("adminRetryDunningInvoice", "Payment link creation failed — order created but no shareable URL", { invoiceId, error: linkResult.message });
  }

  await admin.from("billing_events").insert({
    gym_id: invoice.gym_id,
    event_type: "dunning_retry_initiated",
    entity_type: "invoice",
    entity_id: invoiceId,
    status: "recorded",
    metadata: { razorpayOrderId: orderResult.data.id, attempt: (invoice.dunning_attempts ?? 0) + 1, triggeredBy: "admin" },
  } as never);

  if (member.email && paymentUrl) {
    sendEmail({
      to: member.email,
      subject: "Payment retry initiated — complete your payment",
      html: `
        <p>Hi ${member.full_name},</p>
        <p>A payment retry has been initiated for your invoice.</p>
        <p>Amount due: ₹${(amount / 100).toFixed(2)}</p>
        <p>Click the link below to complete your payment:</p>
        <p><a href="${paymentUrl}">${paymentUrl}</a></p>
        <p>If you have any questions, please contact your gym.</p>
      `,
    });
  }

  billingLogger.info("adminRetryDunningInvoice", "Dunning retry completed", { invoiceId, orderId: orderResult.data.id, paymentUrl });
  return { ok: true, message: "Retry order created. Payment link is ready.", url: paymentUrl };
}

export async function adminExtendGracePeriod(invoiceId: string, newGraceEnd: string): Promise<DunningActionResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, member_id, gym_id")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: { id: string; member_id: string; gym_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!invoice) return { ok: false, message: "Invoice not found" };

  await admin.from("invoices").update({
    dunning_status: "grace_period",
    dunning_grace_period_ends_at: newGraceEnd,
  } as never).eq("id", invoiceId);

  await admin.from("billing_events").insert({
    gym_id: invoice.gym_id,
    event_type: "dunning_grace_extended",
    entity_type: "invoice",
    entity_id: invoiceId,
    status: "recorded",
    metadata: { newGraceEnd, triggeredBy: "admin" },
  } as never);

  const { data: member } = await admin
    .from("members")
    .select("full_name, email")
    .eq("id", invoice.member_id)
    .maybeSingle() as never as {
    data: { full_name: string; email: string | null } | null;
    error: { message: string } | null;
  };

  if (member?.email) {
    sendEmail({
      to: member.email,
      subject: "Your payment due date has been extended",
      html: `
        <p>Hi ${member.full_name},</p>
        <p>Your grace period has been extended to ${new Date(newGraceEnd).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}.</p>
        <p>Please complete your payment before this date to avoid any disruption to your membership.</p>
      `,
    });
  }

  return { ok: true, message: "Grace period extended" };
}

export async function adminWaiveDunning(invoiceId: string): Promise<DunningActionResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, member_id, gym_id")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: { id: string; member_id: string; gym_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!invoice) return { ok: false, message: "Invoice not found" };

  await admin.from("invoices").update({
    dunning_status: "waived",
    dunning_next_retry_at: null,
  } as never).eq("id", invoiceId);

  await admin.from("billing_events").insert({
    gym_id: invoice.gym_id,
    event_type: "dunning_waived",
    entity_type: "invoice",
    entity_id: invoiceId,
    status: "recorded",
    metadata: { triggeredBy: "admin" },
  } as never);

  const { data: member } = await admin
    .from("members")
    .select("full_name, email")
    .eq("id", invoice.member_id)
    .maybeSingle() as never as {
    data: { full_name: string; email: string | null } | null;
    error: { message: string } | null;
  };

  if (member?.email) {
    sendEmail({
      to: member.email,
      subject: "Outstanding payment has been waived",
      html: `
        <p>Hi ${member.full_name},</p>
        <p>Your outstanding invoice has been waived. No further action is needed from your end.</p>
        <p>If you have any questions, please contact your gym.</p>
      `,
    });
  }

  return { ok: true, message: "Dunning waived. No further retries will occur." };
}

export async function adminMarkDunningResolved(invoiceId: string): Promise<DunningActionResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, member_id, gym_id")
    .eq("id", invoiceId)
    .maybeSingle() as never as {
    data: { id: string; member_id: string; gym_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!invoice) return { ok: false, message: "Invoice not found" };

  await admin.from("invoices").update({
    dunning_status: "resolved",
    dunning_next_retry_at: null,
  } as never).eq("id", invoiceId);

  await admin.from("billing_events").insert({
    gym_id: invoice.gym_id,
    event_type: "dunning_resolved",
    entity_type: "invoice",
    entity_id: invoiceId,
    status: "recorded",
    metadata: { triggeredBy: "admin" },
  } as never);

  const { data: member } = await admin
    .from("members")
    .select("full_name, email")
    .eq("id", invoice.member_id)
    .maybeSingle() as never as {
    data: { full_name: string; email: string | null } | null;
    error: { message: string } | null;
  };

  if (member?.email) {
    sendEmail({
      to: member.email,
      subject: "Your invoice has been resolved",
      html: `
        <p>Hi ${member.full_name},</p>
        <p>Your invoice has been marked as resolved by the gym admin.</p>
        <p>If you have any questions, please contact your gym.</p>
      `,
    });
  }

  return { ok: true, message: "Invoice marked as resolved." };
}
