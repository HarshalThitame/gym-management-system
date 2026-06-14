"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgOwnerContext } from "./action-utils";
import { validateTransition } from "@/features/super-admin/services/subscription-state-machine";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";

type ActionState = { status: "idle" | "success" | "error"; message?: string };

export async function requestPlanChangeAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const supabase = await createSupabaseServerClient();
    const targetPlan = formData.get("targetPlan") as string;
    const reason = formData.get("reason") as string;
    const billingCycle = formData.get("billingCycle") as string;

    if (!targetPlan || !reason) return { status: "error", message: "Target plan and reason are required." };

    const { error } = await supabase.from("organization_approval_requests").insert({
      organization_id: ctx.organizationId,
      action: "plan_change",
      status: "pending",
      requested_by: ctx.userId,
      payload: { targetPlan, reason, billingCycle, requestedAt: new Date().toISOString() },
      reason
    } as never);

    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.request_plan_change", entityType: "organization_subscription", entityId: null, metadata: { targetPlan, reason } as never });
    revalidatePath("/organization/plan");
    return { status: "success", message: `Plan change to ${targetPlan} requested. An admin will review your request.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to request plan change." };
  }
}

export async function toggleAutoRenewAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    // Use admin client to bypass RLS (user already authorized via getOrgOwnerContext)
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { status: "error", message: "Database connection failed." };
    const enabled = formData.get("enabled") === "true";

    const { error } = await (supabase as any).from("organization_subscriptions").update({ auto_renew: enabled, updated_at: new Date().toISOString() }).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${enabled ? "enable" : "disable"}_auto_renew`, entityType: "organization_subscription", entityId: null } as never);
    revalidatePath("/organization/plan");
    return { status: "success", message: `Auto-renew ${enabled ? "enabled" : "disabled"}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to update auto-renew." };
  }
}

export async function cancelSubscriptionAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const supabase = await createSupabaseServerClient();
    const reason = formData.get("reason") as string;
    const retentionFeedback = formData.get("retentionFeedback") as string;
    const confirmation = formData.get("confirmation") as string;

    if (!reason || confirmation !== "CANCEL") return { status: "error", message: "Provide a reason and type CANCEL to confirm." };

    // Use admin client for read/write (user already authorized via getOrgOwnerContext)
    const admin = getSupabaseAdminClient();
    if (!admin) return { status: "error", message: "Database connection failed." };

    // Fetch current subscription to validate state transition
    const { data: sub } = await (admin as any)
      .from("organization_subscriptions")
      .select("id, organization_id, status, package_id")
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!sub) return { status: "error", message: "No subscription found for this organization." };

    // Validate state transition using the state machine
    const subRow = sub as unknown as { id: string; status: string; package_id: string };
    const transition = validateTransition(subRow.status as never, "cancelled");
    if (!transition.valid) return { status: "error", message: transition.error ?? "Cannot cancel this subscription from its current state." };

    const { error } = await (admin as any).from("organization_subscriptions").update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
    }).eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await recordSubscriptionEvent({
      organizationId: ctx.organizationId,
      subscriptionId: subRow.id,
      eventType: "cancelled",
      previousState: { status: subRow.status },
      newState: { status: "cancelled", cancelType: "immediate" },
      actorId: ctx.userId,
      reason,
    });

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.cancel_subscription", entityType: "organization_subscription", entityId: null, metadata: { reason, retentionFeedback } as never });
    revalidatePath("/organization/plan");
    return { status: "success", message: "Subscription cancelled. You will retain access until the end of the billing period." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to cancel subscription." };
  }
}

export async function assignAddonAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    const supabase = await createSupabaseServerClient();
    const addonName = formData.get("addonName") as string;
    const addonPrice = Number(formData.get("addonPrice"));

    if (!addonName) return { status: "error", message: "Add-on name is required." };

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.request_addon", entityType: "subscription_addon", entityId: null, metadata: { addonName, addonPrice } as never });
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
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.remove_addon_request", entityType: "subscription_addon", entityId: null, metadata: { addonName } as never });
    revalidatePath("/organization/plan");
    return { status: "success", message: `Removal request for "${addonName}" submitted.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to request add-on removal." };
  }
}
