"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";

type PlanInsert = Database["public"]["Tables"]["membership_plans"]["Insert"];
type PlanUpdate = Database["public"]["Tables"]["membership_plans"]["Update"];

export async function savePlanAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/memberships");
    const supabase = await createSupabaseServerClient();
    const planId = formData.get("planId") as string | null;
    const gymId = formData.get("gymId") as string;
    const name = formData.get("name") as string;
    const planType = formData.get("planType") as string;
    const priceAmount = Number(formData.get("priceAmount"));
    if (!gymId || !name || !planType) return { ...prevState, status: "error", message: "Gym, name, and plan type are required." };
    if (!priceAmount && priceAmount !== 0) return { ...prevState, status: "error", message: "Price is required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const slug = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);
    const currency = (formData.get("currency") as string) || "INR";
    const durationMonths = Number(formData.get("durationMonths")) || 1;
    const durationDays = durationMonths * 30;
    const status = (formData.get("status") as string) || "active";

    if (planId) {
      const update: Record<string, unknown> = { name, slug, description: (formData.get("description") as string) || name, plan_type: planType, duration_days: durationDays, price_amount: priceAmount, currency, status, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("membership_plans").update(update as never).eq("id", planId);
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_plan", entityType: "membership_plan", entityId: planId });
    } else {
      const insert: Record<string, unknown> = { gym_id: gymId, name, slug, description: (formData.get("description") as string) || name, plan_type: planType, duration_days: durationDays, price_amount: priceAmount, currency, status };
      const { data, error } = await supabase.from("membership_plans").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_plan", entityType: "membership_plan", entityId: data.id });
    }

    revalidateOrgModules(["/organization/memberships"]);
    return { ...prevState, status: "success", message: "Plan saved." };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to save plan." };
  }
}

export async function setPlanStatusAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/memberships");
    const planId = formData.get("planId") as string;
    const status = formData.get("status") as string;
    if (!planId || !status) return { ...prevState, status: "error", message: "Plan ID and status are required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("membership_plans").update({ status: status as never, updated_at: new Date().toISOString() }).eq("id", planId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.${status}_plan`, entityType: "membership_plan", entityId: planId });
    revalidateOrgModules(["/organization/memberships"]);
    return { ...prevState, status: "success", message: `Plan ${status}.` };
  } catch (e) {
    return { ...prevState, status: "error", message: e instanceof Error ? e.message : "Failed to update plan." };
  }
}
