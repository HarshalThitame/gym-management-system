"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { updateProfileAction } from "../actions/profile-actions";
import type { AuthProfile } from "@/types/auth";

type ProfileFormProps = {
  profile: AuthProfile;
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction] = useActionState(updateProfileAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="fullName">Full name</label>
          <Input id="fullName" name="fullName" defaultValue={profile.full_name} />
          <FieldError message={state.fieldErrors?.fullName?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="phone">Phone</label>
          <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
          <FieldError message={state.fieldErrors?.phone?.[0]} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="avatarUrl">Avatar URL</label>
        <Input id="avatarUrl" name="avatarUrl" type="url" defaultValue={profile.avatar_url ?? ""} />
        <FieldError message={state.fieldErrors?.avatarUrl?.[0]} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="avatarFile">Upload avatar</label>
        <Input accept="image/jpeg,image/png,image/webp" id="avatarFile" name="avatarFile" type="file" />
        <p className="text-xs font-semibold text-muted-foreground">JPG, PNG, or WebP under 2 MB.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="emergencyContactName">Emergency contact</label>
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={profile.emergency_contact_name ?? ""} />
          <FieldError message={state.fieldErrors?.emergencyContactName?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="emergencyContactPhone">Emergency phone</label>
          <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={profile.emergency_contact_phone ?? ""} />
          <FieldError message={state.fieldErrors?.emergencyContactPhone?.[0]} />
        </div>
      </div>
      <AuthSubmitButton>Save Profile</AuthSubmitButton>
    </form>
  );
}
