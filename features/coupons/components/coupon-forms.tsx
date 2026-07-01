"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { CouponRow } from "../services/coupon-service";
import { saveCouponAction, deleteCouponAction } from "../actions/coupon-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

export function CouponForm({ coupon }: { coupon?: CouponRow | null }) {
  const [state, formAction] = useActionState(saveCouponAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="couponId" value={coupon?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="code" label="Coupon Code" state={state}>
          <Input id="code" name="code" defaultValue={coupon?.code ?? ""} required placeholder="e.g., SAVE20" />
        </Field>
        <Field name="name" label="Coupon Name" state={state}>
          <Input id="name" name="name" defaultValue={coupon?.name ?? ""} required placeholder="e.g., 20% Off Membership" />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="discountType" label="Discount Type" state={state}>
          <select id="discountType" name="discountType" className={selectClass} defaultValue={coupon?.discount_type ?? "percentage"}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount</option>
          </select>
        </Field>
        <Field name="valueAmount" label="Discount Value" state={state}>
          <Input id="valueAmount" name="valueAmount" type="number" step="0.01" defaultValue={coupon ? String(coupon.value_amount / 100) : ""} required />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="minimumAmount" label="Minimum Purchase Amount" state={state}>
          <Input id="minimumAmount" name="minimumAmount" type="number" step="0.01" defaultValue={coupon ? String(coupon.minimum_amount / 100) : "0"} />
        </Field>
        <Field name="maxDiscountAmount" label="Max Discount Amount" state={state}>
          <Input id="maxDiscountAmount" name="maxDiscountAmount" type="number" step="0.01" defaultValue={coupon?.max_discount_amount ? String(coupon.max_discount_amount / 100) : ""} placeholder="Leave empty for unlimited" />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="usageLimit" label="Usage Limit" state={state}>
          <Input id="usageLimit" name="usageLimit" type="number" defaultValue={coupon?.usage_limit ? String(coupon.usage_limit) : ""} placeholder="Leave empty for unlimited" />
        </Field>
        <Field name="expiresAt" label="Expiry Date" state={state}>
          <Input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={coupon?.expires_at ? coupon.expires_at.slice(0, 16) : ""} />
        </Field>
      </div>
      <Field name="status" label="Status" state={state}>
        <select id="status" name="status" className={selectClass} defaultValue={coupon?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
      </Field>
      <AuthSubmitButton>{coupon ? "Update Coupon" : "Create Coupon"}</AuthSubmitButton>
    </form>
  );
}

export function CouponDeleteForm({ couponId }: { couponId: string }) {
  const [state, formAction] = useActionState(deleteCouponAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="couponId" value={couponId} />
      <p className="text-sm font-semibold text-destructive">This will permanently delete the coupon.</p>
      <AuthSubmitButton>Delete Coupon</AuthSubmitButton>
    </form>
  );
}
