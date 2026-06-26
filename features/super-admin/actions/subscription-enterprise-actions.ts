"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { validateTransition } from "../services/subscription-state-machine";
import { assignPackageToOrg } from "../services/subscription-service";
import { recordSubscriptionEvent } from "../services/subscription-events-service";
import { schedulePlanChange, cancelScheduledChange } from "../services/subscription-scheduled-changes-service";
import { assignAddon, removeAddon } from "../services/subscription-addon-service";
import { convertTrialToPaid } from "../services/subscription-trial-service";
import {
  upgradePlanSchema,
  downgradePlanSchema,
  cancelSubscriptionSchema,
  reactivateSubscriptionSchema,
  extendTrialSchema,
  convertTrialSchema,
  assignAddonSchema,
  removeAddonSchema,
  scheduleChangeSchema,
  cancelScheduledChangeSchema,
  bulkUpdateSubscriptionStatusSchema,
  overridePriceSchema,
} from "../schemas/subscription-enterprise-schemas";
import { prorate, formatProrationSummary, getDaysInPeriod } from "../services/subscription-proration";
import type { ProrationResult } from "../services/subscription-proration";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaCookie = "super_admin_mfa_verified_at";

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v?.length)) as Record<string, string[]>,
  };
}

function revalidatePaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/subscriptions");
  revalidatePath("/organization/plan");
}

type MinimalQueryResult = Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
type MinimalSelect = {
  eq(column: string, value: string): MinimalSelect;
  maybeSingle(): MinimalQueryResult;
  single(): MinimalQueryResult;
};
type MinimalMutation = {
  eq(column: string, value: string): Promise<{ error: { message: string } | null }>;
};
type MinimalDb = {
  from(table: string): {
    select(columns: string): MinimalSelect;
    update(row: Record<string, unknown>): MinimalMutation;
  };
};

async function getSubscriptionForOrg(subscriptionId: string, organizationId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as MinimalDb;
  const { data, error } = await db
    .from("organization_subscriptions")
    .select("id, organization_id, package_id, status, price_override, billing_period")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.organization_id !== organizationId) return null;
  return data;
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

