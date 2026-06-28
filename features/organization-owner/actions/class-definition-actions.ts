"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ClassSchema } from "@/features/classes/schemas/classes";
import { slugifyClassName } from "@/features/classes/lib/business-rules";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, auditOrgAction, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

type ClassDefActionResult = AuthActionState & {
  classData?: {
    id: string;
    name: string;
    status: string;
    classType: string;
    difficulty: string;
    durationMinutes: number;
    defaultCapacity: number;
    gymId: string;
  };
};

export async function saveOrgClassDefinitionAction(prevState: AuthActionState, formData: FormData): Promise<ClassDefActionResult> {
  try {
    const ctx = await getOrgOwnerContext("/organization/classes");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "class_booking", actionName: "org.class-definition.save" });

    const parsed = ClassSchema.safeParse({
      classId: formData.get("classId") ?? "",
      categoryId: formData.get("categoryId") ?? "",
      primaryTrainerId: formData.get("primaryTrainerId") ?? "",
      name: formData.get("name"),
      description: formData.get("description"),
      classType: formData.get("classType"),
      difficulty: formData.get("difficulty"),
      durationMinutes: formData.get("durationMinutes"),
      defaultCapacity: formData.get("defaultCapacity"),
      reservedCapacity: formData.get("reservedCapacity") ?? "0",
      bookingWindowDays: formData.get("bookingWindowDays") ?? "14",
      cancellationWindowHours: formData.get("cancellationWindowHours") ?? "4",
      requirements: formData.get("requirements") ?? "",
      location: formData.get("location") ?? "",
      membershipAccess: formData.get("membershipAccess"),
      requiresApproval: Boolean(formData.get("requiresApproval")),
      priceAmount: formData.get("priceAmount") ?? "0",
      status: formData.get("status") ?? "draft"
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: "Please correct the highlighted fields.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors)
            .filter(([, v]) => v && v.length > 0)
        ) as Record<string, string[]>
      };
    }

    const supabase = await createSupabaseServerClient();
    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return { ...prevState, status: "error", message: "Server configuration error." };
    }

    const gymId = formData.get("gymId") as string;
    if (!gymId) {
      return { ...prevState, status: "error", message: "Gym is required." };
    }

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) {
      return { ...prevState, status: "error", message: "Gym not in your organization." };
    }

    const slug = slugifyClassName(parsed.data.name);
    const now = new Date().toISOString();
    let savedClassId = parsed.data.classId || "";

    if (parsed.data.classId) {
      const { error } = await adminClient
        .from("classes")
        .update({
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          category_id: parsed.data.categoryId || null,
          class_type: parsed.data.classType,
          difficulty: parsed.data.difficulty,
          duration_minutes: parsed.data.durationMinutes,
          default_capacity: parsed.data.defaultCapacity,
          reserved_capacity: parsed.data.reservedCapacity,
          booking_window_days: parsed.data.bookingWindowDays,
          cancellation_window_hours: parsed.data.cancellationWindowHours,
          requirements: parsed.data.requirements || null,
          location: parsed.data.location || null,
          membership_access: parsed.data.membershipAccess,
          requires_approval: parsed.data.requiresApproval,
          price_amount: parsed.data.priceAmount,
          status: parsed.data.status,
          archived_at: parsed.data.status === "archived" ? now : null,
          updated_at: now
        })
        .eq("id", parsed.data.classId)
        .eq("gym_id", gymId);

      if (error) throw new Error(error.message);

      if (parsed.data.primaryTrainerId) {
        await adminClient.from("class_trainers").upsert({
          gym_id: gymId,
          class_id: parsed.data.classId,
          trainer_id: parsed.data.primaryTrainerId,
          role: "primary",
          status: "active",
          created_by: ctx.userId
        }, { onConflict: "class_id,trainer_id,role" });
      }

      await auditOrgAction(ctx.userId, "class_def.updated", "class", parsed.data.classId, { name: parsed.data.name, status: parsed.data.status });
    } else {
      const { data: newClass, error } = await adminClient
        .from("classes")
        .insert({
          gym_id: gymId,
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          category_id: parsed.data.categoryId || null,
          class_type: parsed.data.classType,
          difficulty: parsed.data.difficulty,
          duration_minutes: parsed.data.durationMinutes,
          default_capacity: parsed.data.defaultCapacity,
          reserved_capacity: parsed.data.reservedCapacity,
          booking_window_days: parsed.data.bookingWindowDays,
          cancellation_window_hours: parsed.data.cancellationWindowHours,
          requirements: parsed.data.requirements || null,
          location: parsed.data.location || null,
          membership_access: parsed.data.membershipAccess,
          requires_approval: parsed.data.requiresApproval,
          price_amount: parsed.data.priceAmount,
          status: parsed.data.status,
          archived_at: parsed.data.status === "archived" ? now : null,
          calendar_integration: { google: null, outlook: null, apple: null },
          created_by: ctx.userId,
          created_at: now,
          updated_at: now
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      savedClassId = newClass.id;

      if (parsed.data.primaryTrainerId) {
        await adminClient.from("class_trainers").upsert({
          gym_id: gymId,
          class_id: savedClassId,
          trainer_id: parsed.data.primaryTrainerId,
          role: "primary",
          status: "active",
          created_by: ctx.userId
        }, { onConflict: "class_id,trainer_id,role" });
      }

      await auditOrgAction(ctx.userId, "class_def.created", "class", savedClassId, { name: parsed.data.name, status: parsed.data.status });
    }

    revalidateOrgModules(["/organization/classes"]);
    return {
      status: "success",
      message: parsed.data.classId ? "Class updated." : "Class created.",
      classData: {
        id: savedClassId,
        name: parsed.data.name,
        status: parsed.data.status,
        classType: parsed.data.classType,
        difficulty: parsed.data.difficulty,
        durationMinutes: parsed.data.durationMinutes,
        defaultCapacity: parsed.data.defaultCapacity,
        gymId
      }
    };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save class definition.") as ClassDefActionResult;
  }
}
