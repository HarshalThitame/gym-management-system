"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { entitlementSimpleCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";

type BulkActionState = {
  status: string;
  message?: string;
  success?: false;
  error?: "FEATURE_LOCKED";
  reason?: string;
  featureKey?: string | null;
};

async function getOrganizationGymIds(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
  return (data ?? []).map((gym) => gym.id);
}

export async function bulkSuspendMembersAction(prevState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/members");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "member_management", actionName: "member.bulk_suspend" });
    const ids = (formData.get("memberIds") as string)?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) return { status: "error", message: "No members selected." };

    const supabase = await createSupabaseServerClient();
    const gymIds = await getOrganizationGymIds(ctx.organizationId);
    const { error } = await supabase.from("members").update({ status: "inactive", updated_at: new Date().toISOString() }).in("id", ids).in("gym_id", gymIds);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.bulk_suspend_members", entityType: "member", entityId: null, metadata: { count: ids.length, ids } as never });
    revalidatePath("/organization/members");
    return { status: "success", message: `${ids.length} member(s) suspended.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Bulk suspend failed.");
  }
}

export async function bulkTransferMembersAction(prevState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/members");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "member_management", actionName: "member.bulk_transfer" });
    const ids = (formData.get("memberIds") as string)?.split(",").filter(Boolean) ?? [];
    const targetGymId = formData.get("targetGymId") as string;
    if (ids.length === 0 || !targetGymId) return { status: "error", message: "Members and target gym required." };

    const supabase = await createSupabaseServerClient();
    const { data: gym } = await supabase.from("gyms").select("id").eq("id", targetGymId).eq("organization_id", ctx.organizationId).single();
    if (!gym) return { status: "error", message: "Target gym not in your organization." };

    const gymIds = await getOrganizationGymIds(ctx.organizationId);
    const { error } = await supabase.from("members").update({ gym_id: targetGymId, updated_at: new Date().toISOString() }).in("id", ids).in("gym_id", gymIds);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.bulk_transfer_members", entityType: "member", entityId: null, metadata: { count: ids.length, targetGymId } as never });
    revalidatePath("/organization/members");
    return { status: "success", message: `${ids.length} member(s) transferred.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Bulk transfer failed.");
  }
}

export async function bulkArchivePlansAction(prevState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/memberships");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "member_management", actionName: "membership_plan.bulk_archive" });
    const ids = (formData.get("planIds") as string)?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) return { status: "error", message: "No plans selected." };

    const supabase = await createSupabaseServerClient();
    const gymIds = await getOrganizationGymIds(ctx.organizationId);
    const { error } = await supabase.from("membership_plans").update({ status: "archived", updated_at: new Date().toISOString() }).in("id", ids).in("gym_id", gymIds);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.bulk_archive_plans", entityType: "membership_plan", entityId: null, metadata: { count: ids.length } as never });
    revalidatePath("/organization/memberships");
    return { status: "success", message: `${ids.length} plan(s) archived.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Bulk archive failed.");
  }
}

export async function bulkAssignTrainersAction(prevState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/trainers");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "trainer_management", actionName: "trainer.bulk_assign" });
    const ids = (formData.get("memberIds") as string)?.split(",").filter(Boolean) ?? [];
    const trainerId = formData.get("trainerId") as string;
    if (ids.length === 0 || !trainerId) return { status: "error", message: "Members and trainer required." };

    const supabase = await createSupabaseServerClient();
    const gymIds = await getOrganizationGymIds(ctx.organizationId);
    const { data: trainer } = await supabase.from("trainers").select("id").eq("id", trainerId).in("gym_id", gymIds).maybeSingle();
    if (!trainer) return { status: "error", message: "Trainer not found in your organization." };
    const { error } = await supabase.from("members").update({ assigned_trainer_id: trainerId, updated_at: new Date().toISOString() }).in("id", ids).in("gym_id", gymIds);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.bulk_assign_trainer", entityType: "member", entityId: null, metadata: { count: ids.length, trainerId } as never });
    revalidatePath("/organization/trainers");
    revalidatePath("/organization/members");
    return { status: "success", message: `${ids.length} member(s) assigned to trainer.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Bulk assign failed.");
  }
}

export async function bulkDeactivateStaffAction(prevState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const ctx = await requireOrganizationOwner("/organization/staff");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_management", actionName: "staff.bulk_deactivate" });
    const ids = (formData.get("staffIds") as string)?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) return { status: "error", message: "No staff selected." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("branch_users").update({ status: "revoked" }).in("user_id", ids).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.bulk_deactivate_staff", entityType: "profile", entityId: null, metadata: { count: ids.length } as never });
    revalidatePath("/organization/staff");
    return { status: "success", message: `${ids.length} staff deactivated.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Bulk deactivate failed.");
  }
}
