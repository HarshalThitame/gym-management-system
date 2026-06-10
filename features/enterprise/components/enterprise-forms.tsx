"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { roleNames } from "@/types/auth";
import type { BranchRow, BranchSettingRow, BranchUserRow, ComplianceRequestRow, FeatureFlagRow, OrganizationRow, PlatformSubscriptionRow, RetentionPolicyRow, SecurityEventRow, TenantConfigRow } from "@/types/enterprise";
import {
  backupScopes,
  backupTypes,
  branchAccessScopes,
  branchRoles,
  branchStatuses,
  complianceRequestTypes,
  complianceStatuses,
  featureFlagStatuses,
  healthComponents,
  healthStatuses,
  organizationStatuses,
  organizationTypes,
  planTiers,
  retentionActions,
  retentionCategories,
  securityStatuses,
  subscriptionStatuses
} from "@/types/enterprise";
import {
  queueBackupJobAction,
  recordHealthCheckAction,
  saveBranchAction,
  saveBranchSettingsAction,
  saveBranchUserAction,
  saveComplianceRequestAction,
  saveFeatureFlagAction,
  saveOrganizationAction,
  saveRetentionPolicyAction,
  saveSubscriptionAction,
  saveTenantConfigAction,
  updateSecurityEventStatusAction
} from "../actions/enterprise-actions";
import { formatEnterpriseLabel } from "../lib/business-rules";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function OrganizationForm({ organizations }: { organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveOrganizationAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create new organization" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="org-name" label="Name" name="name" state={state}><Input id="org-name" name="name" placeholder="Apex Fitness Group" /></Field>
        <Field id="org-slug" label="Slug" name="slug" state={state}><Input id="org-slug" name="slug" placeholder="apex-fitness-group" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Type" name="organizationType" options={organizationTypes} />
        <SelectField label="Status" name="status" options={organizationStatuses} />
        <Field id="org-billing" label="Billing email" name="billingEmail" state={state}><Input id="org-billing" name="billingEmail" type="email" placeholder="finance@apexfit.com" /></Field>
      </div>
      <Field id="org-domain" label="Primary domain" name="primaryDomain" state={state}><Input id="org-domain" name="primaryDomain" placeholder="apexfit.com" /></Field>
      <Field id="org-settings" label="Settings JSON" name="settings" state={state}><Textarea id="org-settings" name="settings" defaultValue='{"governance":"standard","release_channel":"stable"}' /></Field>
      <AuthSubmitButton>Save Organization</AuthSubmitButton>
    </form>
  );
}

export function BranchForm({ branches, organizations }: { branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveBranchAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create new branch" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="branch-name" label="Name" name="name" state={state}><Input id="branch-name" name="name" placeholder="Apex Bandra" /></Field>
        <Field id="branch-slug" label="Slug" name="slug" state={state}><Input id="branch-slug" name="slug" placeholder="apex-bandra" /></Field>
        <Field id="branch-code" label="Branch code" name="branchCode" state={state}><Input id="branch-code" name="branchCode" placeholder="BND001" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Status" name="status" options={branchStatuses} />
        <Field id="branch-timezone" label="Timezone" name="timezone" state={state}><Input id="branch-timezone" name="timezone" defaultValue="Asia/Kolkata" /></Field>
        <Field id="branch-currency" label="Currency" name="currency" state={state}><Input id="branch-currency" name="currency" defaultValue="INR" /></Field>
        <Field id="branch-capacity" label="Capacity" name="capacity" state={state}><Input id="branch-capacity" name="capacity" defaultValue="120" type="number" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="city" placeholder="City" aria-label="City" />
        <Input name="state" placeholder="State" aria-label="State" />
        <Input name="country" placeholder="Country" aria-label="Country" defaultValue="India" />
      </div>
      <Textarea name="address" placeholder="Branch address" aria-label="Branch address" />
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="phone" placeholder="Phone" aria-label="Phone" />
        <Input name="email" placeholder="Email" aria-label="Email" />
        <Input name="postalCode" placeholder="Postal code" aria-label="Postal code" />
      </div>
      <Input name="gymId" placeholder="Optional existing gym ID" aria-label="Optional existing gym ID" />
      <Field id="branch-hours" label="Operating hours JSON" name="operatingHours" state={state}><Textarea id="branch-hours" name="operatingHours" defaultValue='{"mon_fri":"06:00-22:00","sat_sun":"07:00-20:00"}' /></Field>
      <AuthSubmitButton>Save Branch</AuthSubmitButton>
    </form>
  );
}

