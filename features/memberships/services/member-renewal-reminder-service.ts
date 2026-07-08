import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";

type ReminderResult = {
  sent: number;
  errors: string[];
};

type MembershipWithMember = {
  id: string;
  member_id: string;
  membership_plan_id: string;
  end_date: string;
  full_name: string;
  email: string | null;
  plan_name: string;
  gym_id: string;
};

const REMINDER_DAYS = [30, 14, 7, 3, 1];

export async function sendRenewalReminders(): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, errors: [] };
  const admin = getSupabaseAdminClient();
  if (!admin) {
    result.errors.push("Supabase admin client not configured");
    return result;
  }

  const now = new Date();

  for (const days of REMINDER_DAYS) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const targetDate = target.toISOString().slice(0, 10);

    const { data: expiring } = await admin
      .from("memberships")
      .select("id, member_id, membership_plan_id, end_date, gym_id, members!inner(full_name, email), membership_plans!inner(name)")
      .eq("status", "active")
      .eq("auto_renew", false)
      .gte("end_date", targetDate)
      .lte("end_date", targetDate)
      .limit(200) as never as {
      data: Array<{
        id: string;
        member_id: string;
        membership_plan_id: string;
        end_date: string;
        gym_id: string | null;
        members: { full_name: string; email: string | null };
        membership_plans: { name: string };
      }> | null;
      error: { message: string } | null;
    };

    if (!expiring || expiring.length === 0) continue;

    const memberships: MembershipWithMember[] = expiring.map((m) => ({
      id: m.id,
      member_id: m.member_id,
      membership_plan_id: m.membership_plan_id,
      end_date: m.end_date,
      full_name: m.members.full_name,
      email: m.members.email,
      plan_name: m.membership_plans.name,
      gym_id: m.gym_id ?? "",
    }));

    for (const ms of memberships) {
      try {
        if (!ms.email) {
          billingLogger.warn("sendRenewalReminders", "Member has no email", { memberId: ms.member_id, membershipId: ms.id });
          continue;
        }

        const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/member/membership`;
        const subjectLine = days === 1
          ? `Your ${ms.plan_name} membership expires tomorrow`
          : `Your ${ms.plan_name} membership expires in ${days} days`;

        const emailSent = await sendEmail({
          to: ms.email,
          subject: subjectLine,
          html: `
            <p>Hi ${ms.full_name},</p>
            <p>Your <strong>${ms.plan_name}</strong> membership ${days === 1 ? "expires tomorrow" : `will expire in ${days} days`} (${new Date(ms.end_date).toLocaleDateString("en-IN")}).</p>
            <p>Visit the member portal to renew your membership and continue your training without interruption:</p>
            <p><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">Renew Now</a></p>
            <p>If you have any questions, please contact your gym front desk.</p>
          `,
        });

        if (emailSent.sent) {
          result.sent++;
        } else {
          billingLogger.warn("sendRenewalReminders", "Failed to send reminder email", { memberId: ms.member_id, reason: emailSent.reason });
        }
      } catch (err) {
        result.errors.push(`Membership ${ms.id}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }
  }

  if (result.sent > 0) {
    billingLogger.info("sendRenewalReminders", `Sent ${result.sent} renewal reminder(s)`);
  }

  return result;
}
