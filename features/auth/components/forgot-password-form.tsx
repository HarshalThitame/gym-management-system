"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "../actions/auth-actions";
import { initialAuthActionState } from "../actions/action-state";
import { AuthSubmitButton } from "./auth-submit-button";
import { FieldError, FormMessage } from "./form-message";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Account Recovery</p>
        <h2 className="mt-2 text-3xl font-black">Reset password</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter your account email and we will send a secure reset link.</p>
      </div>
      <FormMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="email">Email</label>
        <Input autoComplete="email" id="email" name="email" type="email" />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </div>
      <AuthSubmitButton>Send Reset Link</AuthSubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it? <Link className="font-bold text-foreground underline-offset-4 hover:underline" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
