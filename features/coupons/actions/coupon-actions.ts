"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { CouponSchema } from "../schemas/coupons";

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}

export async function saveCouponAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/promotions");

  const parsed = CouponSchema.safeParse({
    couponId: formData.get("couponId") ?? "",
    code: formData.get("code"),
    name: formData.get("name"),
    discountType: formData.get("discountType"),
    valueAmount: formData.get("valueAmount"),
    minimumAmount: formData.get("minimumAmount") ?? "0",
    maxDiscountAmount: formData.get("maxDiscountAmount") ?? "",
    usageLimit: formData.get("usageLimit") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const couponId = parsed.data.couponId || null;

  const payload = {
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    discount_type: parsed.data.discountType,
    value_amount: parsed.data.valueAmount,
    minimum_amount: parsed.data.minimumAmount,
    max_discount_amount: parsed.data.maxDiscountAmount || null,
    usage_limit: parsed.data.usageLimit || null,
    expires_at: parsed.data.expiresAt || null,
    status: parsed.data.status || "active",
    created_by: scope.userId
  } as any;

  if (couponId) {
    const { error } = await supabase.from("coupons").update(payload).eq("id", couponId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "update", entityType: "coupons", entityId: couponId, metadata: payload });
  } else {
    const { data, error } = await supabase.from("coupons").insert(payload).select("id").maybeSingle();
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "create", entityType: "coupons", entityId: data?.id ?? null, metadata: payload });
  }

  revalidatePath("/admin/promotions");
  return { status: "success", message: couponId ? "Coupon updated." : "Coupon created." };
}

export async function deleteCouponAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/promotions");
  const couponId = formData.get("couponId");

  if (!couponId || typeof couponId !== "string") {
    return { status: "error", message: "Coupon ID is required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("coupons").delete().eq("id", couponId).eq("gym_id", scope.gymId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "delete", entityType: "coupons", entityId: couponId });
  revalidatePath("/admin/promotions");
  return { status: "success", message: "Coupon deleted." };
}
