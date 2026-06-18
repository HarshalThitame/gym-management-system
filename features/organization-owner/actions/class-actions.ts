"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

type SessionInsert = Database["public"]["Tables"]["class_sessions"]["Insert"];
type SessionUpdate = Database["public"]["Tables"]["class_sessions"]["Update"];

export async function saveClassSessionAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/classes");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "class_booking", actionName: "class.save" });
    const supabase = await createSupabaseServerClient();
    const sessionId = formData.get("sessionId") as string | null;
    const gymId = formData.get("gymId") as string;
    const classId = formData.get("classId") as string;
    const sessionDate = formData.get("sessionDate") as string;
    const startsAt = formData.get("startsAt") as string;
    const endsAt = formData.get("endsAt") as string;
    if (!gymId || !classId || !sessionDate || !startsAt || !endsAt) {
      return { ...prevState, status: "error", message: "Gym, class, date, start, and end time are required." };
    }

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const capacity = Number(formData.get("capacity")) || 30;
    const trainerId = (formData.get("trainerId") as string) || null;
    const location = (formData.get("location") as string) || null;
    const notes = (formData.get("notes") as string) || null;
    const status = (formData.get("status") as string) || "scheduled";

    if (sessionId) {
      const update: Record<string, unknown> = { session_date: sessionDate, starts_at: startsAt, ends_at: endsAt, capacity, primary_trainer_id: trainerId, location, notes, status, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("class_sessions").update(update as never).eq("id", sessionId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_class_session", entityType: "class_session", entityId: sessionId });
    } else {
      const insert: Record<string, unknown> = { gym_id: gymId, class_id: classId, session_date: sessionDate, starts_at: startsAt, ends_at: endsAt, capacity, primary_trainer_id: trainerId, location, notes, status };
      const { data, error } = await supabase.from("class_sessions").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_class_session", entityType: "class_session", entityId: data.id });
    }

    revalidateOrgModules(["/organization/classes"]);
    return { ...prevState, status: "success", message: "Class session saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save class session.");
  }
}

export async function cancelClassSessionAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/classes");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "class_booking", actionName: "class.cancel" });
    const sessionId = formData.get("sessionId") as string;
    if (!sessionId) return { ...prevState, status: "error", message: "Session ID is required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("class_sessions").update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", sessionId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.cancel_class_session", entityType: "class_session", entityId: sessionId });
    revalidateOrgModules(["/organization/classes"]);
    return { ...prevState, status: "success", message: "Session cancelled." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to cancel session.");
  }
}
