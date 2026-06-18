"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgOwnerContext } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementSimpleCatch } from "@/features/entitlement";
import type { Database } from "@/types/database";

type ActionState = { status: "idle" | "success" | "error"; message?: string };
type PlanInsert = Database["public"]["Tables"]["nutrition_plans"]["Insert"];
type PlanUpdate = Database["public"]["Tables"]["nutrition_plans"]["Update"];

export async function saveNutritionPlanAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/nutrition");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "nutrition_plans", actionName: "nutrition_plan.save" });
    const supabase = await createSupabaseServerClient();
    const planId = formData.get("planId") as string | null;
    const memberId = formData.get("memberId") as string;
    const name = formData.get("name") as string;
    const planType = formData.get("planType") as string;

    if (!memberId || !name || !planType) return { status: "error", message: "Member, name, and plan type are required." };

    const gymId = formData.get("gymId") as string || null;
    const trainerId = formData.get("trainerId") as string || null;
    const targetCalories = Number(formData.get("targetCalories")) || 2000;
    const targetProtein = Number(formData.get("targetProtein")) || 50;
    const targetCarbs = Number(formData.get("targetCarbs")) || 250;
    const targetFat = Number(formData.get("targetFat")) || 65;
    const waterTarget = Number(formData.get("waterTarget")) || 2000;
    const startsOn = formData.get("startsOn") as string || new Date().toISOString().slice(0, 10);
    const endsOn = formData.get("endsOn") as string || null;
    const status = (formData.get("status") as string) || "active";
    const description = formData.get("description") as string || null;

    if (planId) {
      const update: PlanUpdate = {
        name, plan_type: planType as never, description, trainer_id: trainerId,
        target_calories: targetCalories, target_protein_g: targetProtein,
        target_carbs_g: targetCarbs, target_fat_g: targetFat, water_target_ml: waterTarget,
        starts_on: startsOn, ends_on: endsOn, status: status as never, updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("nutrition_plans").update(update as never).eq("id", planId).eq("member_id", memberId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_nutrition_plan", entityType: "nutrition_plan", entityId: planId });
    } else {
      const insert: PlanInsert = {
        gym_id: gymId, member_id: memberId, trainer_id: trainerId, name: name as never,
        plan_type: planType as never, description, target_calories: targetCalories,
        target_protein_g: targetProtein, target_carbs_g: targetCarbs,
        target_fat_g: targetFat, water_target_ml: waterTarget,
        starts_on: startsOn, ends_on: endsOn, status: status as never
      };
      const { data, error } = await supabase.from("nutrition_plans").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_nutrition_plan", entityType: "nutrition_plan", entityId: data.id });
    }

    revalidatePath("/organization/nutrition");
    return { status: "success", message: `Nutrition plan ${planId ? "updated" : "created"}.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Failed to save nutrition plan.");
  }
}

export async function setNutritionPlanStatusAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/nutrition");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "nutrition_plans", actionName: "nutrition_plan.status.update" });
    const supabase = await createSupabaseServerClient();
    const planId = formData.get("planId") as string;
    const status = formData.get("status") as string;
    if (!planId || !status) return { status: "error", message: "Plan ID and status required." };
    const { error } = await supabase.from("nutrition_plans").update({ status: status as never, updated_at: new Date().toISOString() } as never).eq("id", planId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${status}_nutrition_plan`, entityType: "nutrition_plan", entityId: planId });
    revalidatePath("/organization/nutrition");
    return { status: "success", message: `Plan ${status}.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Failed to update plan status.");
  }
}
