"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrgWithinLimit } from "../lib/entitlement-guards";

type MemberInsert = Database["public"]["Tables"]["members"]["Insert"];
type MemberUpdate = Database["public"]["Tables"]["members"]["Update"];

export async function saveMemberAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    const supabase = await createSupabaseServerClient();
    const memberId = formData.get("memberId") as string | null;
    const gymId = formData.get("gymId") as string;
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    if (!gymId || !fullName || !phone) return { ...prevState, status: "error", message: "Gym, name, and phone are required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    if (memberId) {
      const update: Record<string, unknown> = {
        full_name: fullName, phone, email: (formData.get("email") as string) || null,
        date_of_birth: (formData.get("dateOfBirth") as string) || null,
        gender: (formData.get("gender") as string) || null,
        emergency_contact_name: (formData.get("emergencyContactName") as string) || null,
        emergency_contact_phone: (formData.get("emergencyContactPhone") as string) || null,
        address: (formData.get("address") as string) || null,
        assigned_trainer_id: (formData.get("assignedTrainerId") as string) || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("members").update(update as never).eq("id", memberId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_member", entityType: "member", entityId: memberId });
    } else {
      // Enforce member limit before creation
      const { count } = await (supabase as never as { from(t: string): { select(c: string, o: { count: "exact"; head: true }): { eq(k: string, v: string): Promise<{ count: number | null }> } } })
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId);
      const limitCheck = await requireOrgWithinLimit(ctx.organizationId, "max_members", count ?? 0);
      if (!limitCheck.ok) return { ...prevState, status: "error", message: limitCheck.error };

      const memberCode = `MEM-${Date.now().toString(36).toUpperCase()}`;
      const insert: Record<string, unknown> = {
        gym_id: gymId, member_code: memberCode, full_name: fullName, phone,
        email: (formData.get("email") as string) || null,
        date_of_birth: (formData.get("dateOfBirth") as string) || null,
        gender: (formData.get("gender") as string) || null,
        emergency_contact_name: (formData.get("emergencyContactName") as string) || null,
        emergency_contact_phone: (formData.get("emergencyContactPhone") as string) || null,
        address: (formData.get("address") as string) || null,
        assigned_trainer_id: (formData.get("assignedTrainerId") as string) || null,
        status: "active", joined_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from("members").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_member", entityType: "member", entityId: data.id });
    }

    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: "Member saved." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to save member." };
  }
}

export async function setMemberStatusAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    const memberId = formData.get("memberId") as string;
    const status = formData.get("status") as string;
    if (!memberId || !status) return { ...prevState, status: "error", message: "Member ID and status are required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("members").update({ status: status as never, updated_at: new Date().toISOString() }).eq("id", memberId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${status}_member`, entityType: "member", entityId: memberId });
    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: `Member ${status}.` };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to update member." };
  }
}

export async function transferMemberAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    const memberId = formData.get("memberId") as string;
    const targetGymId = formData.get("targetGymId") as string;
    if (!memberId || !targetGymId) return { ...prevState, status: "error", message: "Member ID and target gym are required." };

    const supabase = await createSupabaseServerClient();
    const { data: targetGym } = await supabase.from("gyms").select("id").eq("id", targetGymId).eq("organization_id", ctx.organizationId).single();
    if (!targetGym) return { ...prevState, status: "error", message: "Target gym not in your organization." };

    const { error } = await supabase.from("members").update({ gym_id: targetGymId, updated_at: new Date().toISOString() }).eq("id", memberId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.transfer_member", entityType: "member", entityId: memberId, metadata: { targetGymId } as never });
    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: "Member transferred." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to transfer member." };
  }
}
