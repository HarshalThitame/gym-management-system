"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { createRazorpayOrderForPayment } from "@/features/billing/services/payment-processing";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { retryPaymentAttemptSchema } from "../schemas/payment-attempt-actions-schemas";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaCookie = "super_admin_mfa_verified_at";

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value?.length)) as Record<string, string[]>,
  };
}

async function verifyMfaStepUp(stepUpEmail: string): Promise<AuthActionState | null> {
  const email = getCriticalSuperAdminEmail();
  if (stepUpEmail.trim().toLowerCase() !== email) {
    return fieldError("stepUpEmail", `Type ${email} to pass the step-up identity check.`);
  }

  const supabase = await createSupabaseServerClient();
  const mfaResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaResult.data?.currentLevel !== "aal2") {
    return { status: "error", message: "MFA step-up required. Go to /super-admin/security/mfa first.", fieldErrors: { stepUpEmail: ["Verify MFA first."] } };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaCookie)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return { status: "error", message: "MFA session expired. Verify a fresh code.", fieldErrors: { stepUpEmail: ["Re-verify MFA within 10 minutes."] } };
  }

  return null;
}

export async function retryPaymentAttemptAction(input: unknown): Promise<AuthActionState> {
  const parsed = retryPaymentAttemptSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const mfaError = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaError) return mfaError;

  const rateCheck = await checkRateLimit(`payment-attempt-retry:${auth.context.userId}`, 8, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: attempt, error: attemptError } = await supabase
      .from("payment_attempts")
      .select("id, organization_id, payment_id, provider, status, payment_id, invoice_id, subscription_id, error_code, error_description")
      .eq("id", parsed.data.paymentAttemptId)
      .maybeSingle();

    if (attemptError) {
      return { status: "error", message: attemptError.message };
    }
    if (!attempt || attempt.organization_id !== parsed.data.organizationId) {
      return { status: "error", message: "Payment attempt not found for this organization." };
    }
    if (attempt.provider !== "razorpay") {
      return { status: "error", message: "Manual retry is currently supported only for Razorpay attempts." };
    }
    if (!attempt.payment_id) {
      return { status: "error", message: "Payment attempt is missing the linked payment record." };
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, organization_id, gym_id, status, payment_number, amount, currency, invoice_id, provider_order_id, provider, member_id, method, payment_type, gateway, gateway_order_id, gateway_payment_id, created_at, updated_at")
      .eq("id", attempt.payment_id)
      .maybeSingle();

    if (paymentError) {
      return { status: "error", message: paymentError.message };
    }
    if (!payment || payment.organization_id !== parsed.data.organizationId) {
      return { status: "error", message: "Linked payment not found for this organization." };
    }
    if (payment.provider !== "razorpay") {
      return { status: "error", message: "Manual retry is currently supported only for Razorpay payments." };
    }

    const previousProviderOrderId = payment.provider_order_id ?? null;
    await supabase
      .from("payments")
      .update({
        provider_order_id: null,
        status: "pending",
      })
      .eq("id", payment.id);

    const retryResult = await createRazorpayOrderForPayment(auth.context, payment.id);
    if (!retryResult.ok) {
      await supabase
        .from("payments")
        .update({
          provider_order_id: previousProviderOrderId,
          status: payment.status,
        })
        .eq("id", payment.id);
      return { status: "error", message: retryResult.message };
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: payment.gym_id,
      action: "payment_attempt.retry_requested",
      entityType: "payment_attempt",
      entityId: attempt.id,
      metadata: {
        paymentId: payment.id,
        paymentAttemptId: attempt.id,
        providerOrderId: retryResult.data.orderId,
        note: parsed.data.reason ?? null,
      },
    });

    revalidatePath(`/super-admin/organizations/${parsed.data.organizationId}`);
    revalidatePath("/super-admin/payment-gateways");

    return {
      status: "success",
      message: `Retry initiated. New Razorpay order ${retryResult.data.orderId} is ready.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry failed.";
    return { status: "error", message };
  }
}
