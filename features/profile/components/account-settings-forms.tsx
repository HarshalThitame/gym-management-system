"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/features/auth/actions/auth-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { updateEmailAction } from "../actions/profile-actions";

type AccountSettingsFormsProps = {
  email: string;
};

export function EmailSettingsForm({ email }: AccountSettingsFormsProps) {
  const [state, formAction] = useActionState(updateEmailAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="email">Email</label>
        <Input id="email" name="email" type="email" defaultValue={email} />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </div>
      <AuthSubmitButton>Update Email</AuthSubmitButton>
    </form>
  );
}

export function PasswordSettingsForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
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
      <AuthSubmitButton>Change Password</AuthSubmitButton>
    </form>
  );
}
