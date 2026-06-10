"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { MemberDocumentRow, MemberProfile, MembershipPlanRow } from "@/types/membership";
import { formatDateInput } from "../lib/business-rules";
import {
  assignMembershipAction,
  changeMembershipPlanAction,
  changeMembershipStatusAction,
  deleteMemberDocumentAction,
  renewMembershipAction,
  uploadMemberDocumentAction
} from "../actions/membership-actions";

type MemberLifecycleFormsProps = {
  profile: MemberProfile;
  plans: MembershipPlanRow[];
};

export function MemberLifecycleForms({ profile, plans }: MemberLifecycleFormsProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {profile.currentMembership ? (
        <>
          <RenewalForm membershipId={profile.currentMembership.id} plans={plans} />
          <PlanChangeForm membershipId={profile.currentMembership.id} plans={plans} />
          <StatusChangeForm membershipId={profile.currentMembership.id} />
        </>
      ) : (
        <AssignMembershipForm memberId={profile.member.id} plans={plans} />
      )}
      <DocumentUploadForm memberId={profile.member.id} />
    </div>
  );
}

function AssignMembershipForm({ memberId, plans }: { memberId: string; plans: MembershipPlanRow[] }) {
  const [state, formAction] = useActionState(assignMembershipAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h3 className="text-xl font-black">Assign Membership</h3>
      <FormMessage state={state} />
      <input name="memberId" type="hidden" value={memberId} />
      <PlanSelect plans={plans} />
      <DateAndPaymentFields state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="assignNotes">Notes</label>
        <Textarea id="assignNotes" name="notes" />
      </div>
      <AuthSubmitButton>Assign Membership</AuthSubmitButton>
    </form>
  );
}

function RenewalForm({ membershipId, plans }: { membershipId: string; plans: MembershipPlanRow[] }) {
  const [state, formAction] = useActionState(renewMembershipAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h3 className="text-xl font-black">Renew Membership</h3>
      <FormMessage state={state} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <PlanSelect plans={plans} />
      <DateAndPaymentFields state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="renewNotes">Renewal notes</label>
        <Textarea id="renewNotes" name="notes" />
      </div>
      <AuthSubmitButton>Renew Membership</AuthSubmitButton>
    </form>
  );
}

function PlanChangeForm({ membershipId, plans }: { membershipId: string; plans: MembershipPlanRow[] }) {
  const [state, formAction] = useActionState(changeMembershipPlanAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h3 className="text-xl font-black">Upgrade or Downgrade</h3>
      <FormMessage state={state} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <PlanSelect plans={plans} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="planChangeReason">Reason</label>
        <Textarea id="planChangeReason" name="reason" required />
        <FieldError message={state.fieldErrors?.reason?.[0]} />
      </div>
      <AuthSubmitButton>Change Plan</AuthSubmitButton>
    </form>
  );
}

function StatusChangeForm({ membershipId }: { membershipId: string }) {
  const [state, formAction] = useActionState(changeMembershipStatusAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h3 className="text-xl font-black">Lifecycle Status</h3>
      <FormMessage state={state} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="nextStatus">Action</label>
        <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="nextStatus" name="nextStatus">
          <option value="active">Reactivate</option>
          <option value="frozen">Freeze</option>
          <option value="suspended">Suspend</option>
          <option value="cancelled">Cancel</option>
          <option value="expired">Mark Expired</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="statusReason">Reason</label>
        <Textarea id="statusReason" name="reason" required />
        <FieldError message={state.fieldErrors?.reason?.[0]} />
      </div>
      <AuthSubmitButton>Update Status</AuthSubmitButton>
    </form>
  );
}

function DocumentUploadForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(uploadMemberDocumentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h3 className="text-xl font-black">Upload Document</h3>
      <FormMessage state={state} />
      <input name="memberId" type="hidden" value={memberId} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="documentType">Document type</label>
        <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="documentType" name="documentType">
          <option value="identity_proof">Identity proof</option>
          <option value="medical_declaration">Medical declaration</option>
          <option value="membership_agreement">Membership agreement</option>
          <option value="profile_photo">Profile photo</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="documentFile">File</label>
        <Input accept="image/jpeg,image/png,image/webp,application/pdf" id="documentFile" name="documentFile" type="file" />
      </div>
      <AuthSubmitButton>Upload Document</AuthSubmitButton>
    </form>
  );
}

export function DeleteDocumentForm({ document }: { document: MemberDocumentRow }) {
  const [state, formAction] = useActionState(deleteMemberDocumentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="documentId" type="hidden" value={document.id} />
      <input name="memberId" type="hidden" value={document.member_id} />
      <Button size="sm" type="submit" variant="destructive">Delete</Button>
    </form>
  );
}

function PlanSelect({ plans }: { plans: MembershipPlanRow[] }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor="planId">Plan</label>
      <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="planId" name="planId" defaultValue={plans[0]?.id ?? ""}>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>{plan.name}</option>
        ))}
      </select>
    </div>
  );
}

function DateAndPaymentFields({ state }: { state: { fieldErrors?: Record<string, string[]> } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="startDate">Start date</label>
        <Input id="startDate" name="startDate" type="date" defaultValue={formatDateInput(new Date())} />
        <FieldError message={state.fieldErrors?.startDate?.[0]} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="paymentStatus">Payment status</label>
        <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="paymentStatus" name="paymentStatus" defaultValue="pending">
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially paid</option>
          <option value="waived">Waived</option>
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-bold" htmlFor="discountAmount">Discount</label>
        <Input id="discountAmount" min={0} name="discountAmount" step="0.01" type="number" defaultValue={0} />
      </div>
    </div>
  );
}
