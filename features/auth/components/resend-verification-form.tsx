"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { resendVerificationAction } from "../actions/auth-actions";
import { initialAuthActionState } from "../actions/action-state";
import { AuthSubmitButton } from "./auth-submit-button";
import { FieldError, FormMessage } from "./form-message";

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(resendVerificationAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Email Verification</p>
        <h2 className="mt-2 text-3xl font-black">Verify access</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Request a fresh verification email for a pending account.</p>
      </div>
      <FormMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="email">Email</label>
        <Input autoComplete="email" id="email" name="email" type="email" />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </div>
      <AuthSubmitButton>Resend Verification</AuthSubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Already verified? <Link className="font-bold text-foreground underline-offset-4 hover:underline" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
