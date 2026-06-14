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
    const subscription = await updateSubscriptionStatus(parsed.data.subscriptionId, parsed.data.status);

    await writeSubscriptionAudit(auth.context.userId, "organization_subscription.status_updated", subscription.id, {
      status: parsed.data.status
    });
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
