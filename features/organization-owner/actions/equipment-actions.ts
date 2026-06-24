"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess } from "@/features/entitlement";

export type EquipmentRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  equipment_type: "cardio" | "strength" | "free_weight" | "machine" | "accessory" | "other";
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  warranty_expiry: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  service_interval_days: number;
  amc_provider: string | null;
  amc_expiry: string | null;
  status: "operational" | "under_maintenance" | "out_of_order" | "retired";
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceLogRow = {
  id: string;
  equipment_id: string;
  organization_id: string;
  service_date: string;
  service_type: "routine" | "repair" | "amc" | "inspection";
  description: string | null;
  cost: number | null;
  service_provider: string | null;
  technician_name: string | null;
  next_service_date: string | null;
  created_at: string;
};

export type EquipmentFilters = {
  branchId?: string;
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export type SaveEquipmentInput = {
  equipmentId?: string;
  name: string;
  equipmentType: EquipmentRow["equipment_type"];
  branchId?: string | null;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  warrantyExpiry?: string | null;
  lastServiceDate?: string | null;
  serviceIntervalDays?: number;
  amcProvider?: string | null;
  amcExpiry?: string | null;
  status?: EquipmentRow["status"];
  location?: string | null;
  notes?: string | null;
};

export type LogServiceInput = {
  serviceDate: string;
  serviceType: ServiceLogRow["service_type"];
  description?: string | null;
  cost?: number | null;
  serviceProvider?: string | null;
  technicianName?: string | null;
};

export async function getEquipment(
  organizationId: string,
  filters?: EquipmentFilters
): Promise<{
  equipment: EquipmentRow[];
  total: number;
  alerts: { warrantyExpiring: number; serviceOverdue: number; amcExpiring: number };
}> {
  await requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance");

  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters?.pageSize ?? 12));

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("equipment")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters?.branchId && filters.branchId !== "all") {
    query = query.eq("branch_id", filters.branchId);
  }
  if (filters?.type && filters.type !== "all") {
    query = query.eq("equipment_type", filters.type);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const [equipmentResult, alertsResult] = await Promise.all([
    query.order("name").range((page - 1) * pageSize, page * pageSize - 1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("equipment")
      .select("id, name, warranty_expiry, next_service_date, amc_expiry, status")
      .eq("organization_id", organizationId)
      .eq("status", "operational")
      .or(
        `warranty_expiry.lte.${thirtyDaysFromNow},next_service_date.lt.${today},amc_expiry.lte.${thirtyDaysFromNow}`
      ),
  ]);

  const equipment = (equipmentResult.data ?? []) as EquipmentRow[];
  const alertsData = (alertsResult.data ?? []) as Partial<EquipmentRow>[];

  const alerts = {
    warrantyExpiring: alertsData.filter((e) => e.warranty_expiry && e.warranty_expiry <= thirtyDaysFromNow).length,
    serviceOverdue: alertsData.filter((e) => e.next_service_date && e.next_service_date < today).length,
    amcExpiring: alertsData.filter((e) => e.amc_expiry && e.amc_expiry <= thirtyDaysFromNow).length,
  };

  return {
    equipment,
    total: equipmentResult.count ?? 0,
    alerts,
  };
}

export async function saveEquipment(
  organizationId: string,
  input: SaveEquipmentInput
): Promise<EquipmentRow> {
  await requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance");

  const supabase = await createSupabaseServerClient();
  const row = {
    organization_id: organizationId,
    name: input.name,
    equipment_type: input.equipmentType,
    branch_id: input.branchId ?? null,
    serial_number: input.serialNumber ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    purchase_date: input.purchaseDate ?? null,
    purchase_price: input.purchasePrice ?? null,
    warranty_expiry: input.warrantyExpiry ?? null,
    last_service_date: input.lastServiceDate ?? null,
    service_interval_days: input.serviceIntervalDays ?? 90,
    amc_provider: input.amcProvider ?? null,
    amc_expiry: input.amcExpiry ?? null,
    status: input.status ?? "operational",
    location: input.location ?? null,
    notes: input.notes ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  if (input.equipmentId) {
    const { data, error } = await client
      .from("equipment")
      .update(row)
      .eq("id", input.equipmentId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/organization/equipment");
    return data as EquipmentRow;
  }

  const { data, error } = await client
    .from("equipment")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/organization/equipment");
  return data as EquipmentRow;
}

export async function deleteEquipment(
  organizationId: string,
  equipmentId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance");

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("equipment")
    .delete()
    .eq("id", equipmentId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
  revalidatePath("/organization/equipment");
}

export async function logService(
  organizationId: string,
  equipmentId: string,
  input: LogServiceInput
): Promise<ServiceLogRow> {
  await requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance");

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Calculate next service date based on equipment's service interval
  const { data: eq } = await client
    .from("equipment")
    .select("service_interval_days")
    .eq("id", equipmentId)
    .eq("organization_id", organizationId)
    .single();

  const intervalDays = (eq as { service_interval_days: number } | null)?.service_interval_days ?? 90;
  const serviceDate = new Date(input.serviceDate);
  const nextServiceDate = new Date(serviceDate);
  nextServiceDate.setDate(nextServiceDate.getDate() + intervalDays);

  const [logResult] = await Promise.all([
    client
      .from("equipment_service_logs")
      .insert({
        equipment_id: equipmentId,
        organization_id: organizationId,
        service_date: input.serviceDate,
        service_type: input.serviceType,
        description: input.description ?? null,
        cost: input.cost ?? null,
        service_provider: input.serviceProvider ?? null,
        technician_name: input.technicianName ?? null,
        next_service_date: nextServiceDate.toISOString().slice(0, 10),
      })
      .select("*")
      .single(),
    client
      .from("equipment")
      .update({
        last_service_date: input.serviceDate,
        next_service_date: nextServiceDate.toISOString().slice(0, 10),
        status: "operational",
      })
      .eq("id", equipmentId)
      .eq("organization_id", organizationId),
  ]);

  if (logResult.error) throw new Error(logResult.error.message);
  revalidatePath("/organization/equipment");
  return logResult.data as ServiceLogRow;
}

export async function getServiceHistory(
  organizationId: string,
  equipmentId: string
): Promise<ServiceLogRow[]> {
  await requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance");

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("equipment_service_logs")
    .select("*")
    .eq("equipment_id", equipmentId)
    .eq("organization_id", organizationId)
    .order("service_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceLogRow[];
}

export async function getEquipmentAlerts(organizationId: string): Promise<{
  warrantyExpiring: Partial<EquipmentRow>[];
  serviceOverdue: Partial<EquipmentRow>[];
  amcExpiring: Partial<EquipmentRow>[];
}> {
  await requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance");

  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [warrantyRes, serviceRes, amcRes] = await Promise.all([
    client
      .from("equipment")
      .select("id, name, warranty_expiry, status")
      .eq("organization_id", organizationId)
      .eq("status", "operational")
      .lte("warranty_expiry", thirtyDaysFromNow)
      .gte("warranty_expiry", today),
    client
      .from("equipment")
      .select("id, name, next_service_date, status")
      .eq("organization_id", organizationId)
      .eq("status", "operational")
      .lt("next_service_date", today),
    client
      .from("equipment")
      .select("id, name, amc_expiry, status")
      .eq("organization_id", organizationId)
      .eq("status", "operational")
      .lte("amc_expiry", thirtyDaysFromNow)
      .gte("amc_expiry", today),
  ]);

  return {
    warrantyExpiring: (warrantyRes.data ?? []) as Partial<EquipmentRow>[],
    serviceOverdue: (serviceRes.data ?? []) as Partial<EquipmentRow>[],
    amcExpiring: (amcRes.data ?? []) as Partial<EquipmentRow>[],
  };
}