export async function upgradePlanAction(input: unknown): Promise<AuthActionState> {
  const parsed = upgradePlanSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`upgrade:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        select(c: string): {
          eq(c: string, v: string): {
            single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
    };

    const { data: sub } = await db.from("organization_subscriptions").select("*").eq("id", parsed.data.subscriptionId).single();
    if (!sub) return { status: "error", message: "Subscription not found." };

    const { data: currentPkg } = await db.from("packages").select("*").eq("id", sub.package_id as string).single();
    const { data: newPkg } = await db.from("packages").select("*").eq("id", parsed.data.newPackageId).single();
    if (!currentPkg || !newPkg) return { status: "error", message: "Package not found." };

    // Validate target package is active
    if (!(newPkg.is_active as boolean)) {
      return { status: "error", message: "Cannot upgrade to an inactive package." };
    }

    // Validate subscription state transition
    const subStatus = sub.status as string;
    const transition = validateTransition(subStatus as never, "active");
    if (!transition.valid) {
      return { status: "error", message: transition.error ?? "Cannot upgrade subscription in its current state." };
    }

    const priceOverride = sub.price_override as number | undefined;
    const currentPrice = priceOverride ?? (currentPkg.price as number) ?? 0;
    const newPrice = (newPkg.price as number) ?? 0;
    const billingPeriod = (sub.billing_period as string) || (currentPkg.billing_period as string) || "monthly";
    const period = billingPeriod as "monthly" | "quarterly" | "half_yearly" | "annual";

    const nextBillingDate = sub.next_billing_date as string | null;
    const billingAnchor = sub.billing_anchor as string | null;
    const lastBillingDate = sub.last_billing_date as string | null;
    const now = new Date();

    let daysRemaining = getDaysInPeriod(period);
    if (nextBillingDate) {
      daysRemaining = Math.max(0, Math.round((new Date(nextBillingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    } else if (billingAnchor) {
      const anchor = new Date(billingAnchor);
      const daysSinceAnchor = Math.round((now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, getDaysInPeriod(period) - daysSinceAnchor);
    } else if (lastBillingDate) {
      const lastBill = new Date(lastBillingDate);
      const daysSinceLastBill = Math.round((now.getTime() - lastBill.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, getDaysInPeriod(period) - daysSinceLastBill);
    }

    const prorationResult: ProrationResult = prorate({
      currentPrice,
      newPrice,
      billingPeriod: period,
      daysRemainingInPeriod: daysRemaining,
    });

    const pkgDb = supabase as never as {
      from(t: string): {
        upsert(r: Record<string, unknown>, o: { onConflict: string }): {
          select(c: string): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };

    const upsertPayload: Record<string, unknown> = {
      organization_id: sub.organization_id,
      package_id: parsed.data.newPackageId,
      status: sub.status,
      expires_at: sub.expires_at ?? null,
      trial_ends_at: sub.trial_ends_at ?? null,
      assigned_by: auth.context.userId,
      notes: parsed.data.reason ?? null,
    };

    await pkgDb.from("organization_subscriptions").upsert(upsertPayload, { onConflict: "organization_id" }).select("*");

    if (prorationResult.netCharge > 0) {
      const txDb = supabase as never as {
        from(t: string): {
          insert(r: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
        };
      };
      await txDb.from("transactions").insert({
        gym_id: null,
        member_id: null,
        invoice_id: null,
        payment_id: null,
        transaction_type: "payment_collected",
        direction: "credit",
        amount: prorationResult.netCharge,
        currency: (newPkg.currency as string) ?? "INR",
        description: `Prorated upgrade charge (${formatProrationSummary(prorationResult)})`,
        metadata: { proration: prorationResult, subscriptionId: parsed.data.subscriptionId, fromPackage: sub.package_id, toPackage: parsed.data.newPackageId },
        created_by: auth.context.userId,
      });
    }

    await recordSubscriptionEvent({
      organizationId: sub.organization_id as string,
      subscriptionId: parsed.data.subscriptionId,
      eventType: "upgraded",
      previousState: { package_id: sub.package_id, price: currentPrice },
      newState: { package_id: parsed.data.newPackageId, price: newPrice, proration: prorationResult },
      actorId: auth.context.userId,
      reason: parsed.data.reason
        ? `${parsed.data.reason} (${formatProrationSummary(prorationResult)})`
        : `Upgrade with proration: ${formatProrationSummary(prorationResult)}`,
    });

    revalidatePaths();
    return {
      status: "success",
      message: `Plan upgraded. ${prorationResult.netCharge > 0 ? formatProrationSummary(prorationResult) + " will be charged." : "No additional charge for this upgrade."}`,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Upgrade failed." };
  }
}

export async function downgradePlanAction(input: unknown): Promise<AuthActionState> {
  const parsed = downgradePlanSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`downgrade:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        select(c: string): {
          eq(c: string, v: string): {
            single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
    };

    const { data: sub } = await db.from("organization_subscriptions").select("*").eq("id", parsed.data.subscriptionId).single();
    if (!sub) return { status: "error", message: "Subscription not found." };

    const { data: currentPkg } = await db.from("packages").select("*").eq("id", sub.package_id as string).single();
    const { data: newPkg } = await db.from("packages").select("*").eq("id", parsed.data.newPackageId).single();
    if (!currentPkg || !newPkg) return { status: "error", message: "Package not found." };

    // Validate target package is active
    if (!(newPkg.is_active as boolean)) {
      return { status: "error", message: "Cannot downgrade to an inactive package." };
    }

    const pkgRow = newPkg as unknown as { max_members: number; max_branches: number; max_trainers: number };
    const usage = await checkUsage(
      sub.organization_id as string,
      pkgRow.max_members,
      pkgRow.max_branches,
      pkgRow.max_trainers,
    );
    if (!usage.ok) return usage.error;

    const priceOverride = sub.price_override as number | undefined;
    const currentPrice = priceOverride ?? (currentPkg.price as number) ?? 0;
    const newPrice = (newPkg.price as number) ?? 0;
    const billingPeriod = (sub.billing_period as string) || (currentPkg.billing_period as string) || "monthly";
    const period = billingPeriod as "monthly" | "quarterly" | "half_yearly" | "annual";

    const nextBillingDate = sub.next_billing_date as string | null;
    const now = new Date();
    let daysRemaining = getDaysInPeriod(period);
    if (nextBillingDate) {
      daysRemaining = Math.max(0, Math.round((new Date(nextBillingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const prorationResult: ProrationResult = prorate({
      currentPrice,
      newPrice,
      billingPeriod: period,
      daysRemainingInPeriod: daysRemaining,
    });

    const effectiveDate = new Date();
    effectiveDate.setDate(effectiveDate.getDate() + 30);

    await schedulePlanChange({
      subscriptionId: parsed.data.subscriptionId,
      organizationId: sub.organization_id as string,
      fromPackageId: sub.package_id as string,
      toPackageId: parsed.data.newPackageId,
      changeType: "downgrade",
      effectiveDate,
      reason: parsed.data.reason
        ? `${parsed.data.reason} (expected proration: ${formatProrationSummary(prorationResult)})`
        : `Expected proration at change: ${formatProrationSummary(prorationResult)}`,
      createdBy: auth.context.userId,
    });

    await recordSubscriptionEvent({
      organizationId: sub.organization_id as string,
      subscriptionId: parsed.data.subscriptionId,
      eventType: "downgrade_scheduled",
      previousState: { package_id: sub.package_id, price: currentPrice },
      newState: { package_id: parsed.data.newPackageId, price: newPrice, expectedProration: prorationResult, effectiveDate: effectiveDate.toISOString() },
      actorId: auth.context.userId,
      reason: parsed.data.reason ?? "Downgrade scheduled with proration estimate",
    });

    revalidatePaths();
    return {
      status: "success",
      message: `Downgrade scheduled for ${effectiveDate.toLocaleDateString("en-IN")}. Expected proration: ${formatProrationSummary(prorationResult)}`,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Downgrade failed." };
  }
}

async function checkUsage(
  organizationId: string,
  memberLimit: number,
  branchLimit: number,
  trainerLimit?: number,
): Promise<{ ok: true } | { ok: false; error: AuthActionState }> {
  const supabase = await createSupabaseServerClient();
  const sbRaw = supabase as never as { from(t: string): { select(c: string, o: { count: "exact"; head: true }): { eq(c: string, v: string): Promise<{ count: number | null; error: { message: string } | null }> } } };

  const { count: memberCount } = await sbRaw
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { count: branchCount } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["active", "planned", "maintenance"]);

  if (memberLimit !== -1 && (memberCount ?? 0) > memberLimit) {
    return { ok: false, error: { status: "error", message: `Cannot downgrade: organization has ${memberCount} members but new plan limits to ${memberLimit}. Remove ${(memberCount ?? 0) - memberLimit} members first.` } };
  }

  if (branchLimit !== -1 && (branchCount ?? 0) > branchLimit) {
    return { ok: false, error: { status: "error", message: `Cannot downgrade: organization has ${branchCount} branches/locations but new plan limits to ${branchLimit}. Deactivate ${(branchCount ?? 0) - branchLimit} branches first.` } };
  }

  if (trainerLimit !== undefined && trainerLimit !== -1) {
    const { count: trainerCount } = await supabase
      .from("branch_users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role_name", "trainer")
      .eq("status", "active");

    if ((trainerCount ?? 0) > trainerLimit) {
      return { ok: false, error: { status: "error", message: `Cannot downgrade: organization has ${trainerCount} trainers but new plan limits to ${trainerLimit}.` } };
    }
  }

  return { ok: true };
}

export async function cancelSubscriptionAction(input: unknown): Promise<AuthActionState> {
  const parsed = cancelSubscriptionSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const mfaError = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaError) return mfaError;

  const rateCheck = await checkRateLimit(`cancel:${auth.context.userId}`, 5, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        select(c: string): { eq(c: string, v: string): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
        update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      };
    };

    const { data: sub } = await db.from("organization_subscriptions").select("*").eq("id", parsed.data.subscriptionId).single();
    if (!sub) return { status: "error", message: "Subscription not found." };

    const row = sub as unknown as { id: string; organization_id: string; status: string; next_billing_date: string | null; cancellation_reason: string | null };
    const transition = validateTransition(row.status as never, "cancelled");
    if (!transition.valid) return { status: "error", message: transition.error ?? "Cannot cancel this subscription." };

    const categoryPrefix = parsed.data.cancellationCategory ? `[${parsed.data.cancellationCategory}] ` : "";
    const fullReason = `${categoryPrefix}${parsed.data.reason}`;

    if (parsed.data.cancelType === "end_of_period") {
      const cancelledAt = row.next_billing_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.from("organization_subscriptions").update({
        cancelled_at: cancelledAt,
        cancellation_reason: fullReason,
        cancellation_category: parsed.data.cancellationCategory ?? null,
        data_retention_days: parsed.data.dataRetentionDays,
      }).eq("id", parsed.data.subscriptionId);

      await recordSubscriptionEvent({
        organizationId: parsed.data.organizationId,
        subscriptionId: parsed.data.subscriptionId,
        eventType: "cancellation_scheduled",
        previousState: { status: row.status, cancelled_at: null },
        newState: { status: row.status, cancelled_at: cancelledAt, cancelType: "end_of_period", dataRetentionDays: parsed.data.dataRetentionDays, category: parsed.data.cancellationCategory },
        actorId: auth.context.userId,
        reason: fullReason,
      });

      revalidatePaths();
      return { status: "success", message: `Cancellation scheduled for end of billing period (${new Date(cancelledAt).toLocaleDateString("en-IN")}). Subscription remains active until then.` };
    }

    await db.from("organization_subscriptions").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: fullReason,
      cancellation_category: parsed.data.cancellationCategory ?? null,
      data_retention_days: parsed.data.dataRetentionDays,
    }).eq("id", parsed.data.subscriptionId);

    await recordSubscriptionEvent({
      organizationId: parsed.data.organizationId,
      subscriptionId: parsed.data.subscriptionId,
      eventType: "cancelled",
      previousState: { status: row.status },
      newState: { status: "cancelled", cancelType: "immediate", dataRetentionDays: parsed.data.dataRetentionDays, category: parsed.data.cancellationCategory },
      actorId: auth.context.userId,
      reason: fullReason,
    });

    revalidatePaths();
    return { status: "success", message: "Subscription cancelled immediately. Data retained per retention policy." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Cancellation failed." };
  }
}

export async function reactivateSubscriptionAction(input: unknown): Promise<AuthActionState> {
  const parsed = reactivateSubscriptionSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const mfaError = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaError) return mfaError;

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        select(c: string): { eq(c: string, v: string): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
        update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      };
    };

    const { data: sub } = await db.from("organization_subscriptions").select("*").eq("id", parsed.data.subscriptionId).single();
    if (!sub) return { status: "error", message: "Subscription not found." };

    const row = sub as unknown as { id: string; organization_id: string; status: string; cancelled_at: string | null };
    const hasPendingCancel = row.status === "active" && row.cancelled_at != null;

    if (!hasPendingCancel) {
      const transition = validateTransition(row.status as never, "active");
      if (!transition.valid) return { status: "error", message: transition.error ?? "Cannot reactivate this subscription." };
    }

    await db.from("organization_subscriptions").update({
      status: "active",
      cancelled_at: null,
      cancellation_reason: null,
      cancellation_category: null,
      dunning_attempts: 0,
      dunning_next_retry: null,
    }).eq("id", parsed.data.subscriptionId);

    await recordSubscriptionEvent({
      organizationId: parsed.data.organizationId,
      subscriptionId: parsed.data.subscriptionId,
      eventType: "reactivated",
      previousState: { status: row.status, hadPendingCancel: hasPendingCancel },
      newState: { status: "active" },
      actorId: auth.context.userId,
      reason: parsed.data.reason ?? null,
    });

    revalidatePaths();
    return { status: "success", message: "Subscription reactivated." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Reactivation failed." };
  }
}

