"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { saveBranchAction, saveBranchSettingAction, saveFeatureFlagAction, saveTenantDomainAction } from "../actions/branch-actions";

type Database = {
  public: {
    Tables: {
      branches: { Row: { id: string; name: string; branch_code: string; status: string; city: string | null; state: string | null; country: string | null; address: string | null; capacity: number; timezone: string | null } };
      branch_settings: { Row: { id: string; branch_id: string; setting_key: string; setting_value: string; scope: string | null } };
      feature_flags: { Row: { id: string; branch_id: string; name: string; flag_key: string; description: string | null; enabled: boolean; status: string; rollout_percentage: number } };
      tenant_domains: { Row: { id: string; domain: string; domain_type: string; routing_mode: string; is_primary: boolean; ssl_status: string; status: string } };
    };
  };
};

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchSettingRow = Database["public"]["Tables"]["branch_settings"]["Row"];
type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
type TenantDomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

export function BranchForm({ branch }: { branch?: BranchRow | null }) {
  const [state, formAction] = useActionState(saveBranchAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="branchId" value={branch?.id ?? ""} />
      <Field name="name" label="Branch name" state={state}>
        <Input id="name" name="name" defaultValue={branch?.name ?? ""} required />
      </Field>
      <Field name="branchCode" label="Branch code" state={state}>
        <Input id="branchCode" name="branchCode" defaultValue={branch?.branch_code ?? ""} required />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="city" label="City" state={state}>
          <Input id="city" name="city" defaultValue={branch?.city ?? ""} />
        </Field>
        <Field name="state" label="State" state={state}>
          <Input id="state" name="state" defaultValue={branch?.state ?? ""} />
        </Field>
      </div>
      <Field name="country" label="Country" state={state}>
        <Input id="country" name="country" defaultValue={branch?.country ?? ""} />
      </Field>
      <Field name="address" label="Address" state={state}>
        <Input id="address" name="address" defaultValue={branch?.address ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="capacity" label="Capacity" state={state}>
          <Input id="capacity" name="capacity" type="number" min="1" defaultValue={String(branch?.capacity ?? 100)} required />
        </Field>
        <Field name="status" label="Status" state={state}>
          <select id="status" name="status" className={selectClass} defaultValue={branch?.status ?? "active"}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>
      <Field name="timezone" label="Timezone" state={state}>
        <Input id="timezone" name="timezone" defaultValue={branch?.timezone ?? "Asia/Kolkata"} placeholder="Asia/Kolkata" />
      </Field>
      <AuthSubmitButton>{branch ? "Update Branch" : "Create Branch"}</AuthSubmitButton>
    </form>
  );
}

export function BranchSettingForm({ setting, branches }: { setting?: BranchSettingRow | null; branches: BranchRow[] }) {
  const [state, formAction] = useActionState(saveBranchSettingAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="settingId" value={setting?.id ?? ""} />
      <Field name="branchId" label="Branch" state={state}>
        <select id="branchId" name="branchId" className={selectClass} defaultValue={setting?.branch_id ?? branches[0]?.id ?? ""} required>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </Field>
      <Field name="settingKey" label="Setting key" state={state}>
        <Input id="settingKey" name="settingKey" defaultValue={setting?.setting_key ?? ""} required placeholder="e.g. membership.auto_renew" />
      </Field>
      <Field name="settingValue" label="Setting value" state={state}>
        <Input id="settingValue" name="settingValue" defaultValue={setting?.setting_value ?? ""} required />
      </Field>
      <Field name="scope" label="Scope" state={state}>
        <Input id="scope" name="scope" defaultValue={setting?.scope ?? ""} placeholder="e.g. membership, payment" />
      </Field>
      <AuthSubmitButton>{setting ? "Update Setting" : "Create Setting"}</AuthSubmitButton>
    </form>
  );
}

export function FeatureFlagForm({ flag, branches }: { flag?: FeatureFlagRow | null; branches: BranchRow[] }) {
  const [state, formAction] = useActionState(saveFeatureFlagAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="flagId" value={flag?.id ?? ""} />
      <Field name="branchId" label="Branch" state={state}>
        <select id="branchId" name="branchId" className={selectClass} defaultValue={flag?.branch_id ?? branches[0]?.id ?? ""} required>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </Field>
      <Field name="name" label="Flag name" state={state}>
        <Input id="name" name="name" defaultValue={flag?.name ?? ""} required />
      </Field>
      <Field name="flagKey" label="Flag key" state={state}>
        <Input id="flagKey" name="flagKey" defaultValue={flag?.flag_key ?? ""} required placeholder="e.g. biometric_attendance_enabled" />
      </Field>
      <Field name="description" label="Description" state={state}>
        <Input id="description" name="description" defaultValue={flag?.description ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="status" label="Status" state={state}>
          <select id="status" name="status" className={selectClass} defaultValue={flag?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field name="rolloutPercentage" label="Rollout %" state={state}>
          <Input id="rolloutPercentage" name="rolloutPercentage" type="number" min="0" max="100" defaultValue={String(flag?.rollout_percentage ?? 100)} required />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input type="checkbox" name="enabled" defaultChecked={flag?.enabled ?? true} className="size-4 rounded border-border" />
        Enabled
      </label>
      <AuthSubmitButton>{flag ? "Update Flag" : "Create Flag"}</AuthSubmitButton>
    </form>
  );
}

export function TenantDomainForm({ domain }: { domain?: TenantDomainRow | null }) {
  const [state, formAction] = useActionState(saveTenantDomainAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="domainId" value={domain?.id ?? ""} />
      <Field name="domain" label="Domain" state={state}>
        <Input id="domain" name="domain" defaultValue={domain?.domain ?? ""} required placeholder="gym.example.com" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="domainType" label="Domain type" state={state}>
          <select id="domainType" name="domainType" className={selectClass} defaultValue={domain?.domain_type ?? "subdomain"}>
            <option value="custom_domain">Custom Domain</option>
            <option value="subdomain">Subdomain</option>
            <option value="system">System</option>
          </select>
        </Field>
        <Field name="routingMode" label="Routing mode" state={state}>
          <select id="routingMode" name="routingMode" className={selectClass} defaultValue={domain?.routing_mode ?? "gym"}>
            <option value="organization">Organization</option>
            <option value="branch">Branch</option>
            <option value="gym">Gym</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input type="checkbox" name="isPrimary" defaultChecked={domain?.is_primary ?? false} className="size-4 rounded border-border" />
        Primary domain
      </label>
      <AuthSubmitButton>{domain ? "Update Domain" : "Add Domain"}</AuthSubmitButton>
    </form>
  );
}
