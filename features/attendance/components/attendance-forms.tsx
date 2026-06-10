"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { AccessDeviceRow, AttendanceSessionRow } from "@/types/attendance";
import type { MemberRow } from "@/types/membership";
import {
  checkOutAction,
  manualCheckInAction,
  qrCheckInAction,
  regenerateQrTokenAction,
  saveAccessDeviceAction,
  syncInactivityAlertsAction
} from "../actions/attendance-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function ManualCheckInForm({ members, devices }: { members: MemberRow[]; devices: AccessDeviceRow[] }) {
  const [state, formAction] = useActionState(manualCheckInAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <SelectMember members={members} />
      <SelectDevice devices={devices} />
      <Textarea name="notes" placeholder="Reception notes or override context" />
      <AuthSubmitButton>Check In Member</AuthSubmitButton>
    </form>
  );
}

export function QrScanForm({ devices, defaultToken = "" }: { devices: AccessDeviceRow[]; defaultToken?: string }) {
  const [state, formAction] = useActionState(qrCheckInAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="tokenValue">QR token or scan URL</label>
        <Input id="tokenValue" name="tokenValue" defaultValue={defaultToken} placeholder="Paste scanned QR payload" />
        <FieldError message={state.fieldErrors?.tokenValue?.[0]} />
      </div>
      <SelectDevice devices={devices} />
      <AuthSubmitButton>Validate QR and Check In</AuthSubmitButton>
    </form>
  );
}

export function CheckOutForm({ session, devices }: { session: AttendanceSessionRow; devices: AccessDeviceRow[] }) {
  const [state, formAction] = useActionState(checkOutAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="sessionId" type="hidden" value={session.id} />
      <SelectDevice devices={devices} compact />
      <Input name="notes" placeholder="Checkout notes" />
      <Button className="w-full" type="submit" variant="secondary">Check Out</Button>
    </form>
  );
}

export function RegenerateQrForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(regenerateQrTokenAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="memberId" type="hidden" value={memberId} />
      <Button type="submit" variant="secondary">Regenerate QR</Button>
    </form>
  );
}

export function AccessDeviceForm() {
  const [state, formAction] = useActionState(saveAccessDeviceAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="deviceCode" label="Device code" state={state}>
          <Input id="deviceCode" name="deviceCode" placeholder="REC-01" />
        </Field>
        <Field name="name" label="Device name" state={state}>
          <Input id="name" name="name" placeholder="Front Desk Scanner" />
        </Field>
        <select className={selectClass} name="deviceType" defaultValue="reception" aria-label="Device type">
          <option value="reception">Reception</option>
          <option value="qr_scanner">QR scanner</option>
          <option value="turnstile">Turnstile</option>
          <option value="rfid_reader">RFID reader</option>
          <option value="biometric">Biometric</option>
          <option value="face_recognition">Face recognition</option>
          <option value="kiosk">Kiosk</option>
          <option value="api">API</option>
        </select>
        <select className={selectClass} name="status" defaultValue="active" aria-label="Device status">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>
      <Input name="location" placeholder="Entrance, reception desk, turnstile lane" />
      <AuthSubmitButton>Save Device</AuthSubmitButton>
    </form>
  );
}

export function SyncInactivityAlertsForm() {
  const [state, formAction] = useActionState(syncInactivityAlertsAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <AuthSubmitButton>Sync Absence Alerts</AuthSubmitButton>
    </form>
  );
}

function SelectMember({ members }: { members: MemberRow[] }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor="memberId">Member</label>
      <select className={selectClass} id="memberId" name="memberId" defaultValue={members[0]?.id ?? ""}>
        {members.map((member) => (
          <option key={member.id} value={member.id}>{member.full_name} · {member.member_code}</option>
        ))}
      </select>
    </div>
  );
}

function SelectDevice({ devices, compact = false }: { devices: AccessDeviceRow[]; compact?: boolean }) {
  return (
    <div className={compact ? "" : "space-y-2"}>
      {compact ? null : <label className="text-sm font-bold" htmlFor="deviceId">Access point</label>}
      <select className={selectClass} id="deviceId" name="deviceId" defaultValue="">
        <option value="">Reception default</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>{device.name}</option>
        ))}
      </select>
    </div>
  );
}

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}