export async function extendTrialAction(input: unknown): Promise<AuthActionState> {
  const parsed = extendTrialSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: sub } = await supabase
      .from("organization_subscriptions")
      .select("id, trial_ends_at")
      .eq("id", parsed.data.subscriptionId)
      .single();
    if (!sub) return { status: "error", message: "Subscription not found." };

    const prevTrialEnd = (sub as unknown as { trial_ends_at: string | null }).trial_ends_at;

    await supabase.from("organization_subscriptions").update({
      trial_ends_at: parsed.data.newTrialEndDate,
    }).eq("id", parsed.data.subscriptionId);

    await recordSubscriptionEvent({
      organizationId: parsed.data.organizationId,
      subscriptionId: parsed.data.subscriptionId,
      eventType: "trial_extended",
      previousState: { trial_ends_at: prevTrialEnd },
      newState: { trial_ends_at: parsed.data.newTrialEndDate },
      actorId: auth.context.userId,
      reason: parsed.data.reason ?? null,
    });

    revalidatePaths();
    return { status: "success", message: "Trial extended successfully." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Trial extension failed." };
  }
}

export async function convertTrialAction(input: unknown): Promise<AuthActionState> {
  const parsed = convertTrialSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    await convertTrialToPaid(parsed.data.subscriptionId, parsed.data.packageId, auth.context.userId);
    revalidatePaths();
    return { status: "success", message: "Trial converted to paid subscription." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Trial conversion failed." };
  }
}

