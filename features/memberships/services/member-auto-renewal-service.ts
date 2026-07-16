import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import { resolveRazorpayCredentialsForGym } from "@/features/billing/razorpay/razorpay-provider-config";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";

type AutoRenewResult = {
  renewed: number;
  skipped: number;
  errors: string[];
};

type MembershipRow = {
  id: string;
  gym_id: string;
  member_id: string;
  membership_plan_id: string;
  status: string;
  start_date: string;
  end_date: string;
  price_amount: number;
  joining_fee_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_status: string;
  auto_renew: boolean;
};

type MemberRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
};

type PlanRow = {
  id: string;
  name: string;
  plan_type: string;
  duration_days: number;
  price_amount: number;
  currency: string;
};

const RENEWAL_WINDOW_DAYS = 7;

export async function runMemberAutoRenewal(): Promise<AutoRenewResult> {
  const result: AutoRenewResult = { renewed: 0, skipped: 0, errors: [] };
  const admin = getSupabaseAdminClient();
  if (!admin) {
    result.errors.push("Supabase admin client not configured");
    return result;
  }

  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + RENEWAL_WINDOW_DAYS);

  const { data: dueMemberships } = await admin
    .from("memberships")
    .select("*, members!inner(*), membership_plans!inner(*)")
    .eq("auto_renew", true)
    .eq("status", "active")
    .gte("end_date", now.toISOString().slice(0, 10))
    .lte("end_date", windowEnd.toISOString().slice(0, 10))
    .is("last_renewed_by_cron_at", null)
    .limit(50) as never as {
    data: Array<MembershipRow & { members: MemberRow; membership_plans: PlanRow }> | null;
    error: { message: string } | null;
  };

  if (!dueMemberships || dueMemberships.length === 0) {
    billingLogger.info("runMemberAutoRenewal", "No memberships due for auto-renewal");
    return result;
  }

  for (const membership of dueMemberships) {
    try {
      const ok = await processSingleAutoRenewal(admin, membership);
      if (ok) result.renewed++;
      else result.skipped++;
    } catch (err) {
      result.errors.push(`Membership ${membership.id}: ${err instanceof Error ? err.message : "Unknown"}`);
      billingLogger.error("runMemberAutoRenewal", "Auto-renewal failed", { membershipId: membership.id, error: err });
    }
  }

  return result;
}

