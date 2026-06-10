"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { resetPasswordAction } from "../actions/auth-actions";
import { initialAuthActionState } from "../actions/action-state";
import { AuthSubmitButton } from "./auth-submit-button";
import { FieldError, FormMessage } from "./form-message";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Secure Reset</p>
        <h2 className="mt-2 text-3xl font-black">Set new password</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Use a strong password before returning to your dashboard.</p>
      </div>
      <FormMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="password">New password</label>
        <Input autoComplete="new-password" id="password" name="password" type="password" />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="confirmPassword">Confirm password</label>
        <Input autoComplete="new-password" id="confirmPassword" name="confirmPassword" type="password" />
        <FieldError message={state.fieldErrors?.confirmPassword?.[0]} />
      </div>
      <AuthSubmitButton>Update Password</AuthSubmitButton>
      {state.status === "success" ? (
        <Link className="block text-center text-sm font-bold underline-offset-4 hover:underline" href="/member">
          Continue to dashboard
        </Link>
      ) : null}
    </form>
  );
}