export function BranchUserForm({ branchUsers, branches, organizations }: { branchUsers: BranchUserRow[]; branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveBranchUserAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Branch user" name="branchUserId" options={branchUsers.map((item) => ({ label: `${item.role_name} · ${item.branch_role}`, value: item.id }))} placeholder="Assign branch user" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} />
      </div>
      <Field id="branch-user" label="User ID" name="userId" state={state}><Input id="branch-user" name="userId" placeholder="Supabase auth user ID" /></Field>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="System role" name="roleName" options={roleNames} />
        <SelectField label="Branch role" name="branchRole" options={branchRoles} />
        <SelectField label="Access scope" name="accessScope" options={branchAccessScopes} />
        <SelectField label="Status" name="status" options={["active", "invited", "suspended", "revoked"]} />
      </div>
      <Field id="branch-permissions" label="Permission overrides JSON" name="permissions" state={state}><Textarea id="branch-permissions" name="permissions" defaultValue='{"reports":["read"],"members":["read","update"]}' /></Field>
      <AuthSubmitButton>Save Branch Access</AuthSubmitButton>
    </form>
  );
}

export function BranchSettingsForm({ branches, branchSettings, organizations }: { branches: BranchRow[]; branchSettings: BranchSettingRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveBranchSettingsAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Settings record" name="branchSettingsId" options={branchSettings.map((item) => ({ label: item.branch_id, value: item.id }))} placeholder="Create branch settings" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <JsonField name="generalSettings" label="General" value='{"timezone":"Asia/Kolkata","capacity_alert":85}' state={state} />
        <JsonField name="membershipSettings" label="Membership" value='{"cross_branch_access":"premium_only"}' state={state} />
        <JsonField name="paymentSettings" label="Payments" value='{"tax_mode":"inclusive","razorpay_enabled":true}' state={state} />
        <JsonField name="attendanceSettings" label="Attendance" value='{"duplicate_checkin_window_minutes":30}' state={state} />
        <JsonField name="classSettings" label="Classes" value='{"waitlist_auto_promotion":true}' state={state} />
        <JsonField name="notificationSettings" label="Notifications" value='{"renewal_reminders":[30,15,7,1]}' state={state} />
        <JsonField name="securitySettings" label="Security" value='{"allowed_ip_ranges":[],"mfa_required_for_admins":true}' state={state} />
      </div>
      <AuthSubmitButton>Save Branch Settings</AuthSubmitButton>
    </form>
  );
}

