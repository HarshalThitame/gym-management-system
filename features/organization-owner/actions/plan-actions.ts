"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrgFeatureAccess, entitlementSimpleCatch } from "@/features/entitlement";
import { getOrgOwnerContext } from "./action-utils";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { syncSubscriptionArtifactsForOrganization } from "@/features/super-admin/services/subscription-entitlement-sync";

type ActionState = { status: "idle" | "success" | "error"; message?: string };

export async function toggleAutoRenewAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/plan");
    await requireOrgFeatureAccess(ctx.organizationId, "billing_invoices");
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { status: "error", message: "Database connection failed." };

    const enabled = formData.get("enabled") === "true";

    const { error } = await (supabase as any)
      .from("organization_subscriptions")
      .update({ auto_renew: enabled, updated_at: new Date().toISOString() })
      .eq("organization_id", ctx.organizationId)
      .in("status", ["active", "trial"]);

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
    return entitlementSimpleCatch(e, "Failed to update auto-renew.");
  }
}

export async function cancelSubscriptionAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/plan");
    await requireOrgFeatureAccess(ctx.organizationId, "billing_invoices");
    if (!ctx.userId) {
      return { status: "error", message: "Authenticated user could not be resolved." };
    }
    const reason = String(formData.get("reason") ?? "").trim();
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const termsAccepted = formData.get("termsAccepted") === "true";

    if (reason.length < 10) {
      return { status: "error", message: "Cancellation reason must contain at least 10 characters." };
    }
    if (confirmation !== "CANCEL") {
      return { status: "error", message: "Type CANCEL exactly to confirm." };
    }
    if (!termsAccepted) {
      return { status: "error", message: "Accept the cancellation terms, including that cancellation cannot be undone and no refund will be issued." };
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return { status: "error", message: "Database connection failed." };
    }
    const cancellationDb = admin as unknown as {
      rpc(
        name: "cancel_organization_subscription",
        args: {
          p_organization_id: string;
          p_actor_id: string;
          p_reason: string;
          p_terms_accepted: boolean;
          p_no_refund_acknowledged: boolean;
        },
      ): Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await cancellationDb.rpc("cancel_organization_subscription", {
      p_organization_id: ctx.organizationId,
      p_actor_id: ctx.userId,
      p_reason: reason,
      p_terms_accepted: termsAccepted,
      p_no_refund_acknowledged: termsAccepted,
    });

    if (error) {
      return { status: "error", message: error.message };
    }

    const result = data && typeof data === "object"
      ? data as { success?: boolean; error?: string; subscriptionId?: string }
      : {};
    if (!result.success || !result.subscriptionId) {
      return { status: "error", message: result.error ?? "Failed to cancel subscription." };
    }

    await syncSubscriptionArtifactsForOrganization(
      ctx.organizationId,
      "Organization owner cancelled subscription.",
    );

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.cancel_subscription",
      entityType: "organization_subscription",
      entityId: result.subscriptionId,
      metadata: {
        reason,
        organizationId: ctx.organizationId,
        termsAccepted: true,
        noRefundAcknowledged: true,
        irreversibleAcknowledged: true,
        dataRetentionDays: 30,
      } as never,
    });

    revalidatePath("/organization/plan");
    revalidatePath("/organization");
    return { status: "success", message: "Subscription cancelled. Auto-renewal is disabled and data will be retained for 30 days." };
  } catch (e) {
    return entitlementSimpleCatch(e, "Failed to cancel subscription.");
  }
}

export async function assignAddonAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    await requireOrgFeatureAccess(ctx.organizationId, "billing_invoices");
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
    return entitlementSimpleCatch(e, "Failed to request add-on.");
  }
}

export async function removeAddonAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/plan");
    await requireOrgFeatureAccess(ctx.organizationId, "billing_invoices");
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
    return entitlementSimpleCatch(e, "Failed to request add-on removal.");
  }
}
