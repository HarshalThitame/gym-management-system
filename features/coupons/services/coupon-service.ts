import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];

export type CouponDashboard = {
  coupons: CouponRow[];
  metrics: {
    totalCoupons: number;
    activeCoupons: number;
    expiredCoupons: number;
    totalUsage: number;
  };
};

export async function getCouponDashboard(gymId: string | null): Promise<CouponDashboard> {
  const supabase = await createSupabaseServerClient();

  const { data: coupons, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("gym_id", gymId ?? "")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (coupons ?? []) as CouponRow[];
  const today = new Date().toISOString();

  const activeCoupons = rows.filter((c) => {
    if (c.status !== "active") return false;
    if (c.expires_at && c.expires_at < today) return false;
    if (c.usage_limit && c.used_count >= c.usage_limit) return false;
    return true;
  }).length;

  const expiredCoupons = rows.filter((c) => {
    if (c.expires_at && c.expires_at < today) return true;
    if (c.status === "expired") return true;
    return false;
  }).length;

  const totalUsage = rows.reduce((sum, c) => sum + c.used_count, 0);

  return {
    coupons: rows,
    metrics: {
      totalCoupons: rows.length,
      activeCoupons,
      expiredCoupons,
      totalUsage
    }
  };
}

export type { CouponRow };