export function TenantConfigForm({ organizations, tenantConfigs }: { organizations: OrganizationRow[]; tenantConfigs: TenantConfigRow[] }) {
  const [state, formAction] = useActionState(saveTenantConfigAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Tenant config" name="tenantConfigId" options={tenantConfigs.map((item) => ({ label: item.brand_name, value: item.id }))} placeholder="Create tenant config" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="tenant-key" label="Tenant key" name="tenantKey" state={state}><Input id="tenant-key" name="tenantKey" placeholder="apex-fitness" /></Field>
        <Field id="brand-name" label="Brand name" name="brandName" state={state}><Input id="brand-name" name="brandName" placeholder="Apex Performance Club" /></Field>
        <SelectField label="Plan tier" name="planTier" options={planTiers} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Status" name="status" options={["active", "trial", "suspended", "archived"]} />
        <Input name="customDomain" placeholder="apexfit.com" aria-label="Custom domain" />
        <Input name="subdomain" placeholder="apexfit" aria-label="Subdomain" />
        <Input name="logoUrl" placeholder="Logo URL" aria-label="Logo URL" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="primaryColor" type="color" defaultValue="#111315" aria-label="Primary color" />
        <Input name="secondaryColor" type="color" defaultValue="#16a34a" aria-label="Secondary color" />
        <Input name="accentColor" type="color" defaultValue="#d7ff3f" aria-label="Accent color" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <JsonField name="typography" label="Typography JSON" value='{"heading":"Inter","body":"Inter"}' state={state} />
        <JsonField name="emailBranding" label="Email Branding JSON" value='{"from_name":"Apex Performance Club"}' state={state} />
        <JsonField name="limits" label="Limits JSON" value='{"branches":5,"members":5000,"storage_mb":10240}' state={state} />
        <JsonField name="complianceSettings" label="Compliance JSON" value='{"privacy_contact":"privacy@apexfit.com"}' state={state} />
      </div>
      <AuthSubmitButton>Save Tenant Config</AuthSubmitButton>
    </form>
  );
}

export function FeatureFlagForm({ branches, featureFlags, organizations }: { branches: BranchRow[]; featureFlags: FeatureFlagRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveFeatureFlagAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Feature flag" name="featureFlagId" options={featureFlags.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create feature flag" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Global flag" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="flag-key" label="Flag key" name="flagKey" state={state}><Input id="flag-key" name="flagKey" placeholder="custom_domains" /></Field>
        <Field id="flag-name" label="Name" name="name" state={state}><Input id="flag-name" name="name" placeholder="Custom Domains" /></Field>
        <SelectField label="Status" name="status" options={featureFlagStatuses} />
      </div>
      <Textarea name="description" placeholder="Feature description" aria-label="Feature description" />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm font-bold"><input name="enabled" type="checkbox" /> Enabled</label>
        <Input name="rolloutPercentage" type="number" defaultValue="100" aria-label="Rollout percentage" />
        <Input name="targetPlanTiers" defaultValue="starter,professional,enterprise" aria-label="Target plan tiers" />
      </div>
      <JsonField name="rules" label="Rules JSON" value='{"min_staff_role":"gym_admin"}' state={state} />
      <AuthSubmitButton>Save Feature Flag</AuthSubmitButton>
    </form>
  );
}

export function SubscriptionForm({ organizations, subscriptions }: { organizations: OrganizationRow[]; subscriptions: PlatformSubscriptionRow[] }) {
  const [state, formAction] = useActionState(saveSubscriptionAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Subscription" name="subscriptionId" options={subscriptions.map((item) => ({ label: `${item.plan_tier} · ${item.status}`, value: item.id }))} placeholder="Create subscription" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Plan tier" name="planTier" options={planTiers} />
        <SelectField label="Status" name="status" options={subscriptionStatuses} />
        <Input name="branchLimit" type="number" defaultValue="1" aria-label="Branch limit" />
        <Input name="memberLimit" type="number" defaultValue="500" aria-label="Member limit" />
        <Input name="staffLimit" type="number" defaultValue="10" aria-label="Staff limit" />
        <Input name="storageLimitMb" type="number" defaultValue="1024" aria-label="Storage limit MB" />
        <Input name="renewsOn" type="date" aria-label="Renews on" />
        <Input name="trialEndsOn" type="date" aria-label="Trial ends on" />
      </div>
      <AuthSubmitButton>Save License</AuthSubmitButton>
    </form>
  );
}

