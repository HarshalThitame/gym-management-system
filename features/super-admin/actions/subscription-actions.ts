"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/api-guards";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Json } from "@/types/database";
import { assignPackageToOrg, updateSubscriptionStatus } from "../services/subscription-service";
import type { AssignPackageToOrgInput } from "../services/subscription-service";
import { assignPackageSchema, updateStatusSchema } from "../schemas/subscription-schemas";
import { recordSubscriptionEvent } from "../services/subscription-events-service";
import { syncSubscriptionArtifactsForOrganization } from "../services/subscription-entitlement-sync";

const superAdminRoles = ["super_admin"] as const;

export async function assignPackageAction(input: unknown): Promise<AuthActionState> {
  const parsed = assignPackageSchema.safeParse(input);

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const auth = await requireApiRole(superAdminRoles);

  if (!auth.ok) {
    return { status: "error", message: "Super Admin access is required to assign packages." };
  }

  try {
    const assignmentInput: AssignPackageToOrgInput = {
      organizationId: parsed.data.organizationId,
      packageId: parsed.data.packageId,
      status: parsed.data.status,
      assignedBy: auth.context.userId
    };

    if (parsed.data.expiresAt) {
      assignmentInput.expiresAt = new Date(parsed.data.expiresAt);
    }

    if (parsed.data.trialEndsAt) {
      assignmentInput.trialEndsAt = new Date(parsed.data.trialEndsAt);
    }

    if (parsed.data.notes) {
      assignmentInput.notes = parsed.data.notes;
    }

    const subscription = await assignPackageToOrg(assignmentInput);
    await syncSubscriptionArtifactsForOrganization(
      parsed.data.organizationId,
      `Super Admin assigned package ${parsed.data.packageId}.`,
    );

    await writeSubscriptionAudit(auth.context.userId, "organization_subscription.assigned", subscription.id, {
      organizationId: parsed.data.organizationId,
      packageId: parsed.data.packageId,
      status: parsed.data.status
    });

    // Record subscription lifecycle event for audit trail
    await recordSubscriptionEvent({
      organizationId: parsed.data.organizationId,
      subscriptionId: subscription.id,
      eventType: parsed.data.status === "trial" ? "trial_started" : "created",
      newState: {
        packageId: parsed.data.packageId,
        status: parsed.data.status,
      },
      actorId: auth.context.userId,
      reason: parsed.data.notes ?? null,
    });

    revalidateSubscriptionPaths();

    return { status: "success", message: "Package assigned successfully." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Package assignment failed." };
  }
}

export async function updateSubscriptionStatusAction(input: unknown): Promise<AuthActionState> {
  const parsed = updateStatusSchema.safeParse(input);

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const auth = await requireApiRole(superAdminRoles);

  if (!auth.ok) {
    return { status: "error", message: "Super Admin access is required to update subscriptions." };
  }

  try {
    // For destructive status changes, validate MFA step-up
    if (parsed.data.status === "suspended") {
      if (!parsed.data.stepUpEmail || !parsed.data.stepUpEmail.includes("@")) {
        return { status: "error", message: "MFA step-up email is required for suspension." };
      }
      if (!parsed.data.reason || parsed.data.reason.trim().length < 10) {
        return { status: "error", message: "Reason must be at least 10 characters." };
      }
    }

    const subscription = await updateSubscriptionStatus(parsed.data.subscriptionId, parsed.data.status);
    await syncSubscriptionArtifactsForOrganization(
      parsed.data.organizationId || subscription.organization_id,
      `Super Admin updated subscription status to ${parsed.data.status}.`,
    );

    const auditMetadata: Record<string, unknown> = {
      status: parsed.data.status,
    };
    if (parsed.data.reason) auditMetadata.reason = parsed.data.reason;
    if (parsed.data.stepUpEmail) auditMetadata.stepUpEmail = parsed.data.stepUpEmail;

    await writeSubscriptionAudit(auth.context.userId, "organization_subscription.status_updated", subscription.id, auditMetadata as Json);

    // Record subscription event for suspend
    if (parsed.data.status === "suspended") {
      const { recordSubscriptionEvent } = await import("../services/subscription-events-service");
      await recordSubscriptionEvent({
        organizationId: parsed.data.organizationId || subscription.organization_id,
        subscriptionId: subscription.id,
        eventType: "subscription_suspended",
        newState: { status: "suspended", reason: parsed.data.reason },
        actorId: auth.context.userId,
        reason: parsed.data.reason ?? null,
      });
    }

    revalidateSubscriptionPaths();

    return { status: "success", message: "Subscription status updated." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Subscription status update failed." };
  }
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value?.length)) as Record<string, string[]>
  };
}

async function writeSubscriptionAudit(actorId: string, action: string, entityId: string, metadata: Json) {
  await writeAuditLog({
    actorId,
    action,
    entityType: "organization_subscription",
    entityId,
    metadata
  });
}

function revalidateSubscriptionPaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/subscriptions");
}
