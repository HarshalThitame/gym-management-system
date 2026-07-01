"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { EquipmentSchema } from "../schemas/equipment";

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}

export async function saveEquipmentAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/equipment");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const parsed = EquipmentSchema.safeParse({
    equipmentId: formData.get("equipmentId") ?? "",
    name: formData.get("name"),
    equipmentType: formData.get("equipmentType"),
    brand: formData.get("brand") ?? "",
    model: formData.get("model") ?? "",
    serialNumber: formData.get("serialNumber") ?? "",
    location: formData.get("location") ?? "",
    status: formData.get("status") ?? "active",
    purchaseDate: formData.get("purchaseDate") ?? "",
    purchasePrice: formData.get("purchasePrice") ?? "",
    warrantyExpiry: formData.get("warrantyExpiry") ?? "",
    amcProvider: formData.get("amcProvider") ?? "",
    amcExpiry: formData.get("amcExpiry") ?? "",
    serviceIntervalDays: formData.get("serviceIntervalDays") ?? "",
    lastServiceDate: formData.get("lastServiceDate") ?? "",
    nextServiceDate: formData.get("nextServiceDate") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const equipmentId = parsed.data.equipmentId || null;

  const payload = {
    organization_id: scope.organizationId,
    branch_id: scope.branchId,
    name: parsed.data.name,
    equipment_type: parsed.data.equipmentType,
    brand: parsed.data.brand || null,
    model: parsed.data.model || null,
    serial_number: parsed.data.serialNumber || null,
    location: parsed.data.location || null,
    status: parsed.data.status || "active",
    purchase_date: parsed.data.purchaseDate || null,
    purchase_price: parsed.data.purchasePrice || null,
    warranty_expiry: parsed.data.warrantyExpiry || null,
    amc_provider: parsed.data.amcProvider || null,
    amc_expiry: parsed.data.amcExpiry || null,
    service_interval_days: parsed.data.serviceIntervalDays || null,
    last_service_date: parsed.data.lastServiceDate || null,
    next_service_date: parsed.data.nextServiceDate || null,
    notes: parsed.data.notes || null
  } as any;

  if (equipmentId) {
    const { error } = await supabase.from("equipment").update(payload).eq("id", equipmentId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "update", entityType: "equipment", entityId: equipmentId, metadata: payload });
  } else {
    const { data, error } = await supabase.from("equipment").insert(payload).select("id").maybeSingle();
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "create", entityType: "equipment", entityId: data?.id ?? null, metadata: payload });
  }

  revalidatePath("/admin/equipment");
  return { status: "success", message: equipmentId ? "Equipment updated." : "Equipment created." };
}

export async function deleteEquipmentAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/equipment");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const equipmentId = formData.get("equipmentId");

  if (!equipmentId || typeof equipmentId !== "string") {
    return { status: "error", message: "Equipment ID is required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("equipment").delete().eq("id", equipmentId).eq("organization_id", scope.organizationId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "delete", entityType: "equipment", entityId: equipmentId });
  revalidatePath("/admin/equipment");
  return { status: "success", message: "Equipment deleted." };
}