export function RetentionPolicyForm({ branches, organizations, policies }: { branches: BranchRow[]; organizations: OrganizationRow[]; policies: RetentionPolicyRow[] }) {
  const [state, formAction] = useActionState(saveRetentionPolicyAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Retention policy" name="retentionPolicyId" options={policies.map((item) => ({ label: item.data_category, value: item.id }))} placeholder="Create policy" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Global default" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Data category" name="dataCategory" options={retentionCategories} />
        <Input name="retentionDays" type="number" defaultValue="730" aria-label="Retention days" />
        <SelectField label="Disposition" name="dispositionAction" options={retentionActions} />
        <SelectField label="Status" name="status" options={["active", "paused", "archived"]} />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold"><input name="legalHold" type="checkbox" /> Legal hold</label>
      <AuthSubmitButton>Save Retention Policy</AuthSubmitButton>
    </form>
  );
}

export function ComplianceRequestForm({ branches, organizations, requests }: { branches: BranchRow[]; organizations: OrganizationRow[]; requests: ComplianceRequestRow[] }) {
  const [state, formAction] = useActionState(saveComplianceRequestAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Compliance request" name="complianceRequestId" options={requests.map((item) => ({ label: `${item.request_type} · ${item.requester_email}`, value: item.id }))} placeholder="Create request" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Platform request" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Request type" name="requestType" options={complianceRequestTypes} />
        <Input name="requesterEmail" type="email" placeholder="member@example.com" aria-label="Requester email" />
        <SelectField label="Status" name="status" options={complianceStatuses} />
        <Input name="dueAt" type="datetime-local" aria-label="Due date" />
      </div>
      <Textarea name="notes" placeholder="Review notes" aria-label="Review notes" />
      <JsonField name="metadata" label="Metadata JSON" value='{"source":"admin_console"}' state={state} />
      <AuthSubmitButton>Save Compliance Request</AuthSubmitButton>
    </form>
  );
}

export function BackupJobForm({ branches, organizations }: { branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(queueBackupJobAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Platform backup" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Backup type" name="backupType" options={backupTypes} />
        <SelectField label="Scope" name="scope" options={backupScopes} />
      </div>
      <JsonField name="metadata" label="Metadata JSON" value='{"reason":"scheduled_recovery_point"}' state={state} />
      <AuthSubmitButton>Queue Backup</AuthSubmitButton>
    </form>
  );
}

export function HealthCheckForm({ branches, organizations }: { branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(recordHealthCheckAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Platform check" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Input name="checkKey" placeholder="database-primary" aria-label="Check key" />
        <SelectField label="Component" name="component" options={healthComponents} />
        <SelectField label="Status" name="status" options={healthStatuses} />
        <Input name="latencyMs" type="number" placeholder="Latency ms" aria-label="Latency ms" />
      </div>
      <Textarea name="message" placeholder="Health check message" aria-label="Health check message" />
      <JsonField name="metadata" label="Metadata JSON" value='{"region":"bom1"}' state={state} />
      <AuthSubmitButton>Record Health Check</AuthSubmitButton>
    </form>
  );
}

export function SecurityEventStatusForm({ event }: { event: SecurityEventRow }) {
  const [state, formAction] = useActionState(updateSecurityEventStatusAction, initialAuthActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <FormMessage state={state} />
      <input name="securityEventId" type="hidden" value={event.id} />
      {securityStatuses.filter((status) => status !== event.status).map((status) => (
        <Button key={status} name="status" size="sm" type="submit" value={status} variant={status === "resolved" ? "secondary" : "ghost"}>{formatEnterpriseLabel(status)}</Button>
      ))}
    </form>
  );
}

function JsonField({ label, name, state, value }: { label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; value: string }) {
  return (
    <Field id={name} label={label} name={name} state={state}>
      <Textarea id={name} name={name} defaultValue={value} />
    </Field>
  );
}

function Field({ id, label, name, state, children }: { id: string; label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={id}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: readonly string[] }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} name={name} defaultValue={options[0] ?? ""}>
        {options.map((option) => <option key={option} value={option}>{formatEnterpriseLabel(option)}</option>)}
      </select>
    </label>
  );
}

function EntitySelect({ label, name, options, placeholder = "Select" }: { label: string; name: string; options: Array<{ label: string; value: string }>; placeholder?: string }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} name={name} defaultValue="">
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
