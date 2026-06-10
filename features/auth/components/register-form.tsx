"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { signUpAction } from "../actions/auth-actions";
import { initialAuthActionState } from "../actions/action-state";
import { AuthSubmitButton } from "./auth-submit-button";
import { FieldError, FormMessage } from "./form-message";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUpAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Start Training</p>
        <h2 className="mt-2 text-3xl font-black">Create account</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Set up your member access before joining or renewing a plan.</p>
      </div>

      <FormMessage state={state} />

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="fullName">Full name</label>
        <Input autoComplete="name" id="fullName" name="fullName" />
        <FieldError message={state.fieldErrors?.fullName?.[0]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="email">Email</label>
          <Input autoComplete="email" id="email" name="email" type="email" />
          <FieldError message={state.fieldErrors?.email?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="phone">Phone</label>
          <Input autoComplete="tel" id="phone" name="phone" type="tel" />
          <FieldError message={state.fieldErrors?.phone?.[0]} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="password">Password</label>
        <Input autoComplete="new-password" id="password" name="password" type="password" />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="confirmPassword">Confirm password</label>
        <Input autoComplete="new-password" id="confirmPassword" name="confirmPassword" type="password" />
        <FieldError message={state.fieldErrors?.confirmPassword?.[0]} />
      </div>

      <AuthSubmitButton>Create Account</AuthSubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Already have access? <Link className="font-bold text-foreground underline-offset-4 hover:underline" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