async function processSingleAutoRenewal(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  row: MembershipRow & { members: MemberRow; membership_plans: PlanRow },
): Promise<boolean> {
  const membership = row;
  const member = row.members;
  const plan = row.membership_plans;

  // Skip if member has an active subscription (Razorpay handles charging)
  const { data: existingSub } = await admin
    .from("member_subscriptions")
    .select("id")
    .eq("membership_id", membership.id)
    .eq("status", "active")
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (existingSub) {
    billingLogger.info("processSingleAutoRenewal", "Membership has active subscription, skipping", { membershipId: membership.id });
    await admin.from("memberships").update({ last_renewed_by_cron_at: new Date().toISOString() } as never).eq("id", membership.id);
    return true;
  }

  if (!member.email) {
    billingLogger.warn("processSingleAutoRenewal", "Member has no email, skipping", { memberId: member.id });
    await admin.from("memberships").update({ last_renewed_by_cron_at: new Date().toISOString() } as never).eq("id", membership.id);
    return false;
  }

  const subtotalAmount = plan.price_amount;
  const totalAmount = Math.max(subtotalAmount, 0);

  const invoiceNumber = await generateInvoiceNumber(admin, membership.gym_id);
  if (!invoiceNumber) {
    billingLogger.error("processSingleAutoRenewal", "Failed to generate invoice number", { gymId: membership.gym_id });
    return false;
  }

  const now = new Date();
  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + 3);

  const { data: invoice } = await admin
    .from("invoices")
    .insert({
      gym_id: membership.gym_id,
      member_id: membership.member_id,
      membership_id: membership.id,
      invoice_number: invoiceNumber,
      status: "issued",
      currency: plan.currency || "INR",
      subtotal_amount: subtotalAmount,
      discount_amount: 0,
      tax_amount: 0,
      amount_paid: 0,
      issued_at: now.toISOString(),
      due_at: dueAt.toISOString(),
      notes: `Auto-renewal of ${plan.name} membership.`,
    } as never)
    .select("id")
    .maybeSingle() as never as { data: { id: string } | null; error: { message: string } | null };

  if (!invoice) {
    billingLogger.error("processSingleAutoRenewal", "Failed to create invoice", { membershipId: membership.id });
    return false;
  }

  const paymentNumber = await generatePaymentNumber(admin, membership.gym_id);
  if (!paymentNumber) {
    billingLogger.error("processSingleAutoRenewal", "Failed to generate payment number", { gymId: membership.gym_id });
    return false;
  }

  const credentials = await resolveRazorpayCredentialsForGym(membership.gym_id);
  if (!credentials) {
    billingLogger.error("processSingleAutoRenewal", "Razorpay is not configured for this gym", { gymId: membership.gym_id });
    return false;
  }

  const receipt = `AUTO-${membership.gym_id.slice(0, 8)}-${Date.now()}`;
  const orderResult = await createRazorpayOrder({
    amountInRupees: totalAmount,
    currency: plan.currency || "INR",
    receipt,
    notes: {
      type: "member_auto_renewal",
      member_id: membership.member_id,
      membership_id: membership.id,
      invoice_id: invoice.id,
      gym_id: membership.gym_id,
    },
  }, credentials);

  if (!orderResult.ok) {
    billingLogger.error("processSingleAutoRenewal", "Failed to create Razorpay order", { membershipId: membership.id });
    await admin.from("invoices").update({ status: "cancelled" } as never).eq("id", invoice.id);
    return false;
  }

  const { error: payError } = await admin
    .from("payments")
    .insert({
      gym_id: membership.gym_id,
      member_id: membership.member_id,
      membership_id: membership.id,
      invoice_id: invoice.id,
      payment_number: paymentNumber,
      payment_type: "membership_renewal",
      status: "pending",
      method: "razorpay",
      provider: "razorpay",
      amount: totalAmount,
      currency: plan.currency || "INR",
      discount_amount: 0,
      tax_amount: 0,
      provider_order_id: orderResult.data.id,
      metadata: { autoRenewal: true, planName: plan.name } as never,
    } as never);

  if (payError) {
    billingLogger.error("processSingleAutoRenewal", "Failed to create payment record", { error: payError.message });
    await admin.from("invoices").update({ status: "cancelled" } as never).eq("id", invoice.id);
    return false;
  }

  await admin.from("invoices").update({ razorpay_order_id: orderResult.data.id } as never).eq("id", invoice.id);

  await admin.from("memberships").update({ last_renewed_by_cron_at: now.toISOString() } as never).eq("id", membership.id);

  const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/member/membership?invoice=${invoice.id}`;

  const emailSent = await sendEmail({
    to: member.email,
    subject: `Your ${plan.name} membership is renewing — payment due`,
    html: `
      <p>Hi ${member.full_name},</p>
      <p>Your <strong>${plan.name}</strong> membership at your gym is set to auto-renew.</p>
      <p><strong>Amount:</strong> ₹${(totalAmount / 100).toFixed(2)}</p>
      <p><strong>Due by:</strong> ${dueAt.toLocaleDateString("en-IN")}</p>
      <p>Visit your member portal to complete payment:</p>
      <p><a href="${paymentUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">Pay Now</a></p>
      <p>If you have any questions, please contact your gym front desk.</p>
    `,
  });

  if (!emailSent.sent) {
    billingLogger.warn("processSingleAutoRenewal", "Renewal email not sent", { memberId: member.id, reason: emailSent.reason });
  }

  billingLogger.info("processSingleAutoRenewal", "Auto-renewal invoice created", {
    membershipId: membership.id,
    invoiceId: invoice.id,
    orderId: orderResult.data.id,
    amount: totalAmount,
  });

  return true;
}

async function generateInvoiceNumber(admin: ReturnType<typeof getSupabaseAdminClient>, gymId: string): Promise<string | null> {
  const prefix = `AUTO-INV-${new Date().getFullYear()}-`;
  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .gte("created_at", `${new Date().getFullYear()}-01-01`) as never as {
    count: number | null;
  };

  const nextNum = ((count ?? 0) + 1).toString().padStart(6, "0");
  return `${prefix}${nextNum}`;
}

async function generatePaymentNumber(admin: ReturnType<typeof getSupabaseAdminClient>, gymId: string): Promise<string | null> {
  const prefix = `AUTO-PAY-${new Date().getFullYear()}-`;
  const { count } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .gte("created_at", `${new Date().getFullYear()}-01-01`) as never as {
    count: number | null;
  };

  const nextNum = ((count ?? 0) + 1).toString().padStart(6, "0");
  return `${prefix}${nextNum}`;
}
