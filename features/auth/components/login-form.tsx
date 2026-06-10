"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAction } from "../actions/auth-actions";
import { initialAuthActionState } from "../actions/action-state";
import { AuthSubmitButton } from "./auth-submit-button";
import { FieldError, FormMessage } from "./form-message";

type LoginFormProps = {
  nextPath: string;
  inactive?: boolean;
};

export function LoginForm({ nextPath, inactive = false }: LoginFormProps) {
  const [state, formAction] = useActionState(signInAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Member Portal</p>
        <h2 className="mt-2 text-3xl font-black">Sign in</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Access your membership, bookings, profile, and operations dashboard.</p>
      </div>

      {inactive ? (
        <p className="rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-sm font-medium text-warning" role="alert">
          This account is inactive. Contact the gym team before signing in again.
        </p>
      ) : null}

      <FormMessage state={state} />
      <input name="next" type="hidden" value={nextPath} />

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="email">Email</label>
        <Input autoComplete="email" id="email" name="email" placeholder="you@example.com" type="email" />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-bold" htmlFor="password">Password</label>
          <Link className="text-sm font-bold text-muted-foreground underline-offset-4 hover:underline" href="/forgot-password">
            Forgot?
          </Link>
        </div>
        <Input autoComplete="current-password" id="password" name="password" type="password" />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </div>

      <AuthSubmitButton>Sign In</AuthSubmitButton>

      <div className="grid gap-3 text-center text-sm text-muted-foreground">
        <p>New to Apex? <Link className="font-bold text-foreground underline-offset-4 hover:underline" href="/register">Create an account</Link></p>
        <ButtonLink href="/" size="sm" variant="secondary">Return to Website</ButtonLink>
      </div>
    </form>
  );
}
