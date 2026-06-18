"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgOwnerContext } from "./action-utils";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { submitSubscriptionRequest } from "@/features/subscription/org-owner-actions";

type ActionState = { status: "idle" | "success" | "error"; message?: string };

export async function requestPlanChangeAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const targetPlanSlug = formData.get("targetPlan") as string;
    const reason = formData.get("reason") as string;
    const billingCycle = formData.get("billingCycle") as string;

    if (!targetPlanSlug || !reason) {
      return { status: "error", message: "Target plan and reason are required." };
    }

    // Resolve target package by slug
    const admin = getSupabaseAdminClient();
    if (!admin) return { status: "error", message: "Database connection failed." };

    const { data: packages } = await (admin as any)
      .from("packages")
      .select("id")
      .eq("slug", targetPlanSlug)
      .eq("is_active", true)
      .single();

    if (!packages) return { status: "error", message: "Target package not found." };

    // Submit through the subscription request system
    const result = await submitSubscriptionRequest({
      organizationId: ctx.organizationId,
      requestType: targetPlanSlug === (formData.get("currentPlanSlug") as string) ? "renewal" : "upgrade",
      requestedPackageId: packages.id,
      requestedBillingPeriod: billingCycle === "yearly" ? "annual" : "monthly",
      reason,
      organizationNote: null,
    });

    if (!result.ok) {
      return { status: "error", message: result.error ?? "Failed to submit request." };
    }

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.request_plan_change",
      entityType: "subscription_request",
      entityId: null,
      metadata: { targetPlan: targetPlanSlug, reason, requestId: result.data?.requestId } as never,
    });

    revalidatePath("/organization/plan");
    return { status: "success", message: `Plan change to ${targetPlanSlug} requested. Super Admin will review your request.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to request plan change." };
  }
}

export async function toggleAutoRenewAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { status: "error", message: "Database connection failed." };

    const enabled = formData.get("enabled") === "true";

    const { error } = await (supabase as any)
      .from("organization_subscriptions")
      .update({ auto_renew: enabled, updated_at: new Date().toISOString() })
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: `organization_owner.${enabled ? "enable" : "disable"}_auto_renew`,
      entityType: "organization_subscription",
      entityId: null,
    } as never);

    revalidatePath("/organization/plan");
    return { status: "success", message: `Auto-renew ${enabled ? "enabled" : "disabled"}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to update auto-renew." };
  }
}

export async function cancelSubscriptionAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/plan");
    const reason = formData.get("reason") as string;
    const confirmation = formData.get("confirmation") as string;

    if (!reason || confirmation !== "CANCEL") {
      return { status: "error", message: "Provide a reason and type CANCEL to confirm." };
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return { status: "error", message: "Database connection failed." };
    }
    const db = admin as any;

    const { data: subscription } = await db
      .from("organization_subscriptions")
      .select("id, status")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (!subscription) {
      return { status: "error", message: "No active subscription found for this organization." };
    }

    if (subscription.status === "cancelled") {
      return { status: "error", message: "Subscription is already cancelled." };
    }

    const { error: updError } = await db
      .from("organization_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updError) {
      return { status: "error", message: updError.message ?? "Failed to cancel subscription." };
    }

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.cancel_subscription",
      entityType: "organization_subscription",
      entityId: subscription.id,
      metadata: { reason, organizationId: ctx.organizationId } as never,
    });

    revalidatePath("/organization/plan");
    return { status: "success", message: "Subscription cancelled. Data will be retained for 30 days." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to cancel subscription." };
  }
}

export async function assignAddonAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const addonName = formData.get("addonName") as string;
    const addonPrice = Number(formData.get("addonPrice"));

    if (!addonName) return { status: "error", message: "Add-on name is required." };

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.request_addon",
      entityType: "subscription_addon",
      entityId: null,
      metadata: { addonName, addonPrice } as never,
    });

    revalidatePath("/organization/plan");
    return { status: "success", message: `Add-on "${addonName}" requested. Our team will activate it shortly.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to request add-on." };
  }
}

export async function removeAddonAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const addonName = formData.get("addonName") as string;

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.remove_addon_request",
      entityType: "subscription_addon",
      entityId: null,
      metadata: { addonName } as never,
    } as never);

    revalidatePath("/organization/plan");
    return { status: "success", message: `Removal request for "${addonName}" submitted.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to request add-on removal." };
  }
}
