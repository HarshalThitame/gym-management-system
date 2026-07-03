"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { uploadDocumentAction } from "../actions/document-actions";
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

export function DocumentUploadForm({
  members,
  defaultMemberId
}: {
  members: MemberDirectoryItem[];
  defaultMemberId: string;
}) {
  const [state, formAction] = useActionState(uploadDocumentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      {state.success && state.status === "success" ? (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-center">
          <p className="text-lg font-black text-green-400">Upload Successful</p>
          <p className="mt-1 text-sm text-green-300">Document has been saved to the member's profile.</p>
        </div>
      ) : null}

      <Field id="doc-member" label="Member">
        <select className={selectField} defaultValue={defaultMemberId} name="memberId">
          <option value="">Select a member...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.member_code})
            </option>
          ))}
        </select>
      </Field>

      <Field id="doc-type" label="Document Type">
        <select className={selectField} defaultValue="identity" name="documentType">
          <option value="identity">Identity Proof (Aadhar / PAN / DL)</option>
          <option value="medical">Medical Declaration / Health Form</option>
          <option value="agreement">Membership Agreement</option>
          <option value="profile_photo">Profile Photo</option>
          <option value="other">Other Document</option>
        </select>
      </Field>

      <Field id="doc-file" label="Document File">
        <input
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground file:mr-3 file:border-0 file:bg-accent/20 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-accent"
          id="doc-file"
          name="documentFile"
          type="file"
        />
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, or PDF only. Max 10 MB.</p>
      </Field>

      <Button className="w-full" type="submit" variant="accent">
        Upload Document
      </Button>
    </form>
  );
}