export async function assignAddonAction(input: unknown): Promise<AuthActionState> {
  const parsed = assignAddonSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const sub = await getSubscriptionForOrg(parsed.data.subscriptionId, parsed.data.organizationId);
    if (!sub) return { status: "error", message: "Subscription not found for this organization." };

    await assignAddon(parsed.data.subscriptionId, parsed.data.addonId, parsed.data.quantity, auth.context.userId, parsed.data.reason);
    revalidatePaths();
    return { status: "success", message: "Add-on assigned." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Add-on assignment failed." };
  }
}

export async function removeAddonAction(input: unknown): Promise<AuthActionState> {
  const parsed = removeAddonSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(table: string): {
        select(columns: string): {
          eq(column: string, value: string): {
            maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
    };

    const { data: assigned, error } = await db
      .from("subscription_addons")
      .select("id, subscription_id")
      .eq("id", parsed.data.assignedAddonId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!assigned) return { status: "error", message: "Add-on assignment not found." };

    const sub = await getSubscriptionForOrg(assigned.subscription_id as string, parsed.data.organizationId);
    if (!sub) return { status: "error", message: "Add-on assignment is not linked to this organization." };

    await removeAddon(parsed.data.assignedAddonId, auth.context.userId, parsed.data.reason);
    revalidatePaths();
    return { status: "success", message: "Add-on removed." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Add-on removal failed." };
  }
}

export async function scheduleChangeAction(input: unknown): Promise<AuthActionState> {
  const parsed = scheduleChangeSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    await schedulePlanChange({
      subscriptionId: parsed.data.subscriptionId,
      organizationId: parsed.data.organizationId,
      fromPackageId: parsed.data.fromPackageId,
      toPackageId: parsed.data.toPackageId,
      changeType: parsed.data.changeType,
      effectiveDate: new Date(parsed.data.effectiveDate),
      reason: parsed.data.reason ?? "",
      createdBy: auth.context.userId,
    });
    revalidatePaths();
    return { status: "success", message: "Plan change scheduled." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to schedule plan change." };
  }
}

export async function cancelScheduledChangeAction(input: unknown): Promise<AuthActionState> {
  const parsed = cancelScheduledChangeSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(table: string): {
        select(columns: string): {
          eq(column: string, value: string): {
            maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
    };

    const { data: change, error } = await db
      .from("scheduled_plan_changes")
      .select("id, subscription_id")
      .eq("id", parsed.data.changeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!change) return { status: "error", message: "Scheduled change not found." };

    const sub = await getSubscriptionForOrg(change.subscription_id as string, parsed.data.organizationId);
    if (!sub) return { status: "error", message: "Scheduled change is not linked to this organization." };

    await cancelScheduledChange(parsed.data.changeId, parsed.data.organizationId, auth.context.userId, parsed.data.reason);
    revalidatePaths();
    return { status: "success", message: "Scheduled change cancelled." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to cancel scheduled change." };
  }
}

export async function bulkUpdateSubscriptionStatusAction(input: unknown): Promise<AuthActionState> {
  const parsed = bulkUpdateSubscriptionStatusSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: subs } = await supabase
      .from("organization_subscriptions")
      .select("id, organization_id, status")
      .in("id", parsed.data.subscriptionIds);

    const rows = (subs ?? []) as Array<{ id: string; organization_id: string; status: string }>;

    for (const sub of rows) {
      const transition = validateTransition(sub.status as never, parsed.data.status);
      if (!transition.valid) continue;

      await supabase.from("organization_subscriptions").update({ status: parsed.data.status }).eq("id", sub.id);

      await recordSubscriptionEvent({
        organizationId: sub.organization_id,
        subscriptionId: sub.id,
        eventType: "status_changed",
        previousState: { status: sub.status },
        newState: { status: parsed.data.status },
        actorId: auth.context.userId,
        reason: parsed.data.reason ?? "Bulk status update",
      });
    }

    revalidatePaths();
    return { status: "success", message: `Updated ${rows.length} subscription(s).` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Bulk update failed." };
  }
}

export async function overrideSubscriptionPriceAction(input: unknown): Promise<AuthActionState> {
  const parsed = overridePriceSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const mfaError = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaError) return mfaError;

  const rateCheck = await checkRateLimit(`override-price:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const sub = await getSubscriptionForOrg(parsed.data.subscriptionId, parsed.data.organizationId);
    if (!sub) return { status: "error", message: "Subscription not found for this organization." };

    const supabase = await createSupabaseServerClient();
    const db = supabase as never as MinimalDb;

    const oldPrice = sub.price_override as number | null;
    const now = new Date().toISOString();

    const { error } = await db.from("organization_subscriptions").update({
      price_override: parsed.data.overrideAmount,
      notes: parsed.data.reason,
      updated_at: now,
    }).eq("id", parsed.data.subscriptionId);

    if (error) throw new Error(error.message);

    await recordSubscriptionEvent({
      organizationId: parsed.data.organizationId,
      subscriptionId: parsed.data.subscriptionId,
      eventType: "price_override_set",
      previousState: { price_override: oldPrice },
      newState: {
        price_override: parsed.data.overrideAmount,
        currency: parsed.data.currency,
        effectiveDate: parsed.data.effectiveDate ?? now,
        endDate: parsed.data.endDate ?? null,
      },
      actorId: auth.context.userId,
      reason: parsed.data.reason,
      metadata: {
        organizationId: parsed.data.organizationId,
        currency: parsed.data.currency,
      },
    });

    revalidatePaths();
    return { status: "success", message: "Price override applied." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Price override failed." };
  }
}
