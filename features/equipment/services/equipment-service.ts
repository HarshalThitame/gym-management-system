import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];

export type EquipmentDashboard = {
  equipment: EquipmentRow[];
  metrics: {
    totalEquipment: number;
    activeEquipment: number;
    maintenanceEquipment: number;
    retiredEquipment: number;
    upcomingService: number;
  };
};

export async function getEquipmentDashboard(organizationId: string | null): Promise<EquipmentDashboard> {
  const supabase = await createSupabaseServerClient();

  const { data: equipment, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("organization_id", organizationId ?? "")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (equipment ?? []) as EquipmentRow[];
  const today = new Date().toISOString().split("T")[0] ?? "";

  const activeEquipment = rows.filter((e) => e.status === "active").length;
  const maintenanceEquipment = rows.filter((e) => e.status === "maintenance").length;
  const retiredEquipment = rows.filter((e) => e.status === "retired").length;

  const upcomingService = rows.filter((e) => {
    if (!e.next_service_date) return false;
    return e.next_service_date >= today;
  }).length;

  return {
    equipment: rows,
    metrics: {
      totalEquipment: rows.length,
      activeEquipment,
      maintenanceEquipment,
      retiredEquipment,
      upcomingService
    }
  };
}

export type { EquipmentRow };
