"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { formatCurrency } from "@/features/billing/lib/money";
import { collectPaymentAction } from "../actions/payment-collect-action";
import type { MemberDirectoryItem } from "@/types/membership";

const selectField = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function PaymentCollectForm({
  members,
  defaultMethod
}: {
  members: MemberDirectoryItem[];
  defaultMethod: string;
}) {
  const [state, formAction] = useActionState(collectPaymentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      {state.success && state.status === "success" ? (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-center">
          <p className="text-lg font-black text-green-400">Payment Collected</p>
          <p className="mt-1 text-sm text-green-300">
            Receipt: {(state as Record<string, string>).receiptNumber ?? "N/A"}
          </p>
          <p className="text-xs text-green-300/70">
            Payment #: {(state as Record<string, string>).paymentNumber ?? "N/A"}
          </p>
        </div>
      ) : null}

      <input name="method" type="hidden" value={defaultMethod} />

      <Field id="payment-member" label="Member">
        <select className={selectField} name="memberId">
          <option value="">Select a member...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.member_code})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="payment-amount" label="Amount (INR)">
          <Input
            id="payment-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            type="number"
            min="1"
            step="1"
          />
        </Field>

        <Field id="payment-type" label="Payment Type">
          <select className={selectField} name="paymentType" defaultValue="other">
            <option value="membership">Membership Dues</option>
            <option value="pt">Personal Training</option>
            <option value="class">Class Booking</option>
            <option value="product">Retail / Supplements</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>

      <Field id="payment-notes" label="Notes (optional)">
        <Textarea
          id="payment-notes"
          name="notes"
          placeholder="Transaction reference, UPI ID, or any notes..."
        />
      </Field>

      <Button className="w-full" type="submit" variant="success">
        Collect Payment
      </Button>
    </form>
  );
}
