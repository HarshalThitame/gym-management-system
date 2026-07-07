import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";

type RetryResult = {
  retried: number;
  suspended: number;
  recovered: number;
  errors: string[];
};

type RetryInvoiceRow = {
  id: string;
  gym_id: string | null;
  member_id: string;
  membership_id: string | null;
  invoice_number: string;
  status: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_due: number;
  dunning_status: string | null;
  dunning_attempts: number;
  dunning_next_retry_at: string | null;
  dunning_grace_period_ends_at: string | null;
  razorpay_order_id: string | null;
  due_at: string | null;
};

type MemberRow = {
  id: string;
  full_name: string;
  email: string | null;
  gym_id: string | null;
};

type MembershipRow = {
  id: string;
  status: string;
  end_date: string;
  membership_plan_id: string;
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_DAYS = [3, 5, 7];

export async function runMemberPaymentRetry(): Promise<RetryResult> {
  const result: RetryResult = { retried: 0, suspended: 0, recovered: 0, errors: [] };
  const admin = getSupabaseAdminClient();
  if (!admin) {
    result.errors.push("Supabase admin client not configured");
    return result;
  }

  const now = new Date();

  const { data: dueInvoices } = await admin
    .from("invoices")
    .select("*")
    .not("dunning_next_retry_at", "is", null)
    .in("status", ["issued", "partially_paid"])
    .lte("dunning_next_retry_at", now.toISOString())
    .limit(50) as never as {
    data: RetryInvoiceRow[] | null;
    error: { message: string } | null;
  };

  if (!dueInvoices || dueInvoices.length === 0) {
    return result;
  }

  const memberIds = [...new Set(dueInvoices.map((inv) => inv.member_id))];

  const { data: memberData } = await admin
    .from("members")
    .select("id, full_name, email, gym_id")
    .in("id", memberIds) as never as {
    data: MemberRow[] | null;
    error: { message: string } | null;
  };

  const memberMap = new Map<string, MemberRow>((memberData ?? []).map((m) => [m.id, m]));

  for (const invoice of dueInvoices) {
    try {
      const member = memberMap.get(invoice.member_id);
      if (!member || !member.email) {
        await skipInvoice(admin, invoice.id, "No member email for dunning");
        continue;
      }

      const nextAttempt = (invoice.dunning_attempts || 0) + 1;

      const orderResult = await createRazorpayOrder({
        amountInRupees: invoice.amount_due || invoice.total_amount,
        currency: "INR",
        receipt: `MEM-DUN-${invoice.id.slice(0, 8)}-${Date.now()}`,
        notes: {
          type: "member_dunning_retry",
          invoice_id: invoice.id,
          member_id: invoice.member_id,
          membership_id: invoice.membership_id ?? undefined,
          attempt: nextAttempt,
        },
      });

      if (!orderResult || !orderResult.id) {
        if (nextAttempt >= MAX_RETRY_ATTEMPTS) {
          await suspendMembership(admin, invoice, member, "Dunning exhausted");
          result.suspended++;
        } else {
          await scheduleRetry(admin, invoice.id, nextAttempt, member, "Payment retry failed");
          result.retried++;
        }
        continue;
      }

      await admin.from("invoices").update({
        razorpay_order_id: orderResult.id,
        dunning_status: "retry_scheduled",
        dunning_attempts: nextAttempt,
        dunning_last_attempt_at: now.toISOString(),
      } as never).eq("id", invoice.id);

      const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/member/membership?invoice=${invoice.id}`;
      const emailSubject = nextAttempt === 1
        ? "Payment reminder — membership renewal"
        : nextAttempt === 2
          ? "Second notice — payment still due"
          : "Final notice — membership will be suspended";

      await sendEmail({
        to: member.email,
        subject: emailSubject,
        html: `
          <p>Hi ${member.full_name},</p>
          <p>Your recent membership payment of <strong>₹${((invoice.amount_due || invoice.total_amount) / 100).toFixed(2)}</strong> could not be processed (Attempt ${nextAttempt}/${MAX_RETRY_ATTEMPTS}).</p>
          <p>Please complete your payment to keep your membership active:</p>
          <p><a href="${paymentUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">Pay Now</a></p>
          ${nextAttempt >= MAX_RETRY_ATTEMPTS ? "<p><strong>This is your final notice.</strong> Your membership will be suspended if payment is not received.</p>" : ""}
        `,
      });

      result.recovered++;
      billingLogger.info("runMemberPaymentRetry", "Payment retry order created", {
        invoiceId: invoice.id,
        attempt: nextAttempt,
        orderId: orderResult.id,
      });
    } catch (err) {
      result.errors.push(`Invoice ${invoice.id}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return result;
}

async function scheduleRetry(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  invoiceId: string,
  attempt: number,
  member: MemberRow,
  reason: string,
): Promise<void> {
  const now = new Date();
  const delayDays = RETRY_DELAY_DAYS[Math.min(attempt - 1, RETRY_DELAY_DAYS.length - 1)];
  const nextRetry = new Date(now);
  nextRetry.setDate(nextRetry.getDate() + delayDays);

  await admin.from("invoices").update({
    dunning_status: "retry_scheduled",
    dunning_attempts: attempt,
    dunning_last_attempt_at: now.toISOString(),
    dunning_last_failure_reason: reason,
    dunning_next_retry_at: nextRetry.toISOString(),
  } as never).eq("id", invoiceId);
}

async function suspendMembership(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  invoice: RetryInvoiceRow,
  member: MemberRow,
  reason: string,
): Promise<void> {
  const now = new Date();

  await admin.from("invoices").update({
    dunning_status: "failed",
    dunning_attempts: (invoice.dunning_attempts || 0) + 1,
    dunning_last_attempt_at: now.toISOString(),
    dunning_last_failure_reason: reason,
    dunning_next_retry_at: null,
  } as never).eq("id", invoice.id);

  if (invoice.membership_id) {
    const { data: membership } = await admin
      .from("memberships")
      .select("id, status")
      .eq("id", invoice.membership_id)
      .maybeSingle() as never as {
      data: { id: string; status: string } | null;
      error: { message: string } | null;
    };

    if (membership && membership.status === "active") {
      await admin.from("memberships").update({
        status: "suspended",
        suspended_at: now.toISOString(),
      } as never).eq("id", membership.id);

      await admin.from("billing_events").insert({
        gym_id: member.gym_id,
        event_type: "payment_failed",
        entity_type: "membership",
        entity_id: membership.id,
        status: "recorded",
        metadata: {
          invoiceId: invoice.id,
          reason: "Dunning exhausted",
          dunningAttempts: (invoice.dunning_attempts || 0) + 1,
        },
      } as never);
    }
  }

  if (member.email) {
    await sendEmail({
      to: member.email,
      subject: "Membership suspended due to non-payment",
      html: `
        <p>Hi ${member.full_name},</p>
        <p>Your membership has been <strong>suspended</strong> because payment could not be processed after multiple attempts.</p>
        <p>Please contact your gym front desk to reactivate your membership and arrange payment.</p>
      `,
    });
  }

  billingLogger.info("suspendMembership", "Membership suspended for non-payment", {
    invoiceId: invoice.id,
    membershipId: invoice.membership_id,
    memberId: member.id,
  });
}

async function skipInvoice(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  invoiceId: string,
  reason: string,
): Promise<void> {
  await admin.from("invoices").update({
    dunning_status: "failed",
    dunning_next_retry_at: null,
    dunning_last_failure_reason: reason,
  } as never).eq("id", invoiceId);
}
